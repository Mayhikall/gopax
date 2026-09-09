const db = require("../../db/knex");

function roundKg(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function getUserImpact(userId) {
  const tripsResult = await db("trips")
    .where({ user_id: userId, status: "VERIFIED" })
    .count("id as count")
    .first();
  const totalTrips = Number(tripsResult?.count || 0);

  const carbonResult = await db("carbon_assessments")
    .join("trips", "trips.id", "carbon_assessments.trip_id")
    .where({ "trips.user_id": userId, "trips.status": "VERIFIED" })
    .select(
      db.raw(
        "SUM(carbon_assessments.carbon_emission_kg) as total_carbon_emission_kg",
      ),
      db.raw(`COUNT(*) FILTER (
        WHERE carbon_assessments.comparison_type = 'SYSTEM'
          AND carbon_assessments.baseline_emission_kg IS NOT NULL
      ) as compared_trips`),
      db.raw(`SUM(CASE
        WHEN carbon_assessments.comparison_type = 'SYSTEM'
          AND carbon_assessments.carbon_reduction_kg > 0
        THEN carbon_assessments.carbon_reduction_kg
        ELSE 0
      END) as total_carbon_saved_kg`),
    )
    .first();

  const comparedTrips = Number(carbonResult?.compared_trips || 0);
  const totalCarbonEmissionKg = roundKg(carbonResult?.total_carbon_emission_kg);
  const totalCarbonSavedKg =
    comparedTrips === 0 ? null : roundKg(carbonResult?.total_carbon_saved_kg);

  const rewardRows = await db("rewards")
    .where({ user_id: userId })
    .groupBy("status")
    .select("status", db.raw("SUM(amount) as total"));
  const rewardTotals = Object.fromEntries(
    rewardRows.map((row) => [row.status, Number(row.total || 0)]),
  );
  const totalClaimedGopaxReward = rewardTotals.CLAIMED || 0;

  return {
    totalTrips,
    totalCarbonEmissionKg,
    totalCarbonSavedKg,
    carbonSavedCoverage: { comparedTrips, verifiedTrips: totalTrips },
    totalClaimedGopaxReward,
    totalAvailableGopaxReward: rewardTotals.AVAILABLE || 0,
    totalGopaxReward: totalClaimedGopaxReward,
  };
}

async function getTransportBreakdown(userId) {
  return db("trips")
    .where({ user_id: userId, status: "VERIFIED" })
    .groupBy("category")
    .select("category", db.raw("COUNT(id) as count"));
}

module.exports = { getUserImpact, getTransportBreakdown };
