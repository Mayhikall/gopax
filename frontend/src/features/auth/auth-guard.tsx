"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useSession } from "./session-provider";
import { Brand } from "@/components/brand";

export function AuthGuard({
  children,
  onboarding = false,
}: {
  children: React.ReactNode;
  onboarding?: boolean;
}) {
  const { ready, user } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    const destination = onboarding
      ? new URLSearchParams(window.location.search).get("next") || "/home"
      : window.location.pathname + window.location.search;
    const next = encodeURIComponent(destination);
    if (!user) router.replace(`/?next=${next}`);
    else if (!user.name && !onboarding)
      router.replace(`/onboarding?next=${next}`);
    else if (user.name && onboarding) router.replace("/home");
  }, [ready, user, router, onboarding]);
  if (
    !ready ||
    !user ||
    (!onboarding && !user.name) ||
    (onboarding && user.name)
  )
    return <SessionCheck />;
  return children;
}

function SessionCheck() {
  return (
    <main id="main" className="session-check" aria-busy="true">
      <aside className="session-check-sidebar">
        <Brand />
        <div className="session-check-nav">
          {Array.from({ length: 5 }, (_, index) => (
            <span className="session-skeleton" key={index} />
          ))}
        </div>
      </aside>
      <section className="session-check-main">
        <header className="session-check-topbar">
          <span className="session-check-mobile-brand">
            <Brand />
          </span>
        </header>
        <div className="session-check-content">
          <div className="session-check-status" role="status">
            <span className="session-check-loader">
              <LoaderCircle className="spin" size={22} />
            </span>
            <span>
              <strong>Restoring your session</strong>
              <small>Your journeys will be ready in a moment.</small>
            </span>
          </div>
          <div className="session-skeleton session-check-title" />
          <div className="session-skeleton session-check-hero" />
          <div className="session-check-metrics" aria-hidden="true">
            <span className="session-skeleton" />
            <span className="session-skeleton" />
            <span className="session-skeleton" />
          </div>
        </div>
      </section>
    </main>
  );
}
