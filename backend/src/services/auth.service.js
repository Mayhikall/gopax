const {
  SiweMessage,
  generateNonce,
  configure,
  createConfig,
} = require("@signinwithethereum/siwe");
const jwt = require("jsonwebtoken");
const config = require("../config");
const db = require("../../db/knex");

/**
 * In-memory nonce store with TTL.
 * Maps walletAddress (lowercase) → { nonce, expiresAt }
 *
 * In production, replace with Redis for multi-instance support.
 */
const nonceStore = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize SIWE with viem backend.
 * Called once at startup.
 */
let siweConfigured = false;
async function initSiwe() {
  if (!siweConfigured) {
    const rpcConfig = await createConfig(config.blockchain.rpcUrl);
    configure(rpcConfig);
    siweConfigured = true;
  }
}

/**
 * Clean up expired nonces periodically.
 */
function cleanExpiredNonces() {
  const now = Date.now();
  for (const [key, value] of nonceStore.entries()) {
    if (value.expiresAt < now) {
      nonceStore.delete(key);
    }
  }
}
setInterval(cleanExpiredNonces, 60 * 1000); // every 1 minute

/**
 * Generate and store a nonce for a wallet address.
 *
 * @param {string} walletAddress - Ethereum wallet address
 * @returns {{ nonce: string }}
 */
function generateAndStoreNonce(walletAddress) {
  const nonce = generateNonce();
  const key = walletAddress.toLowerCase();

  nonceStore.set(key, {
    nonce,
    expiresAt: Date.now() + NONCE_TTL_MS,
  });

  return { nonce };
}

/**
 * Retrieve and consume a nonce for a wallet address.
 * Returns null if nonce is invalid or expired.
 *
 * @param {string} walletAddress
 * @returns {string|null} nonce
 */
function consumeNonce(walletAddress) {
  const key = walletAddress.toLowerCase();
  const entry = nonceStore.get(key);

  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    nonceStore.delete(key);
    return null;
  }

  nonceStore.delete(key); // Single use
  return entry.nonce;
}

/**
 * Verify a SIWE message and signature.
 * Returns the parsed SIWE message data on success.
 *
 * @param {string} message - EIP-4361 formatted message string
 * @param {string} signature - Hex signature
 * @returns {Promise<{ address: string, nonce: string, chainId: number }>}
 */
async function verifySiweMessage(message, signature) {
  await initSiwe();

  const siweMessage = new SiweMessage(message);
  const { success, data, error } = await siweMessage.verify(
    {
      signature,
      domain: config.siwe.domain,
      nonce: siweMessage.nonce,
    },
    { suppressExceptions: true },
  );

  if (!success) {
    throw new Error(error?.message || "SIWE verification failed");
  }

  return data;
}

/**
 * Find existing user or create one from wallet address.
 *
 * @param {string} walletAddress
 * @returns {Promise<Object>} user record
 */
async function findOrCreateUser(walletAddress) {
  const address = walletAddress.toLowerCase();

  let user = await db("users").where({ wallet_address: address }).first();

  if (!user) {
    const [newUser] = await db("users")
      .insert({
        wallet_address: address,
      })
      .returning("*");
    user = newUser;
  }

  return user;
}

/**
 * Issue a JWT for a user.
 *
 * @param {{ id: string, wallet_address: string }} user
 * @returns {string} JWT token
 */
function issueToken(user) {
  return jwt.sign(
    {
      id: user.id,
      walletAddress: user.wallet_address,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

module.exports = {
  generateAndStoreNonce,
  consumeNonce,
  verifySiweMessage,
  findOrCreateUser,
  issueToken,
};
