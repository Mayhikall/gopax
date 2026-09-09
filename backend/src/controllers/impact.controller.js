const impactService = require("../services/impact.service");

/**
 * GET /impact
 * Get aggregated carbon impact statistics for the authenticated user.
 */
async function getImpact(req, res, next) {
  try {
    const userId = req.user.id;

    const [impact, breakdown] = await Promise.all([
      impactService.getUserImpact(userId),
      impactService.getTransportBreakdown(userId),
    ]);

    return res.json({
      ...impact,
      transportBreakdown: breakdown.map((row) => ({
        category: row.category,
        count: parseInt(row.count),
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getImpact };
