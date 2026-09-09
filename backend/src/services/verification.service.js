const { AppError } = require("../middleware/error.middleware");

const VALID_CATEGORIES = ["BUS", "MOTORCYCLE", "CAR", "TRAIN", "AIRPLANE"];

/**
 * Validate extracted trip data from AI proof reading.
 *
 * @param {Object} extraction - Result from AI extraction
 * @returns {{ valid: boolean, reason?: string, normalizedData?: Object }}
 */
function validateExtraction(extraction) {
  if (!extraction || typeof extraction !== "object") {
    return { valid: false, reason: "No extraction data provided." };
  }

  const { category, origin, destination, travel_date } = extraction;

  // Required: category
  if (
    typeof category !== "string" ||
    !VALID_CATEGORIES.includes(category.toUpperCase())
  ) {
    return {
      valid: false,
      reason: `Invalid or missing transport category. Expected one of: ${VALID_CATEGORIES.join(", ")}.`,
    };
  }

  // Required: origin
  if (!origin || typeof origin !== "string" || origin.trim().length === 0) {
    return { valid: false, reason: "Missing trip origin." };
  }

  // Required: destination
  if (
    !destination ||
    typeof destination !== "string" ||
    destination.trim().length === 0
  ) {
    return { valid: false, reason: "Missing trip destination." };
  }

  // Required: travel_date
  if (
    typeof travel_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(travel_date)
  ) {
    return { valid: false, reason: "Missing travel date." };
  }

  // Validate date format
  const dateObj = new Date(travel_date);
  if (
    isNaN(dateObj.getTime()) ||
    dateObj.toISOString().slice(0, 10) !== travel_date
  ) {
    return { valid: false, reason: "Invalid travel date format." };
  }

  if (
    extraction.distance != null &&
    (typeof extraction.distance !== "number" ||
      !Number.isFinite(extraction.distance) ||
      extraction.distance <= 0)
  ) {
    return {
      valid: false,
      reason: "Distance must be a positive number in kilometers.",
    };
  }
  return {
    valid: true,
    normalizedData: {
      category: category.toUpperCase(),
      origin: origin.trim(),
      destination: destination.trim(),
      travelDate: dateObj.toISOString().split("T")[0], // YYYY-MM-DD
      distance: extraction.distance || null, // optional
    },
  };
}

/**
 * Full verification service entry point.
 * Takes AI extraction result and validates it.
 *
 * @param {Object} extraction - AI-extracted trip data
 * @returns {{ status: 'VERIFIED'|'REJECTED', reason?: string, data?: Object }}
 */
function verifyExtraction(extraction) {
  const result = validateExtraction(extraction);

  if (!result.valid) {
    return {
      status: "REJECTED",
      reason:
        result.reason ||
        "We couldn't verify this trip proof. Please upload a valid ticket or receipt.",
    };
  }

  return {
    status: "VERIFIED",
    data: result.normalizedData,
  };
}

module.exports = { validateExtraction, verifyExtraction, VALID_CATEGORIES };
