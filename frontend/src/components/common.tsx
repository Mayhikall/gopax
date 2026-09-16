"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  TrainFront,
  BusFront,
  Car,
  Plane,
  Bike,
  Ticket,
  Check,
  Leaf,
} from "lucide-react";
import type { Transport } from "@/types";
export { pathFor } from "@/lib/navigation";
export { Loading, Empty, ErrorState } from "@/components/feedback";
export { TripCard } from "@/features/trips/trip-card";
export { Balance } from "@/features/rewards/balance";
export { ImpactHero } from "@/features/impact/impact-hero";
export const transportIcons = {
  TRAIN: TrainFront,
  BUS: BusFront,
  CAR: Car,
  MOTORCYCLE: Bike,
  AIRPLANE: Plane,
};
export function TransportIcon({ category }: { category: Transport }) {
  const Icon = transportIcons[category] || Ticket;
  return (
    <span className={`transport-icon ${category?.toLowerCase()}`}>
      <Icon size={22} />
    </span>
  );
}
export function Badge({ status }: { status: string }) {
  const label: Record<string, string> = {
    AVAILABLE: "Ready to claim",
    CLAIMED: "Claimed",
    VERIFIED: "Verified",
    PENDING: "Processing",
    REJECTED: "Not verified",
    FAILED: "Claim failed",
  };
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      {["CLAIMED", "VERIFIED"].includes(status) && <Check size={12} />}
      <span>{label[status] || status}</span>
    </span>
  );
}
export function SectionTitle({
  title,
  link,
  href,
}: {
  title: string;
  link?: string;
  href?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {href && (
        <Link href={href}>
          {link || "View all"}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="info-note">
      <Leaf size={17} />
      <p>{children}</p>
    </div>
  );
}
