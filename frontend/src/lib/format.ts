import type { Numeric } from "@/types";
export function number(value: Numeric | undefined) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function quantity(value: Numeric | undefined, digits = 2) {
  const n = number(value);
  if (n === null) return "N/A";
  if (n !== 0 && Math.abs(n) < 0.01 && digits === 2)
    return n < 0 ? "−<0.01" : "<0.01";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits === 2 ? 2 : 0,
    maximumFractionDigits: digits,
  });
}
export function tripDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Date unavailable";
  const date = new Date(value + "T12:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return "Date unavailable";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
export const shortWallet = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
