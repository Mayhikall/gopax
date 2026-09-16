"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Coins, RotateCw } from "lucide-react";
import { Badge, InfoNote } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";
import { errorMessage } from "@/lib/api";
import { quantity } from "@/lib/format";
import { explorerTx } from "@/lib/web3/config";
import type { Trip } from "@/types";
import { ClaimButton } from "./claim-button";

export function RewardPanel({
  trip,
  demo = false,
}: {
  trip: Trip;
  demo?: boolean;
}) {
  const { api, user } = useSession();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unavailable =
    trip.status === "PENDING" ||
    (trip.status === "VERIFIED" && !trip.aiDecision);
  const processingError = cache.getQueryData<{ message: string }>([
    "processing-error",
    user?.id,
    trip.id,
  ]);
  async function retry() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<Trip>(
        `/trips/${encodeURIComponent(trip.id)}/assessment/retry`,
        { method: "POST" },
      );
      cache.setQueryData(["trip", user?.id, trip.id], updated);
      cache.removeQueries({
        queryKey: ["processing-error", user?.id, trip.id],
      });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["trips", user?.id] }),
        cache.invalidateQueries({ queryKey: ["impact", user?.id] }),
      ]);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="surface reward-panel">
      <div className="reward-heading">
        <span className="reward-coin">
          <Coins size={24} />
        </span>
        {trip.reward && <Badge status={trip.reward.status} />}
      </div>
      <h2>Your reward</h2>
      {trip.reward ? (
        <div className="reward-amount">
          {quantity(trip.reward.amount, 0)} <span>GOPAX</span>
        </div>
      ) : (
        <h3>
          {trip.status === "REJECTED"
            ? "Trip not verified"
            : unavailable
              ? "Assessment unavailable"
              : "No reward for this trip"}
        </h3>
      )}
      <p className="subtle">
        {trip.aiReason ||
          (unavailable
            ? processingError?.message ||
              "Your proof is saved. Assessment could not finish, and no reward decision has been made yet."
            : trip.reward
              ? "Your reward follows the validated assessment of your travel proof."
              : "This journey did not receive a reward. Any available carbon estimate is shown separately.")}
      </p>
      {unavailable && (
        <Button variant="outline" disabled={busy || demo} onClick={retry}>
          <RotateCw size={17} />
          {busy ? "Retrying assessment…" : "Retry assessment"}
        </Button>
      )}
      {trip.status === "VERIFIED" &&
        (trip.reward?.status === "AVAILABLE" ||
          trip.reward?.status === "FAILED") && (
          <ClaimButton trip={trip} demo={demo} />
        )}
      {trip.reward?.status === "CLAIMED" && (
        <div className="claim-receipt">
          <Badge status="CLAIMED" />
          <p>Reward claimed. Your trip remains verified.</p>
          {trip.reward.txHash && (
            <a
              className="inline-link"
              href={explorerTx(trip.reward.txHash)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction <ArrowUpRight size={15} />
            </a>
          )}
        </div>
      )}
      {trip.reward?.status === "FAILED" && (
        <p className="field-error">
          This claim is marked as failed. Use its original transaction hash to
          check the receipt and recover your history.
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="section-spacer">
        <InfoNote>
          Reward is based on estimated emissions per passenger-km. Longer
          journeys do not automatically earn more tokens.
        </InfoNote>
      </div>
    </aside>
  );
}
