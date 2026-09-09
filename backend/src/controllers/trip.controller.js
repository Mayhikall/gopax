const { validationResult } = require("express-validator");
const tripService = require("../services/trip.service");
const proofService = require("../services/proof.service");
const verificationService = require("../services/verification.service");
const distanceService = require("../services/distance.service");
const carbonService = require("../services/carbon.service");
const carbonAssessmentService = require("../services/carbon-assessment.service");
const agentService = require("../services/agent.service");
const rewardService = require("../services/reward.service");
const blockchainService = require("../services/blockchain.service");
const { AppError } = require("../middleware/error.middleware");

/**
 * POST /trips
 * Upload proof and kick off the full trip pipeline:
 * upload → extract → verify → distance → carbon → AI reward
 */
async function createTrip(req, res, next) {
  const userId = req.user.id;

  // File must be present (multer handles upload)
  if (!req.file) {
    return next(new AppError("Proof file is required.", 400, "FILE_REQUIRED"));
  }

  const { buffer: fileBuffer, mimetype: mimeType } = req.file;
  try {
    proofService.validateProofImage(fileBuffer, mimeType);
  } catch (error) {
    return next(error);
  }

  // Create a placeholder trip first (we'll update it after extraction)
  let trip;

  try {
    // ── Step 1: Extract trip info via AI agent ─────────────────────────────
    let extraction;
    try {
      extraction = await agentService.extractTripInfo(fileBuffer, mimeType);
    } catch (agentErr) {
      console.error("[trip] AI extraction failed:", agentErr.message);
      return next(
        new AppError(
          "We couldn't verify this trip proof. Please upload a valid ticket or receipt.",
          422,
          "EXTRACTION_FAILED",
        ),
      );
    }

    // ── Step 2: Verify extraction ─────────────────────────────────────────
    const verification = verificationService.verifyExtraction(extraction);

    if (verification.status === "REJECTED") {
      return next(
        new AppError(verification.reason, 422, "VERIFICATION_FAILED"),
      );
    }

    const { category, origin, destination, travelDate } = verification.data;

    // ── Step 3: Create trip record ─────────────────────────────────────────
    trip = await tripService.createTrip({
      userId,
      category,
      origin,
      destination,
      travelDate,
    });

    // ── Step 4: Process and store proof ───────────────────────────────────
    await proofService.processAndStoreProof({
      fileBuffer,
      mimeType,
      userId,
      tripId: trip.id,
    });

    // ── Step 5: Semantic duplicate check ──────────────────────────────────
    const similarTrip = await tripService.findSimilarTrip(userId, {
      excludeTripId: trip.id,
      category,
      origin,
      destination,
      travelDate,
    });

    if (similarTrip && similarTrip.id !== trip.id) {
      // Log as warning but don't block — it's a signal, not hard block per PRD
      console.warn(
        `[trip] Semantic duplicate detected for user ${userId}: trip ${similarTrip.id}`,
      );
    }

    // ── Step 6: Resolve distance ───────────────────────────────────────────
    let distanceKm;
    let distanceSource;
    try {
      // Use extracted distance for TRAIN if available
      if (category === "TRAIN" && verification.data.distance) {
        distanceKm = parseFloat(verification.data.distance);
        distanceSource = "PROOF_DISTANCE";
      } else {
        distanceKm = await distanceService.resolveDistance(
          category,
          origin,
          destination,
        );
        distanceSource =
          category === "AIRPLANE" ? "GREAT_CIRCLE" : "ROUTE_ESTIMATE";
      }
    } catch (distErr) {
      // Evidence is retained; provider errors are not evidence rejection.
      return res.status(202).json({
        trip: {
          id: trip.id,
          category,
          origin,
          destination,
          travelDate,
          status: "PENDING",
        },
        reward: null,
        aiDecision: null,
        aiReason: null,
        processingError: {
          code: distErr.code || "DISTANCE_UNAVAILABLE",
          message: distErr.message,
        },
        retryEndpoint: `/trips/${trip.id}/assessment/retry`,
      });
    }

    // ── Step 7: Calculate carbon ───────────────────────────────────────────
    const carbonData = {
      ...carbonService.assessCarbon(category, distanceKm),
      distanceSource,
    };

    // ── Step 8: Store carbon assessment ───────────────────────────────────
    const carbonAssessment = await carbonAssessmentService.createAssessment(
      trip.id,
      carbonData,
    );

    // ── Step 9: Update trip to VERIFIED ───────────────────────────────────
    await tripService.updateStatus(trip.id, "VERIFIED");

    // ── Step 10: Get AI reward decision & reasoning ─────────────────────
    let rewardEligibility;
    try {
      rewardEligibility = await agentService.assessRewardEligibility(
        {
          category,
          origin,
          destination,
          travelDate,
          similarTripDetected: Boolean(
            similarTrip && similarTrip.id !== trip.id,
          ),
          distanceKm: carbonData.distanceKm,
          carbonEmissionKg: carbonData.carbonEmissionKg,
          baselineEmissionKg: carbonData.baselineEmissionKg,
          comparison: carbonData.comparisonType
            ? {
                type: carbonData.comparisonType,
                category: carbonData.comparisonCategory,
              }
            : null,
          distanceSource: carbonData.distanceSource,
          carbonReductionKg: carbonData.carbonReductionKg,
          reductionPercentage: carbonData.reductionPercentage,
        },
        fileBuffer,
        mimeType,
      );
    } catch (agentErr) {
      // Fail closed: carbon remains available, but no reward is issued.
      rewardEligibility = null;
    }

    // ── Step 11: Process reward ────────────────────────────────────────────
    const reward = rewardEligibility
      ? await rewardService.processReward({
          userId,
          tripId: trip.id,
          carbonAssessment,
          rewardEligibility,
        })
      : null;

    return res.status(201).json({
      trip: {
        id: trip.id,
        category,
        origin,
        destination,
        travelDate,
        status: "VERIFIED",
        distanceKm: carbonData.distanceKm,
        carbonEmissionKg: carbonData.carbonEmissionKg,
        carbonReductionKg: carbonData.carbonReductionKg,
        reductionPercentage: carbonData.reductionPercentage,
        baselineEmissionKg: carbonData.baselineEmissionKg,
        comparison: carbonData.comparisonType
          ? {
              type: carbonData.comparisonType,
              category: carbonData.comparisonCategory,
            }
          : null,
        distanceSource: carbonData.distanceSource,
      },
      reward: reward
        ? {
            id: reward.id,
            amount: reward.amount,
            status: reward.status,
            assessmentHash: reward.assessment_hash,
          }
        : null,
      aiDecision: rewardEligibility?.decision ?? null,
      aiReason: rewardEligibility?.reason ?? null,
    });
  } catch (err) {
    // Only explicit evidence rejection should mark a trip rejected.
    if (
      trip &&
      [
        "DUPLICATE_PROOF",
        "VERIFICATION_FAILED",
        "UNSUPPORTED_FILE_TYPE",
      ].includes(err.code)
    ) {
      try {
        await tripService.updateStatus(trip.id, "REJECTED");
      } catch (_) {}
    }
    next(err);
  }
}

/**
 * GET /trips
 * List authenticated user's trips.
 */
async function listTrips(req, res, next) {
  try {
    const userId = req.user.id;
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100,
    );
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    const category = req.query.category || null;
    const rewardStatus = req.query.rewardStatus || null;
    const categories = ["BUS", "MOTORCYCLE", "CAR", "TRAIN", "AIRPLANE"];
    const rewardStatuses = ["AVAILABLE", "CLAIMED", "FAILED"];
    if (category && !categories.includes(category)) {
      throw new AppError(
        "Invalid transport category.",
        400,
        "INVALID_CATEGORY",
      );
    }
    if (rewardStatus && !rewardStatuses.includes(rewardStatus)) {
      throw new AppError(
        "Invalid reward status.",
        400,
        "INVALID_REWARD_STATUS",
      );
    }

    const result = await tripService.findByUser(userId, {
      limit,
      offset,
      category,
      rewardStatus,
    });

    return res.json({ ...result, limit, offset });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /trips/:id
 * Get trip detail with assessments and reward.
 */
async function getTripDetail(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const trip = await tripService.findById(id, userId);

    if (!trip) {
      return next(new AppError("Trip not found.", 404, "TRIP_NOT_FOUND"));
    }

    const { carbonAssessment, aiAssessment, reward, ...tripData } = trip;

    return res.json({
      id: tripData.id,
      category: tripData.category,
      origin: tripData.origin,
      destination: tripData.destination,
      travelDate: tripData.travel_date,
      status: tripData.status,
      createdAt: tripData.created_at,
      distanceKm: carbonAssessment?.distance_km ?? null,
      carbonEmissionKg: carbonAssessment?.carbon_emission_kg ?? null,
      carbonReductionKg: carbonAssessment?.carbon_reduction_kg ?? null,
      reductionPercentage: carbonAssessment?.reduction_percentage ?? null,
      baselineEmissionKg: carbonAssessment?.baseline_emission_kg ?? null,
      comparison:
        carbonAssessment?.comparison_type &&
        carbonAssessment?.comparison_category
          ? {
              type: carbonAssessment.comparison_type,
              category: carbonAssessment.comparison_category,
            }
          : null,
      distanceSource: carbonAssessment?.distance_source ?? null,
      aiDecision: aiAssessment?.decision || null,
      aiReason: aiAssessment?.reason || null,
      reward: reward
        ? {
            id: reward.id,
            amount: reward.amount,
            status: reward.status,
            assessmentHash: reward.assessment_hash,
            txHash: reward.tx_hash,
            claimedAt: reward.claimed_at,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /trips/:id/claim
 * Prepare claim parameters for the smart contract call.
 * The actual transaction is signed by the user's wallet, not the backend.
 */
async function claimReward(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id: tripId } = req.params;
    const userId = req.user.id;

    // Validate trip exists and belongs to user
    const trip = await tripService.findById(tripId, userId);
    if (!trip) {
      return next(new AppError("Trip not found.", 404, "TRIP_NOT_FOUND"));
    }

    if (trip.status !== "VERIFIED") {
      return next(
        new AppError(
          "Trip must be verified before claiming reward.",
          409,
          "TRIP_NOT_VERIFIED",
        ),
      );
    }

    // Get claim parameters
    const claimParams = await rewardService.prepareClaim(tripId, userId);
    await blockchainService.assertAuthorizedSigner(claimParams.signerAddress);

    // Optionally check on-chain if already claimed
    const alreadyClaimed = await blockchainService.isAssessmentClaimed(
      claimParams.assessmentHash,
    );

    if (alreadyClaimed) {
      return next(
        new AppError(
          "This reward has already been claimed on-chain.",
          409,
          "ALREADY_CLAIMED",
        ),
      );
    }

    return res.json({
      message: "Claim parameters ready. Sign the transaction with your wallet.",
      claimParams,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /trips/:id/claim/confirm
 * After user signs and broadcasts the transaction, frontend confirms tx_hash.
 * Backend verifies transaction and updates reward status.
 */
async function confirmClaim(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id: tripId } = req.params;
    const userId = req.user.id;
    const { txHash, rewardId } = req.body;
    const context = await rewardService.getClaimContext(
      rewardId,
      tripId,
      userId,
    );
    const carbonKg = Math.round(Number(context.carbon_emission_kg) * 1e4);
    const baselineKg =
      context.baseline_emission_kg == null
        ? 0
        : Math.round(Number(context.baseline_emission_kg) * 1e4);

    await blockchainService.verifyRewardClaim({
      txHash,
      walletAddress: context.wallet_address,
      assessmentHash: context.assessment_hash,
      carbonKg,
      baselineKg,
      reward: context.amount,
    });

    const reward = await rewardService.markClaimed({
      rewardId,
      tripId,
      userId,
      txHash,
    });

    return res.json({
      message: "Reward successfully claimed!",
      reward: {
        id: reward.id,
        amount: reward.amount,
        status: reward.status,
        txHash: reward.tx_hash,
        claimedAt: reward.claimed_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Retry only a missing reward assessment; reuse the stored private proof. */
async function retryRewardAssessment(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    await rewardService.retryRewardAssessment(req.params.id, req.user.id);
    return getTripDetail(req, res, next);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  retryRewardAssessment,
  createTrip,
  listTrips,
  getTripDetail,
  claimReward,
  confirmClaim,
};
