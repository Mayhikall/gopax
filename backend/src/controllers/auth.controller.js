const { validationResult } = require("express-validator");
const authService = require("../services/auth.service");
const { AppError } = require("../middleware/error.middleware");

/**
 * POST /auth/nonce
 * Generate a nonce for wallet-based login.
 */
async function requestNonce(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { walletAddress } = req.body;
    const { nonce } = authService.generateAndStoreNonce(walletAddress);

    return res.json({ nonce });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/verify
 * Verify SIWE signature and issue JWT.
 */
async function verify(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message, signature } = req.body;

    // Parse SIWE message to get wallet address first
    let siweData;
    try {
      siweData = await authService.verifySiweMessage(message, signature);
    } catch (err) {
      return next(
        new AppError("Invalid signature or message.", 401, "INVALID_SIGNATURE"),
      );
    }

    // Verify nonce matches what we issued
    const storedNonce = authService.consumeNonce(siweData.address);
    if (!storedNonce || storedNonce !== siweData.nonce) {
      return next(
        new AppError("Invalid or expired nonce.", 401, "INVALID_NONCE"),
      );
    }

    // Find or create user
    const user = await authService.findOrCreateUser(siweData.address);
    const token = authService.issueToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        name: user.name,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { requestNonce, verify };
