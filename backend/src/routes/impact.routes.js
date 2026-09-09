const { Router } = require("express");
const impactController = require("../controllers/impact.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = Router();

router.use(authenticate);

/**
 * GET /impact
 * Aggregated carbon impact for the authenticated user.
 */
router.get("/", impactController.getImpact);

module.exports = router;
