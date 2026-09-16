"use client";
import Link from "next/link";
import { ArrowUpRight, Coins, Ticket, Plus, Leaf } from "lucide-react";
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
        description="A little perspective on the way you move."
      >
        <span className="period-label">
          Your travel, at a glance <Leaf size={16} />
        </span>
      </PageHeader>
      {impactQuery.isError && !demo ? (
        <ErrorState
          message={errorMessage(impactQuery.error)}
          retry={() => void impactQuery.refetch()}
        />
      ) : !impact ? (
        <Loading />
      ) : (
        <>
          <ImpactHero
            saved={impact.totalCarbonSavedKg}
            coverage={`Based on ${impact.carbonSavedCoverage.comparedTrips} of ${impact.carbonSavedCoverage.verifiedTrips} verified trips.`}
            demo={demo}
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
          <Link className="add-trip-card" href={pathFor("/trips/new", demo)}>
            <span className="add-trip-icon">
              <Plus size={23} />
            </span>
            <div>
              <strong>Every ticket tells a story.</strong>
              <p>Add a trip · Upload a ticket or receipt</p>
            </div>
            <ArrowUpRight size={21} />
          </Link>
          {impact.totalAvailableGopaxReward > 0 && (
            <Link
              className="claim-strip"
              href={pathFor("/trips?rewardStatus=AVAILABLE", demo)}
            >
              <Coins size={21} />
              <span>
                Ready when you are <small>Your available rewards</small>
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
