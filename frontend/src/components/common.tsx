"use client";
import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import {
  ArrowUpRight,
  TrainFront,
  BusFront,
  Car,
  Plane,
  Bike,
  Ticket,
  LoaderCircle,
  ArrowRight,
  Check,
  Leaf,
  AlertCircle,
} from "lucide-react";
import { TOKEN_ADDRESS, CONTRACTS_READY, CHAIN_ID } from "@/lib/config";
import {
  type Trip,
  type Transport,
  transportLabels,
  quantity,
  tripDate,
} from "@/lib/types";
import { Button } from "./ui/button";
export const transportIcons = {
  TRAIN: TrainFront,
  BUS: BusFront,
  CAR: Car,
  MOTORCYCLE: Bike,
  AIRPLANE: Plane,
};
export const pathFor = (path: string, demo = false) =>
  demo ? `/preview?screen=${encodeURIComponent(path)}` : path;
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
export function Loading({
  label = "Loading your journeys…",
}: {
  label?: string;
}) {
  return (
    <div className="state-card" role="status">
      <LoaderCircle className="spin" size={27} />
      <p>{label}</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Something needs a second look</strong>
        <p>{message}</p>
        {retry && (
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = "Your next journey starts here",
  description = "Upload your first ticket to understand your travel impact.",
  demo = false,
}: {
  title?: string;
  description?: string;
  demo?: boolean;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Ticket size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <Button asChild variant="outline">
        <Link href={pathFor("/trips/new", demo)}>
          Add a trip <ArrowRight size={16} />
        </Link>
      </Button>
    </div>
  );
}
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
const balanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;
export function Balance({ demo = false }: { demo?: boolean }) {
  const { address } = useAccount();
  const result = useReadContract({
    address: TOKEN_ADDRESS,
    abi: balanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !demo && !!address && CONTRACTS_READY },
  });
  if (demo) return <>99</>;
  if (!CONTRACTS_READY)
    return <span className="metric-error">Not configured</span>;
  if (result.isError)
    return (
      <button className="text-button" onClick={() => result.refetch()}>
        Retry balance
      </button>
    );
  if (result.data === undefined) return <>—</>;
  return <>{quantity(formatUnits(result.data, 18))}</>;
}
export function ImpactHero({
  saved,
  coverage,
  demo = false,
}: {
  saved: number | string | null;
  coverage?: string;
  demo?: boolean;
}) {
  return (
    <section className="impact-hero">
      <div className="hero-copy">
        <span className="eyebrow">
          <span className="status-dot" /> A little greener, every day
        </span>
        <p className="hero-metric-label">Your estimated CO₂ savings</p>
        <div className="hero-number">
          {quantity(saved)} <span>kg</span>
        </div>
        <p className="hero-caption">
          {saved === null
            ? "Add an eligible trip to see a comparison."
            : coverage || "Compared with car travel on eligible routes."}
        </p>
        <Button asChild variant="lime">
          <Link href={pathFor("/trips/new", demo)}>
            Add a trip <ArrowUpRight size={17} />
          </Link>
        </Button>
      </div>
      <div className="hero-art">
        <RouteLeaf />
      </div>
      <div className="hero-watermark">GO A LITTLE GREENER</div>
    </section>
  );
}
function RouteLeaf() {
  return (
    <svg viewBox="0 0 280 240" aria-hidden="true">
      <circle
        cx="144"
        cy="121"
        r="96"
        fill="none"
        stroke="#4c7c58"
        strokeDasharray="3 9"
      />
      <path
        d="M36 179c68 56 206 36 199-33-8-70-152 12-139-48 7-33 47-49 83-48"
        fill="none"
        stroke="#799b66"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <path
        d="M36 179c68 56 206 36 199-33-8-70-152 12-139-48 7-33 47-49 83-48"
        fill="none"
        stroke="#c8e999"
        strokeWidth="3"
        strokeDasharray="6 8"
      />
      <circle cx="37" cy="179" r="12" fill="#f4f6df" />
      <circle cx="179" cy="50" r="12" fill="#c4e993" />
      <path d="M123 166c-8-43 11-77 62-73 7 46-17 81-62 73Z" fill="#c4e993" />
      <path
        d="m118 178 53-69"
        stroke="#659454"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
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
