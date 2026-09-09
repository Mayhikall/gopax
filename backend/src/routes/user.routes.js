const { Router } = require("express");
const userController = require("../controllers/user.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { profileValidation } = require("../validators/user.validator");

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * POST /users
 * Create or update user profile.
 */
router.post("/", profileValidation, userController.createProfile);

/**
 * GET /users/me
 * Get current user profile.
 */
router.get("/me", userController.getProfile);

module.exports = router;
