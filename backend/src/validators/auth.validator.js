const { body } = require("express-validator");

/**
 * Validate Ethereum wallet address format (0x + 40 hex chars).
 */
const walletAddressRule = body("walletAddress")
  .trim()
  .notEmpty()
  .withMessage("walletAddress is required.")
  .matches(/^0x[a-fA-F0-9]{40}$/)
  .withMessage("walletAddress must be a valid Ethereum address.");

/**
 * Validation rules for POST /auth/nonce
 */
const nonceValidation = [walletAddressRule];

/**
 * Validation rules for POST /auth/verify
 */
const verifyValidation = [
  body("message").trim().notEmpty().withMessage("message is required."),
  body("signature")
    .trim()
    .notEmpty()
    .withMessage("signature is required.")
    .matches(/^0x[a-fA-F0-9]+$/)
    .withMessage("signature must be a valid hex string."),
];

module.exports = { nonceValidation, verifyValidation };
