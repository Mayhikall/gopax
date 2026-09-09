const db = require("../../db/knex");

async function createAssessment(tripId, assessment) {
  const [record] = await db("carbon_assessments")
    .insert({
      trip_id: tripId,
      distance_km: assessment.distanceKm,
      emission_factor: assessment.emissionFactor,
      carbon_emission_kg: assessment.carbonEmissionKg,
      baseline_emission_kg: assessment.baselineEmissionKg ?? null,
      carbon_reduction_kg: assessment.carbonReductionKg ?? null,
      reduction_percentage: assessment.reductionPercentage ?? null,
      comparison_type: assessment.comparisonType ?? null,
      comparison_category: assessment.comparisonCategory ?? null,
      distance_source: assessment.distanceSource ?? null,
    })
    .returning("*");
  return record;
}

async function getByTripId(tripId) {
  return db("carbon_assessments").where({ trip_id: tripId }).first();
}

module.exports = { createAssessment, getByTripId };
