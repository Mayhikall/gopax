"use client";
import Link from "next/link";
import { ArrowUpRight, Coins, Ticket } from "lucide-react";
import {
  Balance,
  Empty,
  ErrorState,
  ImpactHero,
  InfoNote,
  Loading,
  pathFor,
  SectionTitle,
  TripCard,
} from "@/components/common";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/features/auth/session-provider";
import { useImpact, useTrips } from "@/features/trips/queries";
import { usePreview } from "@/components/layout/preview-context";
import { quantity } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { MetricCard } from "./metrics";

export function HomeScreen({ demo = false }: { demo?: boolean }) {
  const preview = usePreview();
  const { user } = useSession();
  const impactQuery = useImpact(demo);
  const tripsQuery = useTrips("", "", demo);
  const impact = demo ? preview?.impact : impactQuery.data;
  const trips = demo
    ? preview?.trips
    : tripsQuery.data?.pages.flatMap((page) => page.trips);
  return (
    <>
      <PageHeader
        title={`Hello, ${demo ? "Maya" : user?.name?.split(" ")[0] || "traveler"}.`}
      />
      {impactQuery.isError && !demo ? (
        <ErrorState
          message={errorMessage(impactQuery.error)}
          retry={() => void impactQuery.refetch()}
        />
      ) : !impact ? (
        <Loading />
      ) : (
        <>
          <div className="home-overview">
            <ImpactHero
              saved={impact.totalCarbonEmissionKg}
              coverage={`Across ${quantity(impact.totalTrips, 0)} verified ${impact.totalTrips === 1 ? "journey" : "journeys"}.`}
              demo={demo}
              summary
              total
            />
            <div className="metric-grid home-metrics">
              <MetricCard
                icon={Coins}
                label="GOPAX balance"
                value={<Balance demo={demo} />}
                unit="GOPAX"
                caption="Tokens in your connected wallet"
              />
              <MetricCard
                icon={Ticket}
                label="Verified trips"
                value={quantity(impact.totalTrips, 0)}
                caption="Journeys with a verified travel proof"
              />
            </div>
          </div>
          {impact.totalAvailableGopaxReward > 0 && (
            <Link
              className="claim-strip"
              href={pathFor("/trips?rewardStatus=AVAILABLE", demo)}
            >
              <Coins size={21} />
              <span>
                Rewards ready to claim
                <small>Review the eligible journey before claiming</small>
              </span>
              <strong>
                {quantity(impact.totalAvailableGopaxReward, 0)}{" "}
                <small>GOPAX</small>
              </strong>
              <ArrowUpRight size={19} />
            </Link>
          )}
        </>
      )}
      <SectionTitle title="Recent journeys" href={pathFor("/trips", demo)} />
      {tripsQuery.isError && !demo ? (
        <ErrorState
          message={errorMessage(tripsQuery.error)}
          retry={() => void tripsQuery.refetch()}
        />
      ) : !trips ? (
        <Loading />
      ) : !trips.length ? (
        <Empty demo={demo} />
      ) : (
        <div className="trip-list">
          {trips.slice(0, 3).map((trip) => (
            <TripCard key={trip.id} trip={trip} demo={demo} />
          ))}
        </div>
      )}
      <div className="section-spacer">
        <InfoNote>
          Rewards are based on estimated emissions per passenger-km. Traveling
          farther does not automatically earn more tokens.
        </InfoNote>
      </div>
    </>
  );
}
