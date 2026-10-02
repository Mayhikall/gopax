const { InvalidAuthTokenError } = require("@privy-io/node");
const authService = require("../services/auth.service");
const { AppError } = require("./error.middleware");

/**
 * Verifies a Privy access token and maps it to the canonical Gopax user.
 */
async function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Authentication required.", 401, "UNAUTHORIZED"));
  }

  try {
    req.user = await authService.authenticateAccessToken(authHeader.slice(7));
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    if (error instanceof InvalidAuthTokenError) {
      return next(
        new AppError("Invalid or expired token.", 401, "INVALID_TOKEN"),
      );
    }
    return next(error);
  }
}

module.exports = { authenticate };
