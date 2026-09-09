export type Transport = "TRAIN" | "BUS" | "MOTORCYCLE" | "CAR" | "AIRPLANE";
export type Numeric = number | string | null;
export interface User {
  id: string;
  name: string | null;
  walletAddress: string;
}
export interface Reward {
  id: string;
  amount: number;
  status: "AVAILABLE" | "CLAIMED" | "FAILED";
  assessmentHash?: `0x${string}`;
  txHash?: `0x${string}` | null;
  claimedAt?: string | null;
}
export interface Trip {
  id: string;
  category: Transport;
  origin: string;
  destination: string;
  travelDate: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  distanceKm: Numeric;
  carbonEmissionKg: Numeric;
  carbonReductionKg: Numeric;
  reductionPercentage?: Numeric;
  baselineEmissionKg?: Numeric;
  distanceSource?: string | null;
  comparison: { type: "SYSTEM" | "PERSONAL"; category: Transport } | null;
  reward: Reward | null;
  aiDecision?: "REWARD" | "NO_REWARD" | null;
  aiReason?: string | null;
}
export interface TripPage {
  trips: Trip[];
  hasMore: boolean;
  nextOffset: number | null;
}
export interface Impact {
  totalTrips: number;
  totalCarbonEmissionKg: Numeric;
  totalCarbonSavedKg: Numeric;
  totalClaimedGopaxReward: number;
  totalAvailableGopaxReward: number;
  carbonSavedCoverage: { comparedTrips: number; verifiedTrips: number };
  transportBreakdown: { category: Transport; count: number }[];
}
export interface ClaimParams {
  rewardId: string;
  recipient: `0x${string}`;
  contractAddress: `0x${string}`;
  chainId: number;
  assessmentHash: `0x${string}`;
  amount: number;
  carbonKg: string;
  baselineKg: string;
  deadline: string;
  signature: `0x${string}`;
}
export const transports: Transport[] = [
  "TRAIN",
  "BUS",
  "MOTORCYCLE",
  "CAR",
  "AIRPLANE",
];
export const transportLabels: Record<Transport, string> = {
  TRAIN: "Train",
  BUS: "Bus",
  MOTORCYCLE: "Motorcycle",
  CAR: "Car",
  AIRPLANE: "Airplane",
};
export function number(value: Numeric | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function quantity(value: Numeric | undefined, digits = 2) {
  const n = number(value);
  if (n === null) return "—";
  if (n > 0 && n < 0.01 && digits === 2) return "<0.01";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}
export function tripDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Date unavailable";
  return new Date(value + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
export const shortWallet = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
