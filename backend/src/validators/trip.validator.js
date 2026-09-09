const { param, body } = require("express-validator");

/**
 * Validate UUID path parameter for trip ID.
 */
const tripIdParamValidation = [
  param("id").isUUID(4).withMessage("Trip ID must be a valid UUID."),
];

/**
 * Validate claim confirmation body.
 */
const confirmClaimValidation = [
  body("txHash")
    .trim()
    .notEmpty()
    .withMessage("txHash is required.")
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage("txHash must be a valid transaction hash."),
  body("rewardId").isUUID(4).withMessage("rewardId must be a valid UUID."),
];

module.exports = { tripIdParamValidation, confirmClaimValidation };
