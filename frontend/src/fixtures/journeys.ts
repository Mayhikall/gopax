import type { Impact, Trip } from "@/types";
import type { PreviewData } from "@/components/layout/preview-context";
export const demoTrips: Trip[] = [
  {
    id: "demo-train",
    category: "TRAIN",
    origin: "Yogyakarta",
    destination: "Solo",
    travelDate: "2026-09-06",
    status: "VERIFIED",
    distanceKm: 65,
    carbonEmissionKg: 0.7924,
    carbonReductionKg: 14.4826,
    baselineEmissionKg: 15.275,
    comparison: { type: "SYSTEM", category: "CAR" },
    distanceSource: "PROOF_DISTANCE",
    aiDecision: "REWARD",
    aiReason:
      "The ticket clearly supports the train journey, route, and travel date. Your reward is calculated by Gopax using the estimated emissions per passenger-kilometer.",
    reward: { id: "demo-reward", amount: 95, status: "AVAILABLE" },
  },
  {
    id: "demo-bus",
    category: "BUS",
    origin: "Blok M",
    destination: "Kota",
    travelDate: "2026-09-05",
    status: "VERIFIED",
    distanceKm: 14,
    carbonEmissionKg: 0.42,
    carbonReductionKg: 2.87,
    comparison: { type: "SYSTEM", category: "CAR" },
    reward: { id: "demo-bus-reward", amount: 89, status: "CLAIMED" },
    aiDecision: "REWARD",
  },
  {
    id: "demo-car",
    category: "CAR",
    origin: "Jakarta",
    destination: "Bekasi",
    travelDate: "2026-09-04",
    status: "VERIFIED",
    distanceKm: 25,
    carbonEmissionKg: 5.875,
    carbonReductionKg: null,
    comparison: null,
    reward: { id: "demo-car-reward", amount: 10, status: "CLAIMED" },
    aiDecision: "REWARD",
  },
];
export const demoImpact: Impact = {
  totalTrips: 3,
  totalCarbonEmissionKg: 7.0874,
  totalCarbonSavedKg: 17.3526,
  totalClaimedGopaxReward: 99,
  totalAvailableGopaxReward: 95,
  carbonSavedCoverage: { comparedTrips: 2, verifiedTrips: 3 },
  transportBreakdown: [
    { category: "TRAIN", count: 1 },
    { category: "BUS", count: 1 },
    { category: "CAR", count: 1 },
  ],
};

export function previewData(state = "default"): PreviewData {
  const trips = structuredClone(demoTrips);
  const impact = structuredClone(demoImpact);
  const first = trips[0];
  if (state === "empty")
    return {
      trips: [],
      impact: {
        ...impact,
        totalTrips: 0,
        totalCarbonEmissionKg: 0,
        totalCarbonSavedKg: null,
        totalAvailableGopaxReward: 0,
        totalClaimedGopaxReward: 0,
        carbonSavedCoverage: { comparedTrips: 0, verifiedTrips: 0 },
        transportBreakdown: [],
      },
      state,
      balance: "0",
    };
  if (state === "pending")
    Object.assign(first, {
      status: "PENDING",
      distanceKm: null,
      carbonEmissionKg: null,
      carbonReductionKg: null,
      comparison: null,
      reward: null,
      aiDecision: null,
      aiReason: null,
    });
  if (state === "unavailable")
    Object.assign(first, { reward: null, aiDecision: null, aiReason: null });
  if (state === "no-reward")
    Object.assign(first, {
      reward: null,
      aiDecision: "NO_REWARD",
      aiReason:
        "The travel evidence does not meet this assessment’s reward eligibility criteria.",
    });
  if (state === "no-comparison")
    trips.forEach((trip) =>
      Object.assign(trip, {
        comparison: null,
        carbonReductionKg: null,
        baselineEmissionKg: null,
      }),
    );
  if (state === "negative")
    Object.assign(first, {
      carbonReductionKg: -0.2,
      carbonEmissionKg: 15.475,
      reward: null,
      aiDecision: "NO_REWARD",
      aiReason: "This sample journey did not receive a reward.",
    });
  if (state === "zero")
    Object.assign(first, {
      carbonReductionKg: 0,
      carbonEmissionKg: 15.275,
      reward: null,
      aiDecision: "NO_REWARD",
      aiReason: "This sample journey did not receive a reward.",
    });
  if (state === "tiny")
    Object.assign(first, {
      carbonEmissionKg: "0.001",
      carbonReductionKg: "0.009",
      baselineEmissionKg: "0.010",
    });
  if (state === "long-route")
    Object.assign(first, {
      origin: "Stasiun Yogyakarta Tugu, Daerah Istimewa Yogyakarta",
      destination: "Stasiun Solo Balapan, Kecamatan Banjarsari, Surakarta",
    });
  // Preview aggregates belong to the selected sample dataset only.
  const verified = trips.filter((trip) => trip.status === "VERIFIED");
  const compared = verified.filter(
    (trip) =>
      trip.comparison?.type === "SYSTEM" && trip.carbonReductionKg !== null,
  );
  impact.totalTrips = verified.length;
  impact.totalCarbonEmissionKg = verified.reduce(
    (sum, trip) => sum + Number(trip.carbonEmissionKg),
    0,
  );
  impact.totalCarbonSavedKg = compared.length
    ? compared.reduce(
        (sum, trip) => sum + Math.max(0, Number(trip.carbonReductionKg)),
        0,
      )
    : null;
  impact.carbonSavedCoverage = {
    comparedTrips: compared.length,
    verifiedTrips: verified.length,
  };
  impact.totalAvailableGopaxReward = trips.reduce(
    (sum, trip) =>
      sum + (trip.reward?.status === "AVAILABLE" ? trip.reward.amount : 0),
    0,
  );
  impact.transportBreakdown = ["TRAIN", "BUS", "CAR"].map((category) => ({
    category: category as Trip["category"],
    count: verified.filter((trip) => trip.category === category).length,
  }));
  return { trips, impact, state, balance: "99" };
}
