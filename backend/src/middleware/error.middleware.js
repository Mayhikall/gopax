/**
 * Custom application error with HTTP status code.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {string} [code] - Optional machine-readable error code
   */
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware.
 * Must have 4 parameters to be recognized by Express as error handler.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, next) {
  // Express validation errors (express-validator)
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Invalid JSON in request body.",
      code: "INVALID_JSON",
    });
  }

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "File size exceeds limit (10MB).",
      code: "FILE_TOO_LARGE",
    });
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      error: "Unexpected file field.",
      code: "UNEXPECTED_FILE",
    });
  }

  // Custom application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  // PostgreSQL unique constraint violation
  if (err.code === "23505") {
    return res.status(409).json({
      error: "Resource already exists.",
      code: "DUPLICATE",
    });
  }

  // Unhandled errors
  const isDev = process.env.NODE_ENV === "development";
  console.error("[error]", err);

  return res.status(500).json({
    error: "An unexpected error occurred.",
    code: "INTERNAL_ERROR",
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = { AppError, errorHandler };
