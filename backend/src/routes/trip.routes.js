const { Router } = require("express");
const tripController = require("../controllers/trip.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload.middleware");
const {
  tripIdParamValidation,
  confirmClaimValidation,
} = require("../validators/trip.validator");

const router = Router();

// All trip routes require authentication
router.use(authenticate);

/**
 * POST /trips
 * Upload proof file and initiate trip processing pipeline.
 */
router.post("/", upload.single("proof"), tripController.createTrip);

/**
 * GET /trips
 * List user's trips (paginated via ?limit=&offset=).
 */
router.get("/", tripController.listTrips);

/**
 * GET /trips/:id
 * Get full trip detail with carbon assessment and reward.
 */
router.post(
  "/:id/assessment/retry",
  tripIdParamValidation,
  tripController.retryRewardAssessment,
);

router.get("/:id", tripIdParamValidation, tripController.getTripDetail);

/**
 * POST /trips/:id/claim
 * Prepare claim parameters (smart contract call params for frontend).
 */
router.post("/:id/claim", tripIdParamValidation, tripController.claimReward);

/**
 * POST /trips/:id/claim/confirm
 * Confirm claim transaction after user wallet signs and broadcasts.
 */
router.post(
  "/:id/claim/confirm",
  tripIdParamValidation,
  confirmClaimValidation,
  tripController.confirmClaim,
);

module.exports = router;
