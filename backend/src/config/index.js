require("dotenv").config();

const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    name: process.env.DB_NAME || "gopax",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  siwe: {
    domain: process.env.SIWE_DOMAIN || "localhost",
    uri: process.env.SIWE_URI || "http://localhost:3000",
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || "trip-proofs",
  },

  blockchain: {
    rpcUrl: process.env.RPC_URL || "https://bsc-testnet-dataseed.bnbchain.org",
    gopaxTokenAddress: process.env.GOPAX_TOKEN_ADDRESS,
    rewardManagerAddress: process.env.REWARD_MANAGER_ADDRESS,
    rewardSignerPrivateKey: process.env.REWARD_SIGNER_PRIVATE_KEY,
    claimAuthorizationTtlSeconds: parseInt(
      process.env.CLAIM_AUTHORIZATION_TTL_SECONDS || "900",
      10,
    ),
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
};

/**
 * Validate required environment variables on startup.
 * Only warn in development, throw in production.
 */
function validateConfig() {
  const required = ["JWT_SECRET", "DB_USER", "DB_NAME"];
  if (config.nodeEnv === "production") {
    required.push(
      "RPC_URL",
      "GOPAX_TOKEN_ADDRESS",
      "REWARD_MANAGER_ADDRESS",
      "REWARD_SIGNER_PRIVATE_KEY",
    );
  }
  const missing = required.filter((key) => !process.env[key]);
  if (
    !Number.isInteger(config.blockchain.claimAuthorizationTtlSeconds) ||
    config.blockchain.claimAuthorizationTtlSeconds <= 0
  ) {
    throw new Error(
      "CLAIM_AUTHORIZATION_TTL_SECONDS must be a positive integer.",
    );
  }

  if (missing.length > 0) {
    const msg = `Missing required configuration: ${missing.join(", ")}`;
    if (config.nodeEnv === "production") {
      throw new Error(msg);
    } else {
      console.warn(`[config] WARNING: ${msg}`);
    }
  }
}

validateConfig();

module.exports = config;
