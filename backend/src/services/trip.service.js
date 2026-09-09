const db = require("../../db/knex");

async function createTrip({
  userId,
  category,
  origin,
  destination,
  travelDate,
}) {
  const [trip] = await db("trips")
    .insert({
      user_id: userId,
      category,
      origin,
      destination,
      travel_date: travelDate,
      status: "PENDING",
    })
    .returning("*");
  return trip;
}

async function updateStatus(tripId, status) {
  const [trip] = await db("trips")
    .where({ id: tripId })
    .update({ status, updated_at: db.fn.now() })
    .returning("*");
  return trip;
}

function mapTripSummary(row) {
  return {
    id: row.id,
    category: row.category,
    origin: row.origin,
    destination: row.destination,
    travelDate: row.travelDate,
    status: row.status,
    createdAt: row.createdAt,
    distanceKm: row.distanceKm ?? null,
    carbonEmissionKg: row.carbonEmissionKg ?? null,
    carbonReductionKg: row.carbonReductionKg ?? null,
    reductionPercentage: row.reductionPercentage ?? null,
    comparison:
      row.comparisonType && row.comparisonCategory
        ? { type: row.comparisonType, category: row.comparisonCategory }
        : null,
    distanceSource: row.distanceSource ?? null,
    aiDecision: row.aiDecision ?? null,
    reward: row.rewardId
      ? {
          id: row.rewardId,
          amount: row.rewardAmount,
          status: row.rewardStatus,
          txHash: row.txHash ?? null,
        }
      : null,
  };
}

async function findByUser(
  userId,
  { limit = 20, offset = 0, category = null, rewardStatus = null } = {},
) {
  const query = db("trips")
    .leftJoin("carbon_assessments", "carbon_assessments.trip_id", "trips.id")
    .leftJoin("ai_assessments", "ai_assessments.trip_id", "trips.id")
    .leftJoin("rewards", "rewards.trip_id", "trips.id")
    .where("trips.user_id", userId)
    .select(
      "trips.id",
      "trips.category",
      "trips.origin",
      "trips.destination",
      "trips.travel_date as travelDate",
      "trips.status",
      "trips.created_at as createdAt",
      "carbon_assessments.distance_km as distanceKm",
      "carbon_assessments.carbon_emission_kg as carbonEmissionKg",
      "carbon_assessments.carbon_reduction_kg as carbonReductionKg",
      "carbon_assessments.reduction_percentage as reductionPercentage",
      "carbon_assessments.comparison_type as comparisonType",
      "carbon_assessments.comparison_category as comparisonCategory",
      "carbon_assessments.distance_source as distanceSource",
      "ai_assessments.decision as aiDecision",
      "rewards.id as rewardId",
      "rewards.amount as rewardAmount",
      "rewards.status as rewardStatus",
      "rewards.tx_hash as txHash",
    )
    .orderBy("trips.created_at", "desc")
    .limit(limit + 1)
    .offset(offset);

  if (category) query.where("trips.category", category);
  if (rewardStatus) query.where("rewards.status", rewardStatus);

  const rows = await query;
  const hasMore = rows.length > limit;
  return {
    trips: rows.slice(0, limit).map(mapTripSummary),
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
}

async function findById(tripId, userId) {
  const trip = await db("trips")
    .where({ "trips.id": tripId, "trips.user_id": userId })
    .first();

  if (!trip) return null;

  const [carbonAssessment, aiAssessment, reward] = await Promise.all([
    db("carbon_assessments").where({ trip_id: tripId }).first(),
    db("ai_assessments").where({ trip_id: tripId }).first(),
    db("rewards").where({ trip_id: tripId }).first(),
  ]);

  return {
    ...trip,
    carbonAssessment: carbonAssessment || null,
    aiAssessment: aiAssessment || null,
    reward: reward || null,
  };
}

async function findSimilarTrip(
  userId,
  { category, origin, destination, travelDate, excludeTripId },
) {
  return db("trips")
    .where({ user_id: userId, category, travel_date: travelDate })
    .whereRaw("LOWER(origin) = ?", [origin.toLowerCase()])
    .whereRaw("LOWER(destination) = ?", [destination.toLowerCase()])
    .modify((query) => {
      if (excludeTripId) query.whereNot("id", excludeTripId);
    })
    .whereNot("status", "REJECTED")
    .first();
}

module.exports = {
  createTrip,
  updateStatus,
  findByUser,
  findById,
  findSimilarTrip,
};
