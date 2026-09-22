"use client";
import { useMemo, useState } from "react";
import { Cloud, Coins, Ticket } from "lucide-react";
import {
  Empty,
  ErrorState,
  ImpactHero,
  InfoNote,
  Loading,
} from "@/components/common";
import { PageHeader } from "@/components/layout/page-header";
import { useAllTrips, useImpact } from "@/features/trips/queries";
import { usePreview } from "@/components/layout/preview-context";
import { errorMessage } from "@/lib/api";
import { number, quantity } from "@/lib/format";
import { transports, type Impact, type Trip } from "@/types";
import { ImpactCharts, type ImpactPeriod } from "./impact-charts";
import { MetricCard } from "./metrics";

const periods: { value: ImpactPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function periodLabel(period: ImpactPeriod, today: Date) {
  if (period === "all") return "All verified journeys";
  if (period === "year") return String(today.getFullYear());
  if (period === "month")
    return today.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  if (period === "week") {
    const start = startOfWeek(today);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startLabel = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endLabel = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${startLabel} - ${endLabel}`;
  }
  return today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isInPeriod(trip: Trip, period: ImpactPeriod, today: Date) {
  if (period === "all") return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trip.travelDate);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  if (year !== today.getFullYear()) return false;
  if (period === "year") return true;
  if (month !== today.getMonth() + 1) return false;
  if (period === "month") return true;
  if (period === "week") {
    const travelDate = new Date(year, month - 1, day);
    const start = startOfWeek(today);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return travelDate >= start && travelDate < end;
  }
  return day === today.getDate();
}

function aggregateImpact(trips: Trip[]): Impact {
  const verified = trips.filter((trip) => trip.status === "VERIFIED");
  const compared = verified.filter(
    (trip) =>
      trip.comparison?.type === "SYSTEM" &&
      number(trip.carbonReductionKg) !== null,
  );
  return {
    totalTrips: verified.length,
    totalCarbonEmissionKg: verified.reduce(
      (sum, trip) => sum + (number(trip.carbonEmissionKg) ?? 0),
      0,
    ),
    totalCarbonSavedKg: compared.length
      ? compared.reduce(
          (sum, trip) => sum + Math.max(0, number(trip.carbonReductionKg) ?? 0),
          0,
        )
      : null,
    totalClaimedGopaxReward: trips.reduce(
      (sum, trip) =>
        sum + (trip.reward?.status === "CLAIMED" ? trip.reward.amount : 0),
      0,
    ),
    totalAvailableGopaxReward: trips.reduce(
      (sum, trip) =>
        sum + (trip.reward?.status === "AVAILABLE" ? trip.reward.amount : 0),
      0,
    ),
    carbonSavedCoverage: {
      comparedTrips: compared.length,
      verifiedTrips: verified.length,
    },
    transportBreakdown: transports.map((category) => ({
      category,
      count: verified.filter((trip) => trip.category === category).length,
    })),
  };
}

export function ImpactScreen({ demo = false }: { demo?: boolean }) {
  const preview = usePreview();
  const [period, setPeriod] = useState<ImpactPeriod>("all");
  const today = useMemo(() => new Date(), []);
  const query = useImpact(demo);
  const tripsQuery = useAllTrips(demo);
  const allTrips = demo ? preview?.trips : tripsQuery.data;
  const periodTrips = useMemo(
    () => allTrips?.filter((trip) => isInPeriod(trip, period, today)),
    [allTrips, period, today],
  );
  const filteredImpact = useMemo(
    () => (periodTrips ? aggregateImpact(periodTrips) : undefined),
    [periodTrips],
  );
  const impact =
    period === "all" ? (demo ? preview?.impact : query.data) : filteredImpact;
  const periodError = tripsQuery.isError && !demo;
  const loading = demo
    ? !impact || !periodTrips
    : !impact || tripsQuery.isPending || !periodTrips;
  return (
    <>
      <PageHeader
        title="Your impact"
        description="Estimated emissions and savings across your verified journeys."
      >
        <div className="impact-period-picker">
          <div className="period-tabs" role="group" aria-label="Impact period">
            {periods.map((option) => (
              <button
                key={option.value}
                type="button"
                className={period === option.value ? "active" : ""}
                aria-pressed={period === option.value}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="period-label" aria-live="polite">
            {periodLabel(period, today)}
          </span>
        </div>
      </PageHeader>
      {(query.isError && !demo && period === "all") || periodError ? (
        <ErrorState
          message={errorMessage(periodError ? tripsQuery.error : query.error)}
          retry={() =>
            void (periodError ? tripsQuery.refetch() : query.refetch())
          }
        />
      ) : loading || !impact ? (
        <Loading label="Loading impact for this period…" />
      ) : (
        <>
          <ImpactHero
            saved={impact.totalCarbonSavedKg}
            coverage={`${impact.carbonSavedCoverage.comparedTrips} of ${impact.carbonSavedCoverage.verifiedTrips} verified trips compared with car travel.`}
            demo={demo}
          />
          <div className="metric-grid">
            <MetricCard
              icon={Cloud}
              label="CO₂ emitted"
              value={quantity(impact.totalCarbonEmissionKg)}
              unit="kg CO₂e"
              caption="Estimated across verified journeys"
            />
            <MetricCard
              icon={Ticket}
              label="Verified trips"
              value={quantity(impact.totalTrips, 0)}
              caption="Journeys with verified travel proof"
            />
            <MetricCard
              icon={Coins}
              label="Rewards claimed"
              value={quantity(impact.totalClaimedGopaxReward, 0)}
              unit="GOPAX"
              caption="Claimed rewards, not wallet balance"
            />
          </div>
          {impact.totalTrips === 0 || !periodTrips ? (
            <Empty
              demo={demo}
              title={
                period === "all"
                  ? undefined
                  : "No verified journeys in this period"
              }
              description={
                period === "all"
                  ? undefined
                  : `No verified travel records for ${periodLabel(period, today)}.`
              }
            />
          ) : null}
          <ImpactCharts trips={periodTrips || []} />
          <div className="section-spacer">
            <InfoNote>
              Savings only include journeys with an available system comparison.
              These are estimates, not certified carbon offsets. Personal
              comparisons are excluded from this total.
            </InfoNote>
          </div>
        </>
      )}
    </>
  );
}
