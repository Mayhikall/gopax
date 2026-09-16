"use client";
import { Cloud, Coins, Ticket } from "lucide-react";
import {
  Empty,
  ErrorState,
  ImpactHero,
  InfoNote,
  Loading,
} from "@/components/common";
import { PageHeader } from "@/components/layout/page-header";
import { useImpact } from "@/features/trips/queries";
import { usePreview } from "@/components/layout/preview-context";
import { errorMessage } from "@/lib/api";
import { quantity } from "@/lib/format";
import { MetricCard, TransportBreakdown } from "./metrics";

export function ImpactScreen({ demo = false }: { demo?: boolean }) {
  const preview = usePreview();
  const query = useImpact(demo);
  const impact = demo ? preview?.impact : query.data;
  return (
    <>
      <PageHeader
        title="Your impact"
        description="Understand your journeys. See the bigger picture."
      >
        <span className="period-label">All time</span>
      </PageHeader>
      {query.isError && !demo ? (
        <ErrorState
          message={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : !impact ? (
        <Loading />
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
              caption="Each journey adds perspective"
            />
            <MetricCard
              icon={Coins}
              label="Rewards claimed"
              value={quantity(impact.totalClaimedGopaxReward, 0)}
              unit="GOPAX"
              caption="Claimed rewards, not wallet balance"
            />
          </div>
          {impact.totalTrips === 0 ? (
            <Empty demo={demo} />
          ) : (
            <TransportBreakdown impact={impact} />
          )}
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
