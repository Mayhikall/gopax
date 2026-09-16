"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { TransportIcon, Badge } from "@/components/common";
import { pathFor } from "@/lib/navigation";
import { quantity, tripDate } from "@/lib/format";
import { transportLabels, type Trip } from "@/types";
export function TripCard({
  trip,
  demo = false,
}: {
  trip: Trip;
  demo?: boolean;
}) {
  return (
    <Link className="trip-card" href={pathFor(`/trips/${trip.id}`, demo)}>
      <TransportIcon category={trip.category} />
      <div className="trip-main">
        <div className="trip-route">
          <strong>{trip.origin}</strong>
          <ArrowRight size={15} />
          <strong>{trip.destination}</strong>
        </div>
        <p>
          {transportLabels[trip.category]}
          <span>·</span>
          {tripDate(trip.travelDate)}
        </p>
        <div className="trip-statuses">
          <Badge status={trip.status} />
          {trip.reward && <Badge status={trip.reward.status} />}
        </div>
      </div>
      <div className="trip-numbers">
        <strong>
          {quantity(trip.carbonEmissionKg)} <small>kg CO₂e</small>
        </strong>
        {trip.reward ? (
          <span className="reward-text">
            +{quantity(trip.reward.amount, 0)} GOPAX
          </span>
        ) : (
          <Badge status={trip.status} />
        )}
      </div>
      <ArrowUpRight size={18} className="trip-arrow" />
    </Link>
  );
}
