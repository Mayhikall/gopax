const { createPublicClient, http } = require("viem");
const { bscTestnet } = require("viem/chains");
const config = require("../config");

/**
 * Determine the chain from RPC URL or default to BSC Testnet.
 */
const chain = bscTestnet;

/**
 * Public client for read-only contract interactions.
 */
let _publicClient = null;

function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain,
      transport: http(config.blockchain.rpcUrl),
    });
  }
  return _publicClient;
}

// Generated from Solidity artifacts with npm run abi:sync.
const GOPAX_TOKEN_ABI = require("../abi/GopaxToken.json");
const REWARD_MANAGER_ABI = require("../abi/RewardManager.json");

module.exports = {
  chain,
  getPublicClient,
  GOPAX_TOKEN_ABI,
  REWARD_MANAGER_ABI,
};
