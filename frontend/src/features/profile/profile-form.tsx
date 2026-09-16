"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";
import { errorMessage } from "@/lib/api";
import { safeDestination } from "@/features/auth/redirect";
import type { User } from "@/types";

export function WalletIdentity({ address }: { address: string }) {
  const [feedback, setFeedback] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setFeedback("Wallet address copied.");
    } catch {
      setFeedback("Copy unavailable. Select and copy the address below.");
    }
  }
  return (
    <div className="wallet-identity">
      <span className="field-label">Wallet address</span>
      <div className="wallet-address">
        <code>{address}</code>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copy wallet address"
          onClick={copy}
        >
          <span
            className="copy-icons"
            data-copied={feedback === "Wallet address copied."}
          >
            <Copy size={18} />
            <Check size={18} />
          </span>
        </Button>
      </div>
      <span className="field-feedback" role="status">
        {feedback}
      </span>
    </div>
  );
}
export function ProfileForm({
  demo = false,
  onboarding = false,
}: {
  demo?: boolean;
  onboarding?: boolean;
}) {
  const { user, api, setUser } = useSession();
  const [name, setName] = useState(demo ? "Maya" : user?.name || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    setError("");
    setSaved(false);
    if (!trimmed || trimmed.length > 100) {
      setError("Enter a name between 1 and 100 characters.");
      return;
    }
    if (demo) {
      setSaved(true);
      return;
    }
    setBusy(true);
    try {
      const updated = await api<User>("/users", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      setUser(updated);
      setName(updated.name || trimmed);
      setSaved(true);
      await cache.invalidateQueries({ queryKey: ["user", user?.id] });
      if (onboarding)
        router.replace(
          safeDestination(
            new URLSearchParams(window.location.search).get("next"),
          ),
        );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="profile-form">
      <label htmlFor="profile-name">Your name</label>
      <input
        id="profile-name"
        name="name"
        autoComplete="name"
        placeholder="What should we call you?"
        maxLength={100}
        required
        value={name}
        disabled={busy}
        aria-invalid={!!error}
        aria-describedby="name-feedback"
        onChange={(event) => {
          setName(event.target.value);
          setSaved(false);
          setError("");
        }}
      />
      <p className="subtle">
        A name that feels like you. Up to 100 characters.
      </p>
      <div
        id="name-feedback"
        role={error ? "alert" : "status"}
        className={error ? "field-error" : "field-feedback"}
      >
        {error ||
          (saved
            ? demo
              ? "Name updated for this preview only."
              : "Your name has been updated."
            : "")}
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? (
          "Saving…"
        ) : onboarding ? (
          <>
            Continue <ArrowRight size={17} />
          </>
        ) : (
          "Save changes"
        )}
      </Button>
    </form>
  );
}
