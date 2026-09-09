/**
 * Gopax — Deterministic Carbon Calculation Service
 *
 * All emission factors are fixed per PRD (sections 18-19).
 * AI does NOT determine emission factors.
 *
 * Sources:
 * - MOTORCYCLE: 0.082 kgCO₂e/km (Kalkulator Hijau BI v2)
 * - CAR: 0.235 kgCO₂e/km (sedan RON92, Kalkulator Hijau BI v2)
 * - BUS: 0.03 kgCO₂e/passenger-km (legacy DNPI bus kota)
 * - TRAIN: 0.01219 kgCO₂e/passenger-km (KAI Economy, Kalkulator Hijau BI v2)
 * - AIRPLANE: tiered by distance (domestic economy)
 */

// ─── Fixed Emission Factors ────────────────────────────────────────────────────

const EMISSION_FACTORS = {
  MOTORCYCLE: 0.082,
  CAR: 0.235,
  BUS: 0.03,
  TRAIN: 0.01219,
};

// Airplane: tiered by distance range (km)
const AIRPLANE_FACTORS = [
  { maxDistance: 926, factor: 0.12 }, // Short haul: < 926 km
  { maxDistance: 1852, factor: 0.089 }, // Medium haul: 926–1852 km
  { maxDistance: Infinity, factor: 0.078 }, // Long haul: > 1852 km
];

/**
 * Get emission factor for a category and distance.
 *
 * @param {string} category
 * @param {number} distanceKm
 * @returns {number} emission factor
 */
function getEmissionFactor(category, distanceKm) {
  if (category === "AIRPLANE") {
    if (distanceKm < AIRPLANE_FACTORS[0].maxDistance) {
      return AIRPLANE_FACTORS[0].factor;
    }
    if (distanceKm <= AIRPLANE_FACTORS[1].maxDistance) {
      return AIRPLANE_FACTORS[1].factor;
    }
    return AIRPLANE_FACTORS[2].factor;
  }

  const factor = EMISSION_FACTORS[category];
  if (factor === undefined) {
    throw new Error(`Unknown transport category: ${category}`);
  }
  return factor;
}

/**
 * Calculate carbon emission for a trip.
 *
 * @param {string} category - BUS | MOTORCYCLE | CAR | TRAIN | AIRPLANE
 * @param {number} distanceKm
 * @returns {{ distanceKm: number, emissionFactor: number, carbonEmissionKg: number }}
 */
function calculateCarbon(category, distanceKm) {
  if (
    typeof distanceKm !== "number" ||
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0
  ) {
    throw new Error("Distance must be a positive finite number in kilometers.");
  }
  const emissionFactor = getEmissionFactor(category, distanceKm);
  const carbonEmissionKg =
    Math.round(distanceKm * emissionFactor * 10000) / 10000;

  return {
    distanceKm,
    emissionFactor,
    carbonEmissionKg,
  };
}

/**
 * Calculate baseline emission for comparison.
 * Default comparison is against CAR (as the most common personal vehicle).
 *
 * Only applies if actual category is NOT CAR and NOT MOTORCYCLE
 * (no meaningful comparison for those).
 *
 * @param {string} actualCategory
 * @param {number} distanceKm
 * @returns {number|null} baseline emission kg, or null if no valid comparison
 */
function calculateBaseline(actualCategory, distanceKm) {
  // A car comparison is valid only for supported land public transport routes.
  if (!["BUS", "TRAIN"].includes(actualCategory)) {
    return null;
  }

  return Math.round(distanceKm * EMISSION_FACTORS.CAR * 10000) / 10000;
}

/**
 * Calculate CO₂ reduction vs baseline.
 * Returns null if no valid comparison per PRD rule.
 *
 * @param {number} actualEmission
 * @param {number|null} baselineEmission
 * @returns {{ carbonReductionKg: number|null, reductionPercentage: number|null }}
 */
function calculateReduction(actualEmission, baselineEmission) {
  if (
    baselineEmission === null ||
    baselineEmission === undefined ||
    baselineEmission <= 0
  ) {
    return { carbonReductionKg: null, reductionPercentage: null };
  }

  const carbonReductionKg =
    Math.round((baselineEmission - actualEmission) * 10000) / 10000;
  const reductionPercentage =
    Math.round(
      ((baselineEmission - actualEmission) / baselineEmission) * 100 * 100,
    ) / 100;

  return { carbonReductionKg, reductionPercentage };
}

/**
 * Full carbon assessment for a trip.
 *
 * @param {string} category
 * @param {number} distanceKm
 * @returns {{
 *   distanceKm: number,
 *   emissionFactor: number,
 *   carbonEmissionKg: number,
 *   baselineEmissionKg: number|null,
 *   carbonReductionKg: number|null,
 *   reductionPercentage: number|null
 * }}
 */
function assessCarbon(category, distanceKm) {
  const { emissionFactor, carbonEmissionKg } = calculateCarbon(
    category,
    distanceKm,
  );
  const baselineEmissionKg = calculateBaseline(category, distanceKm);
  const { carbonReductionKg, reductionPercentage } = calculateReduction(
    carbonEmissionKg,
    baselineEmissionKg,
  );

  return {
    distanceKm,
    emissionFactor,
    carbonEmissionKg,
    baselineEmissionKg,
    carbonReductionKg,
    comparisonType: baselineEmissionKg == null ? null : "SYSTEM",
    comparisonCategory: baselineEmissionKg == null ? null : "CAR",
    reductionPercentage,
  };
}

module.exports = {
  getEmissionFactor,
  calculateCarbon,
  calculateBaseline,
  calculateReduction,
  assessCarbon,
  EMISSION_FACTORS,
  AIRPLANE_FACTORS,
};
