"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, TrainFront, Wallet } from "lucide-react";
import { Brand } from "@/components/brand";
import { useSession } from "@/features/auth/session-provider";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { safeDestination } from "@/features/auth/redirect";
import { demoTrips } from "@/fixtures/journeys";
import { quantity, tripDate } from "@/lib/format";

const sample = demoTrips[0];

export default function LandingPage() {
  const router = useRouter();
  const { user, ready, login, busy } = useSession();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !user) return;
    const next = safeDestination(
      new URLSearchParams(window.location.search).get("next"),
    );
    router.replace(
      user.name ? next : `/onboarding?next=${encodeURIComponent(next)}`,
    );
  }, [ready, user, router]);

  const [signingIn, setSigningIn] = useState<"google" | "wallet" | null>(null);

  async function signIn(method: "google" | "wallet") {
    setError("");
    setSigningIn(method);
    try {
      await login(method);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSigningIn(null);
    }
  }

  if (ready && user) {
    return null;
  }

  return (
    <main id="main" className="landing">
      <header className="landing-header">
        <Brand />
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <h1>
            Upload a ticket.
            <span>See the estimated impact.</span>
          </h1>
          <p>Save the route and claim GOPAX when the trip is eligible.</p>

          <div className="landing-action">
            <Button onClick={() => signIn("google")} disabled={busy}>
              <span className="google-icon-wrapper" aria-hidden="true">
                <img src="/google.svg" alt="" width={16} height={16} />
              </span>
              <span>
                {signingIn === "google" ? "Opening Google…" : "Continue with Google"}
              </span>
            </Button>
            <Button
              variant="outline"
              onClick={() => signIn("wallet")}
              disabled={busy}
            >
              <Wallet size={18} />
              <span>
                {signingIn === "wallet" ? "Connecting…" : "Connect wallet"}
              </span>
            </Button>
            {(process.env.NODE_ENV !== "production" ||
              process.env.NEXT_PUBLIC_ENABLE_PREVIEW === "true") && (
                <Button asChild variant="ghost">
                  <Link href="/preview">
                    View sample journeys <ArrowRight size={17} />
                  </Link>
                </Button>
              )}
            <p className="sign-in-note">
              Continue with Google for an embedded wallet, or connect an existing wallet through Privy.
            </p>
            {error && (
              <p className="landing-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="landing-specimen">
          <div className="specimen-caption">
            <span>Sample data</span>
          </div>
          <article className="sample-ticket" aria-label="Sample train journey">
            <div className="sample-ticket-header">
              <TrainFront size={23} aria-hidden="true" />
              <span>Train journey</span>
              <span>Sample ticket</span>
            </div>
            <div className="sample-ticket-route">
              <span>From</span>
              <h2>{sample.origin}</h2>
              <div className="sample-route-line" aria-hidden="true">
                <i />
                <span />
                <ArrowRight size={20} />
              </div>
              <span>To</span>
              <h2>{sample.destination}</h2>
            </div>
            <div className="sample-ticket-meta">
              <span>{tripDate(sample.travelDate)}</span>
              <span>{sample.distanceKm} km · Rail</span>
            </div>
            <div className="ticket-perforation" />
            <div className="sample-ticket-impact">
              <div>
                <span>Estimated CO₂ saved</span>
                <strong>
                  {quantity(sample.carbonReductionKg)} <small>kg</small>
                </strong>
              </div>
              <p>Compared with the same journey by car.</p>
            </div>
          </article>
        </div>
      </section>

      <section
        className="landing-explainer"
        aria-label="Supported travel and estimate limits"
      >
        <p>Train, bus, airplane, car, and motorcycle tickets are supported.</p>
        <span className="landing-footnote">
          Estimates are not carbon offsets.
          <br />
          Rewards depend on trip eligibility.
        </span>
      </section>
    </main>
  );
}
