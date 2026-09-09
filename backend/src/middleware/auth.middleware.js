const jwt = require("jsonwebtoken");
const config = require("../config");
const { AppError } = require("./error.middleware");

/**
 * Middleware to authenticate requests using JWT Bearer token.
 * Attaches decoded user payload to req.user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Authentication required.", 401, "UNAUTHORIZED"));
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded; // { id, walletAddress, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Token expired.", 401, "TOKEN_EXPIRED"));
    }
    return next(new AppError("Invalid token.", 401, "INVALID_TOKEN"));
  }
}

module.exports = { authenticate };
