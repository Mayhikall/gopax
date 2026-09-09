const { decodeEventLog, getAddress, isAddressEqual } = require("viem");
const {
  getPublicClient,
  GOPAX_TOKEN_ABI,
  REWARD_MANAGER_ABI,
} = require("../lib/blockchain");
const config = require("../config");
const { AppError } = require("../middleware/error.middleware");

async function getTokenBalance(walletAddress) {
  const tokenAddress = config.blockchain.gopaxTokenAddress;
  if (!tokenAddress) {
    throw new AppError(
      "GOPAX token is not configured.",
      503,
      "TOKEN_UNAVAILABLE",
    );
  }

  return getPublicClient().readContract({
    address: tokenAddress,
    abi: GOPAX_TOKEN_ABI,
    functionName: "balanceOf",
    args: [walletAddress],
  });
}

async function getRewardPolicy() {
  if (!config.blockchain.rewardManagerAddress) {
    throw new AppError(
      "Reward manager is not configured.",
      503,
      "REWARD_MANAGER_UNAVAILABLE",
    );
  }

  try {
    const [maxReward, minReduction] = await getPublicClient().readContract({
      address: config.blockchain.rewardManagerAddress,
      abi: REWARD_MANAGER_ABI,
      functionName: "getRewardPolicy",
    });
    return { maxReward, minReduction };
  } catch {
    throw new AppError(
      "Unable to read the reward policy.",
      503,
      "BLOCKCHAIN_READ_FAILED",
    );
  }
}

async function isAssessmentClaimed(assessmentHash) {
  if (!config.blockchain.rewardManagerAddress) {
    throw new AppError(
      "Reward manager is not configured.",
      503,
      "REWARD_MANAGER_UNAVAILABLE",
    );
  }

  try {
    return await getPublicClient().readContract({
      address: config.blockchain.rewardManagerAddress,
      abi: REWARD_MANAGER_ABI,
      functionName: "claimedAssessments",
      args: [assessmentHash],
    });
  } catch {
    throw new AppError(
      "Unable to verify claim status on-chain.",
      503,
      "BLOCKCHAIN_READ_FAILED",
    );
  }
}

async function getTransactionReceipt(txHash) {
  try {
    return await getPublicClient().getTransactionReceipt({ hash: txHash });
  } catch {
    return null;
  }
}

async function assertAuthorizedSigner(signerAddress) {
  if (!config.blockchain.rewardManagerAddress) {
    throw new AppError(
      "Reward manager is not configured.",
      503,
      "REWARD_MANAGER_UNAVAILABLE",
    );
  }
  try {
    const onChainSigner = await getPublicClient().readContract({
      address: config.blockchain.rewardManagerAddress,
      abi: REWARD_MANAGER_ABI,
      functionName: "authorizedSigner",
    });
    if (!isAddressEqual(getAddress(onChainSigner), getAddress(signerAddress))) {
      throw new AppError(
        "Reward signer does not match the deployed contract.",
        503,
        "CLAIM_SIGNER_MISMATCH",
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Unable to verify the reward signer.",
      503,
      "BLOCKCHAIN_READ_FAILED",
    );
  }
}

async function verifyRewardClaim({
  txHash,
  walletAddress,
  assessmentHash,
  carbonKg,
  baselineKg,
  reward,
}) {
  if (!config.blockchain.rewardManagerAddress) {
    throw new AppError(
      "Reward manager is not configured.",
      503,
      "REWARD_MANAGER_UNAVAILABLE",
    );
  }

  const receipt = await getTransactionReceipt(txHash);
  if (!receipt) {
    throw new AppError(
      "Transaction not found. Please wait for confirmation.",
      404,
      "TX_NOT_FOUND",
    );
  }
  if (receipt.status !== "success") {
    throw new AppError(
      "Transaction was reverted on-chain.",
      409,
      "TX_REVERTED",
    );
  }

  const managerAddress = getAddress(config.blockchain.rewardManagerAddress);
  const expectedWallet = getAddress(walletAddress);
  if (!receipt.to || !isAddressEqual(getAddress(receipt.to), managerAddress)) {
    throw new AppError(
      "Transaction was sent to an unexpected contract.",
      409,
      "INVALID_CLAIM_TX",
    );
  }
  if (!isAddressEqual(getAddress(receipt.from), expectedWallet)) {
    throw new AppError(
      "Transaction sender does not match the reward owner.",
      409,
      "INVALID_CLAIM_TX",
    );
  }

  const hasExpectedEvent = receipt.logs.some((log) => {
    if (!isAddressEqual(getAddress(log.address), managerAddress)) return false;
    try {
      const decoded = decodeEventLog({
        abi: REWARD_MANAGER_ABI,
        data: log.data,
        topics: log.topics,
        strict: true,
      });
      if (decoded.eventName !== "CarbonRewarded") return false;
      const args = decoded.args;
      return (
        isAddressEqual(getAddress(args.user), expectedWallet) &&
        args.assessmentHash.toLowerCase() === assessmentHash.toLowerCase() &&
        args.carbonKg === BigInt(carbonKg) &&
        args.baselineKg === BigInt(baselineKg) &&
        args.reward === BigInt(reward)
      );
    } catch {
      return false;
    }
  });

  if (!hasExpectedEvent) {
    throw new AppError(
      "Transaction does not contain the expected reward event.",
      409,
      "INVALID_CLAIM_EVENT",
    );
  }

  return receipt;
}

module.exports = {
  getTokenBalance,
  getRewardPolicy,
  isAssessmentClaimed,
  getTransactionReceipt,
  assertAuthorizedSigner,
  verifyRewardClaim,
};
