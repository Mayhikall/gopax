const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const {
  nonceValidation,
  verifyValidation,
} = require("../validators/auth.validator");

const router = Router();

/**
 * POST /auth/nonce
 * Generate a nonce for SIWE authentication.
 */
router.post("/nonce", nonceValidation, authController.requestNonce);

/**
 * POST /auth/verify
 * Verify SIWE signature and issue JWT.
 */
router.post("/verify", verifyValidation, authController.verify);

module.exports = router;
