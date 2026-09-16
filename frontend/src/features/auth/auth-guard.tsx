"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./session-provider";
import { Loading } from "@/components/common";

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
    return (
      <main id="main">
        <Loading label="Checking your session…" />
      </main>
    );
  return children;
}
