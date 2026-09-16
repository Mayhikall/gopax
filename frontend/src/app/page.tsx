"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Coins, Leaf, Upload } from "lucide-react";
import { Brand, RouteArt } from "@/components/brand";
import { useSession } from "@/features/auth/session-provider";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { safeDestination } from "@/features/auth/redirect";

const steps = [
  { icon: Upload, title: "Upload", text: "Add your ticket or receipt." },
  { icon: Leaf, title: "Understand", text: "See your estimated CO₂ impact." },
  { icon: Coins, title: "Claim", text: "Claim eligible GOPAX rewards." },
];

export default function LandingPage() {
  const router = useRouter();
  const { user, login, busy } = useSession();
  const [error, setError] = useState("");

  async function signIn() {
    setError("");
    try {
      const signedInUser = await login();
      const next = safeDestination(
        new URLSearchParams(window.location.search).get("next"),
      );
      router.push(
        signedInUser.name
          ? next
          : `/onboarding?next=${encodeURIComponent(next)}`,
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <main id="main" className="landing">
      <header className="landing-header">
        <Brand />
        <span className="network-pill landing-network">
          <i /> BSC Testnet
        </span>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow landing-eyebrow">Travel with purpose</span>
          <h1>
            Every trip leaves an impact.
            <span> Make yours count.</span>
          </h1>
          <p>
            Upload your ticket, understand your estimated carbon impact, and
            earn GOPAX on eligible journeys.
          </p>

          <div className="landing-action">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openChainModal,
                openConnectModal,
                mounted,
              }) => {
                if (!mounted) return <Button disabled>Connect wallet</Button>;
                if (!account)
                  return (
                    <Button onClick={openConnectModal}>Connect wallet</Button>
                  );
                if (chain?.unsupported)
                  return (
                    <Button onClick={openChainModal}>Switch network</Button>
                  );
                if (user)
                  return (
                    <Button
                      onClick={() =>
                        router.push(user.name ? "/home" : "/onboarding")
                      }
                    >
                      Continue to Gopax
                    </Button>
                  );
                return (
                  <Button onClick={signIn} disabled={busy}>
                    {busy ? "Waiting for signature…" : "Sign in with wallet"}
                  </Button>
                );
              }}
            </ConnectButton.Custom>
            {(process.env.NODE_ENV !== "production" ||
              process.env.NEXT_PUBLIC_ENABLE_PREVIEW === "true") && (
              <Button asChild variant="ghost">
                <Link href="/preview">Explore the design preview →</Link>
              </Button>
            )}
            <p className="sign-in-note">
              Connect your wallet, then sign a message to sign in. Signing in
              does not send a transaction or cost gas.
            </p>
            {error && (
              <p className="landing-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="landing-art">
          <RouteArt />
        </div>
      </section>

      <section className="landing-steps" aria-label="How Gopax works">
        {steps.map(({ icon: Icon, title, text }, index) => (
          <article key={title}>
            <span className="step-number">0{index + 1}</span>
            <Icon size={21} />
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
