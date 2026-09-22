"use client";
import { MapPin, ArrowRight, LockKeyhole } from "lucide-react";
import {
  Badge,
  ErrorState,
  Loading,
  pathFor,
  TransportIcon,
} from "@/components/common";
import { PageHeader } from "@/components/layout/page-header";
import { RewardPanel } from "@/features/rewards/reward-panel";
import { usePreview } from "@/components/layout/preview-context";
import { errorMessage } from "@/lib/api";
import { quantity, tripDate } from "@/lib/format";
import { transportLabels, type Trip } from "@/types";
import { useTrip } from "./queries";

export function RouteTicket({ trip }: { trip: Trip }) {
  const source: Record<string, string> = {
    PROOF_DISTANCE: "Distance from ticket",
    ROUTE_ESTIMATE: "Estimated route distance",
    GREAT_CIRCLE: "Great-circle distance",
  };
  return (
    <section className="surface route-ticket">
      <div className="ticket-top">
        <span>
          <TransportIcon category={trip.category} />
          <strong>{transportLabels[trip.category]}</strong>
        </span>
        <time dateTime={trip.travelDate}>{tripDate(trip.travelDate)}</time>
      </div>
      <div className="ticket-journey">
        <div>
          <span>From</span>
          <h2>{trip.origin}</h2>
        </div>
        <div className="ticket-route-line" aria-hidden="true">
          <i />
          <span />
          <ArrowRight size={19} />
          <span />
          <i />
        </div>
        <div>
          <span>To</span>
          <h2>{trip.destination}</h2>
        </div>
      </div>
      <div className="ticket-distance">
        <MapPin size={15} />
        <strong>{quantity(trip.distanceKm, 1)} km</strong>
        <span>
          {trip.distanceSource
            ? source[trip.distanceSource] || "Estimated distance"
            : "Distance unavailable"}
        </span>
      </div>
      <div className="ticket-perforation" />
      <div className="ticket-carbon">
        <div>
          <span>CO₂ emitted</span>
          <strong>
            {quantity(trip.carbonEmissionKg)} <small>kg CO₂e</small>
          </strong>
        </div>
      </div>
    </section>
  );
}
export function TripDetail({
  id,
  demo = false,
}: {
  id: string;
  demo?: boolean;
}) {
  const preview = usePreview();
  const query = useTrip(id, demo);
  const trip = demo
    ? preview?.trips.find((item) => item.id === id)
    : query.data;
  return (
    <>
      <PageHeader title="Trip details" back={pathFor("/trips", demo)}>
        {trip && <Badge status={trip.status} />}
      </PageHeader>
      {query.isError && !demo ? (
        <ErrorState
          message={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : !trip ? (
        demo ? (
          <ErrorState message="This sample journey could not be found." />
        ) : (
          <Loading />
        )
      ) : (
        <div className="detail-layout">
          <div className="stack">
            <RouteTicket trip={trip} />
            <p className="privacy-note">
              <LockKeyhole size={15} />
              Your original proof is stored privately.
            </p>
            {trip.distanceSource === "ROUTE_ESTIMATE" && (
              <p className="subtle">
                Route data ©{" "}
                <a
                  className="inline-link"
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenStreetMap contributors
                </a>
                . Distance is an estimate.
              </p>
            )}
            <p className="subtle">
              Carbon figures are estimates. A reward is not proof of carbon
              savings.
            </p>
          </div>
          <RewardPanel trip={trip} demo={demo} />
        </div>
      )}
    </>
  );
}
