const { getAddress, isHex, keccak256, toHex } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { AppError } = require("../middleware/error.middleware");
const db = require("../../db/knex");
const config = require("../config");
const { chain } = require("../lib/blockchain");
const blockchainService = require("./blockchain.service");

const BASE_REWARD_TOKENS = 10;
const MAX_EFFICIENCY_BONUS_TOKENS = 90;
const REFERENCE_EMISSION_KG_PER_PASSENGER_KM = 0.235;
const MAX_REWARD_PER_TRIP = BASE_REWARD_TOKENS + MAX_EFFICIENCY_BONUS_TOKENS;

// CAR/MOTORCYCLE assume one occupant. Equal intensity earns equal reward; no distance bonus.
function calculateRewardBreakdown(emissionFactorKgPerPassengerKm) {
  if (
    !["number", "string"].includes(typeof emissionFactorKgPerPassengerKm) ||
    String(emissionFactorKgPerPassengerKm).trim() === ""
  ) {
    throw new Error("Emission intensity required.");
  }
  const emissionIntensity = Number(emissionFactorKgPerPassengerKm);
  if (!Number.isFinite(emissionIntensity) || emissionIntensity < 0) {
    throw new Error("Invalid emission intensity.");
  }
  const efficiencyScore = Math.max(
    0,
    Math.min(1, 1 - emissionIntensity / REFERENCE_EMISSION_KG_PER_PASSENGER_KM),
  );
  const efficiencyBonusTokens = Math.round(
    MAX_EFFICIENCY_BONUS_TOKENS * efficiencyScore,
  );
  return {
    baseRewardTokens: BASE_REWARD_TOKENS,
    efficiencyBonusTokens,
    totalRewardTokens: BASE_REWARD_TOKENS + efficiencyBonusTokens,
    emissionFactorKgPerPassengerKm: emissionIntensity,
  };
}

function createAssessmentHash({
  tripId,
  distanceKm,
  emissionFactor,
  carbonEmissionKg,
  baselineEmissionKg,
  reward,
}) {
  // Encode as JSON string then hash for determinism
  const payload = JSON.stringify({
    tripId,
    distanceKm: String(distanceKm),
    emissionFactor: String(emissionFactor),
    carbonEmissionKg: String(carbonEmissionKg),
    baselineEmissionKg: String(baselineEmissionKg ?? 0),
    reward: String(reward),
  });

  return keccak256(toHex(payload));
}

function validateRewardEligibility(rewardEligibility) {
  if (
    !rewardEligibility ||
    !["REWARD", "NO_REWARD"].includes(rewardEligibility.decision) ||
    typeof rewardEligibility.reason !== "string" ||
    !rewardEligibility.reason.trim() ||
    rewardEligibility.reason.length > 2000
  ) {
    throw new AppError(
      "Valid AI eligibility assessment required.",
      422,
      "INVALID_AI_DECISION",
    );
  }
}

/**
 * Process reward after verified trip + carbon assessment.
 * Creates reward record in DB with status AVAILABLE.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.tripId
 * @param {Object} params.carbonAssessment
 * @param {Object} params.rewardEligibility
 * @returns {Promise<Object|null>} reward record, or null if NO_REWARD
 */
async function processReward({
  userId,
  tripId,
  carbonAssessment,
  rewardEligibility,
}) {
  // Require an owned, verified trip before recording eligibility and reward.
  const trip = await db("trips")
    .where({ id: tripId, user_id: userId, status: "VERIFIED" })
    .first();
  if (!trip || carbonAssessment.trip_id !== tripId) {
    throw new AppError(
      "Verified trip assessment required.",
      409,
      "TRIP_NOT_VERIFIED",
    );
  }
  validateRewardEligibility(rewardEligibility);
  const calculatedRewardTokens =
    rewardEligibility.decision === "REWARD"
      ? calculateRewardBreakdown(carbonAssessment.emission_factor)
          .totalRewardTokens
      : 0;

  return db.transaction(async (trx) => {
    // Serialize upload/retry commits for the same trip across backend instances.
    const lockedTrip = await trx("trips")
      .where({ id: tripId, user_id: userId })
      .forUpdate()
      .first();
    if (!lockedTrip || lockedTrip.status !== "VERIFIED") {
      throw new AppError("Verified trip required.", 409, "TRIP_NOT_VERIFIED");
    }
    const existingAssessment = await trx("ai_assessments")
      .where({ trip_id: tripId })
      .first();
    if (existingAssessment)
      return (await trx("rewards").where({ trip_id: tripId }).first()) || null;
    await trx("ai_assessments").insert({
      trip_id: tripId,
      decision: rewardEligibility.decision,
      // Legacy column name: this value is calculated by the backend, not recommended by AI.
      recommended_reward: calculatedRewardTokens,
      reason: rewardEligibility.reason.trim(),
    });
    if (rewardEligibility.decision !== "REWARD") return null;

    // Create assessment hash for on-chain duplicate prevention
    const assessmentHash = createAssessmentHash({
      tripId,
      distanceKm: carbonAssessment.distance_km,
      emissionFactor: carbonAssessment.emission_factor,
      carbonEmissionKg: carbonAssessment.carbon_emission_kg,
      baselineEmissionKg: carbonAssessment.baseline_emission_kg,
      reward: calculatedRewardTokens,
    });

    // Create reward record (AVAILABLE)
    const [reward] = await trx("rewards")
      .insert({
        user_id: userId,
        trip_id: tripId,
        amount: calculatedRewardTokens,
        status: "AVAILABLE",
        assessment_hash: assessmentHash,
      })
      .returning("*");

    return reward;
  });
}

/**
 * Get reward for a trip.
 *
 * @param {string} tripId
 * @returns {Promise<Object|null>}
 */
async function getByTripId(tripId) {
  return db("rewards").where({ trip_id: tripId }).first();
}

/**
 * Prepare claim data for frontend.
 * Validates that the reward is claimable and returns parameters
 * needed for the smart contract call.
 *
 * @param {string} tripId
 * @param {string} userId
 * @returns {Promise<Object>} claim parameters
 */
async function prepareClaim(tripId, userId) {
  const reward = await db("rewards")
    .join("users", "users.id", "rewards.user_id")
    .where({ "rewards.trip_id": tripId, "rewards.user_id": userId })
    .select("rewards.*", "users.wallet_address")
    .first();

  if (!reward) {
    throw new AppError("Reward not found.", 404, "REWARD_NOT_FOUND");
  }
  if (reward.status !== "AVAILABLE") {
    throw new AppError(
      "Reward is not claimable. Current status: " + reward.status,
      409,
      "REWARD_NOT_CLAIMABLE",
    );
  }

  const carbonAssessment = await db("carbon_assessments")
    .where({ trip_id: tripId })
    .first();
  if (!carbonAssessment) {
    throw new AppError(
      "Carbon assessment not found.",
      409,
      "ASSESSMENT_NOT_FOUND",
    );
  }

  const privateKey = config.blockchain.rewardSignerPrivateKey;
  const managerAddress = config.blockchain.rewardManagerAddress;
  if (
    !privateKey ||
    !isHex(privateKey) ||
    privateKey.length !== 66 ||
    !managerAddress
  ) {
    throw new AppError(
      "Reward claim signing is not configured.",
      503,
      "CLAIM_SIGNER_UNAVAILABLE",
    );
  }

  const recipient = getAddress(reward.wallet_address);
  const contractAddress = getAddress(managerAddress);
  const carbonKg = BigInt(
    Math.round(Number(carbonAssessment.carbon_emission_kg) * 1e4),
  );
  const baselineKg = BigInt(
    carbonAssessment.baseline_emission_kg == null
      ? 0
      : Math.round(Number(carbonAssessment.baseline_emission_kg) * 1e4),
  );
  const amount = BigInt(reward.amount);
  const policy = await blockchainService.getRewardPolicy();
  validateClaimPolicy({ amount, carbonKg, baselineKg }, policy);
  const deadline = BigInt(
    Math.floor(Date.now() / 1000) +
      config.blockchain.claimAuthorizationTtlSeconds,
  );
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signTypedData({
    domain: {
      name: "GopaxRewardManager",
      version: "1",
      chainId: chain.id,
      verifyingContract: contractAddress,
    },
    types: {
      RewardClaim: [
        { name: "recipient", type: "address" },
        { name: "assessmentHash", type: "bytes32" },
        { name: "carbonKg", type: "uint256" },
        { name: "baselineKg", type: "uint256" },
        { name: "reward", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "RewardClaim",
    message: {
      recipient,
      assessmentHash: reward.assessment_hash,
      carbonKg,
      baselineKg,
      reward: amount,
      deadline,
    },
  });

  return {
    rewardId: reward.id,
    recipient,
    contractAddress,
    chainId: chain.id,
    assessmentHash: reward.assessment_hash,
    amount: reward.amount,
    carbonKg: carbonKg.toString(),
    baselineKg: baselineKg.toString(),
    deadline: deadline.toString(),
    signature,
    signerAddress: account.address,
  };
}

async function getClaimContext(rewardId, tripId, userId) {
  const context = await db("rewards")
    .join("users", "users.id", "rewards.user_id")
    .join("carbon_assessments", "carbon_assessments.trip_id", "rewards.trip_id")
    .where({
      "rewards.id": rewardId,
      "rewards.trip_id": tripId,
      "rewards.user_id": userId,
    })
    .select(
      "rewards.*",
      "users.wallet_address",
      "carbon_assessments.carbon_emission_kg",
      "carbon_assessments.baseline_emission_kg",
    )
    .first();

  if (!context) {
    throw new AppError(
      "Reward not found for this trip.",
      404,
      "REWARD_NOT_FOUND",
    );
  }
  return context;
}

async function markClaimed({ rewardId, tripId, userId, txHash }) {
  return db.transaction(async (trx) => {
    const reward = await trx("rewards")
      .where({ id: rewardId, trip_id: tripId, user_id: userId })
      .forUpdate()
      .first();

    if (!reward) {
      throw new AppError(
        "Reward not found for this trip.",
        404,
        "REWARD_NOT_FOUND",
      );
    }
    if (reward.status === "CLAIMED") {
      if (reward.tx_hash?.toLowerCase() === txHash.toLowerCase()) return reward;
      throw new AppError(
        "Reward was already claimed by another transaction.",
        409,
        "REWARD_ALREADY_CLAIMED",
      );
    }
    if (reward.status !== "AVAILABLE") {
      throw new AppError(
        "Reward is not claimable.",
        409,
        "REWARD_NOT_CLAIMABLE",
      );
    }

    const [updated] = await trx("rewards")
      .where({
        id: rewardId,
        trip_id: tripId,
        user_id: userId,
        status: "AVAILABLE",
      })
      .update({ status: "CLAIMED", tx_hash: txHash, claimed_at: trx.fn.now() })
      .returning("*");
    return updated;
  });
}

function validateClaimPolicy(
  { amount, carbonKg, baselineKg },
  { maxReward, minReduction },
) {
  if (
    amount <= 0n ||
    amount > BigInt(maxReward) ||
    carbonKg < 0n ||
    baselineKg < 0n ||
    (baselineKg > 0n &&
      (baselineKg <= carbonKg || baselineKg - carbonKg < BigInt(minReduction)))
  ) {
    throw new AppError(
      "This reward does not meet the current on-chain policy.",
      409,
      "CLAIM_POLICY_MISMATCH",
    );
  }
}

async function retryRewardAssessment(tripId, userId) {
  const tripService = require("./trip.service");
  const proofService = require("./proof.service");
  const agentService = require("./agent.service");
  const trip = await tripService.findById(tripId, userId);
  if (!trip) throw new AppError("Trip not found.", 404, "TRIP_NOT_FOUND");
  if (!["PENDING", "VERIFIED"].includes(trip.status)) {
    throw new AppError("Trip cannot be retried.", 409, "TRIP_NOT_RETRYABLE");
  }
  if (trip.aiAssessment) return trip.reward;
  const { fileBuffer, mimeType } = await proofService.loadProofImage(
    tripId,
    userId,
  );
  if (trip.status === "PENDING") {
    const verificationService = require("./verification.service");
    const distanceService = require("./distance.service");
    const carbonService = require("./carbon.service");
    // Recover optional proof distance without inventing or accepting client-supplied values.
    const extraction = await agentService.extractTripInfo(fileBuffer, mimeType);
    const verification = verificationService.verifyExtraction(extraction);
    if (verification.status !== "VERIFIED") {
      throw new AppError(verification.reason, 422, "VERIFICATION_FAILED");
    }
    const extracted = verification.data;
    const storedDate =
      trip.travel_date instanceof Date
        ? `${trip.travel_date.getFullYear()}-${String(trip.travel_date.getMonth() + 1).padStart(2, "0")}-${String(trip.travel_date.getDate()).padStart(2, "0")}`
        : String(trip.travel_date).slice(0, 10);
    if (
      extracted.category !== trip.category ||
      extracted.origin !== trip.origin ||
      extracted.destination !== trip.destination ||
      extracted.travelDate !== storedDate
    ) {
      throw new AppError(
        "Proof extraction differs from the stored trip. No assessment was changed.",
        409,
        "EXTRACTION_CONFLICT",
      );
    }
    const proofDistance = extracted.distance;
    const distanceKm =
      proofDistance ??
      (await distanceService.resolveDistance(
        trip.category,
        trip.origin,
        trip.destination,
      ));
    const carbonData = {
      ...carbonService.assessCarbon(trip.category, distanceKm),
      distanceSource:
        proofDistance != null
          ? "PROOF_DISTANCE"
          : trip.category === "AIRPLANE"
            ? "GREAT_CIRCLE"
            : "ROUTE_ESTIMATE",
    };
    trip.carbonAssessment = await db.transaction(async (trx) => {
      const lockedTrip = await trx("trips")
        .where({ id: tripId, user_id: userId })
        .forUpdate()
        .first();
      if (!lockedTrip || !["PENDING", "VERIFIED"].includes(lockedTrip.status)) {
        throw new AppError(
          "Trip cannot be retried.",
          409,
          "TRIP_NOT_RETRYABLE",
        );
      }
      let assessment = await trx("carbon_assessments")
        .where({ trip_id: tripId })
        .first();
      if (!assessment) {
        [assessment] = await trx("carbon_assessments")
          .insert({
            trip_id: tripId,
            distance_km: carbonData.distanceKm,
            emission_factor: carbonData.emissionFactor,
            carbon_emission_kg: carbonData.carbonEmissionKg,
            baseline_emission_kg: carbonData.baselineEmissionKg,
            carbon_reduction_kg: carbonData.carbonReductionKg,
            reduction_percentage: carbonData.reductionPercentage,
            comparison_type: carbonData.comparisonType,
            comparison_category: carbonData.comparisonCategory,
            distance_source: carbonData.distanceSource,
          })
          .returning("*");
      }
      await trx("trips")
        .where({ id: tripId })
        .update({ status: "VERIFIED", updated_at: trx.fn.now() });
      return assessment;
    });
  }
  if (!trip.carbonAssessment)
    throw new AppError(
      "Carbon assessment required.",
      409,
      "ASSESSMENT_NOT_FOUND",
    );
  const carbon = trip.carbonAssessment;
  const similarTrip = await tripService.findSimilarTrip(userId, {
    category: trip.category,
    origin: trip.origin,
    destination: trip.destination,
    travelDate: trip.travel_date,
    excludeTripId: tripId,
  });
  const rewardEligibility = await agentService.assessRewardEligibility(
    {
      category: trip.category,
      origin: trip.origin,
      destination: trip.destination,
      travelDate: trip.travel_date,
      similarTripDetected: Boolean(similarTrip),
      distanceKm: carbon.distance_km,
      carbonEmissionKg: carbon.carbon_emission_kg,
      baselineEmissionKg: carbon.baseline_emission_kg,
      carbonReductionKg: carbon.carbon_reduction_kg,
      reductionPercentage: carbon.reduction_percentage,
      distanceSource: carbon.distance_source,
      comparison: carbon.comparison_type
        ? { type: carbon.comparison_type, category: carbon.comparison_category }
        : null,
    },
    fileBuffer,
    mimeType,
  );
  return processReward({
    userId,
    tripId,
    carbonAssessment: carbon,
    rewardEligibility,
  });
}

module.exports = {
  retryRewardAssessment,
  validateClaimPolicy,
  calculateRewardBreakdown,
  createAssessmentHash,
  validateRewardEligibility,
  processReward,
  getByTripId,
  prepareClaim,
  getClaimContext,
  markClaimed,
  MAX_REWARD_PER_TRIP,
};
