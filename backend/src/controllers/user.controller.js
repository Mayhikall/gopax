const { validationResult } = require("express-validator");
const userService = require("../services/user.service");
const { AppError } = require("../middleware/error.middleware");

/**
 * POST /users
 * Create or update user profile (name).
 * Wallet is derived from JWT.
 */
async function createProfile(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;
    const userId = req.user.id;

    const user = await userService.updateName(userId, name);

    return res.json({
      id: user.id,
      walletAddress: user.wallet_address,
      name: user.name,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /users/me
 * Get current authenticated user profile.
 */
async function getProfile(req, res, next) {
  try {
    const user = await userService.getById(req.user.id);

    if (!user) {
      return next(new AppError("User not found.", 404, "USER_NOT_FOUND"));
    }

    return res.json({
      id: user.id,
      walletAddress: user.wallet_address,
      name: user.name,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createProfile, getProfile };
