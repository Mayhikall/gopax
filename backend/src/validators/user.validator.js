const { body } = require("express-validator");

/**
 * Validation rules for POST /users
 */
const profileValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("name is required.")
    .isLength({ min: 1, max: 100 })
    .withMessage("name must be between 1 and 100 characters."),
];

module.exports = { profileValidation };
