/**
 * GET /auth/session
 * Returns the Gopax user created or restored by Privy authentication middleware.
 */
async function session(req, res) {
  return res.json({
    user: {
      id: req.user.id,
      walletAddress: req.user.walletAddress,
    },
  });
}

module.exports = { session };
