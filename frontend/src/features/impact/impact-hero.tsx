"use client";
import { quantity } from "@/lib/format";

export function ImpactHero({
  saved,
  coverage,
  summary = false,
  total = false,
}: {
  saved: number | string | null;
  coverage?: string;
  demo?: boolean;
  summary?: boolean;
  total?: boolean;
}) {
  return (
    <section className={`impact-hero${summary ? " impact-summary" : ""}`}>
      <div className="hero-copy">
        <span className="eyebrow">Your travel footprint</span>
        <p className="hero-metric-label">
          {total
            ? "Total estimated CO₂ emissions"
            : "Your estimated CO₂ savings"}
        </p>
        <div className="hero-number">
          {saved === null ? "0" : quantity(saved)} <span>kg</span>
        </div>
        <p className="hero-caption">
          {coverage ||
            (total
              ? "Across all your verified journeys."
              : "Compared with car travel on eligible routes.")}
        </p>
      </div>
      <div className="hero-art">
        <RouteLeaf />
      </div>
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
