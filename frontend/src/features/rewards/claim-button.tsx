"use client";
import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { parseEventLogs, type Abi, type Hash } from "viem";
import { ArrowUpRight, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, errorMessage } from "@/lib/api";
import {
  CHAIN_ID,
  CONTRACTS_READY,
  MANAGER_ADDRESS,
  TOKEN_ADDRESS,
  explorerTx,
} from "@/lib/web3/config";
import managerArtifact from "@/lib/web3/abi/RewardManager.json";
import type { ClaimParams, Trip } from "@/types";

const abi = managerArtifact as Abi;
type PendingClaim = {
  wallet: string;
  chainId: number;
  tripId: string;
  rewardId: string;
  assessmentHash: Hash;
  txHash: Hash;
};
type State =
  | "idle"
  | "preparing"
  | "awaiting-wallet"
  | "pending"
  | "confirmed-syncing"
  | "claimed";
const keyFor = (wallet: string, tripId: string) =>
  `gopax:claim:${CHAIN_ID}:${wallet.toLowerCase()}:${tripId}`;
function storePending(claim: PendingClaim) {
  localStorage.setItem(
    keyFor(claim.wallet, claim.tripId),
    JSON.stringify(claim),
  );
}
function readPending(wallet: string, trip: Trip): PendingClaim | null {
  try {
    const value: PendingClaim = JSON.parse(
      localStorage.getItem(keyFor(wallet, trip.id)) || "null",
    );
    return value &&
      value.wallet.toLowerCase() === wallet.toLowerCase() &&
      value.chainId === CHAIN_ID &&
      value.tripId === trip.id &&
      value.rewardId === trip.reward?.id &&
      value.assessmentHash === trip.reward.assessmentHash &&
      /^0x[0-9a-fA-F]{64}$/.test(value.txHash)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function ClaimButton({
  trip,
  demo = false,
}: {
  trip: Trip;
  demo?: boolean;
}) {
  const { api, user } = useSession();
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const cache = useQueryClient();
  const [state, setState] = useState<State>("idle");
  const [pending, setPending] = useState<PendingClaim | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryHash, setRecoveryHash] = useState("");
  const locked = useRef(false);
  const currentWallet = useRef(address);
  useEffect(() => {
    currentWallet.current = address;
  }, [address]);
  useEffect(() => {
    if (!user || demo) return;
    const saved = readPending(user.walletAddress, trip);
    if (saved) {
      setPending(saved);
      setState("pending");
    }
  }, [user, trip, demo]);

  async function sync(claim: PendingClaim) {
    setState("confirmed-syncing");
    await api(`/trips/${encodeURIComponent(trip.id)}/claim/confirm`, {
      method: "POST",
      body: JSON.stringify({ rewardId: claim.rewardId, txHash: claim.txHash }),
    });
    try {
      localStorage.removeItem(keyFor(claim.wallet, claim.tripId));
    } catch {
      /* Completed claim is also retained by the backend. */
    }
    setState("claimed");
    await Promise.all(
      ["trip", "trips", "impact", "readContract"].map((key) =>
        cache.invalidateQueries({
          queryKey: key === "readContract" ? [key] : [key, user?.id],
        }),
      ),
    );
  }
  async function monitor(claim: PendingClaim) {
    if (!client) throw new Error("RPC unavailable");
    setState("pending");
    let activeClaim = claim;
    const receipt = await client.waitForTransactionReceipt({
      hash: claim.txHash,
      timeout: 120_000,
      onReplaced: ({ transaction }) => {
        activeClaim = { ...activeClaim, txHash: transaction.hash };
        setPending(activeClaim);
        try {
          storePending(activeClaim);
        } catch {
          /* Keep the hash in memory and on screen. */
        }
      },
    });
    const events = parseEventLogs({
      abi,
      logs: receipt.logs,
      eventName: "CarbonRewarded",
      strict: true,
    });
    const matched =
      receipt.status === "success" &&
      receipt.from.toLowerCase() === claim.wallet.toLowerCase() &&
      receipt.to?.toLowerCase() === MANAGER_ADDRESS?.toLowerCase() &&
      events.some((event) => {
        const args = event.args as {
          user?: string;
          assessmentHash?: string;
          reward?: bigint;
        };
        return (
          event.address.toLowerCase() === MANAGER_ADDRESS?.toLowerCase() &&
          args.user?.toLowerCase() === claim.wallet.toLowerCase() &&
          args.assessmentHash === claim.assessmentHash &&
          args.reward === BigInt(trip.reward?.amount || 0)
        );
      });
    if (!matched) {
      try {
        localStorage.removeItem(keyFor(claim.wallet, claim.tripId));
      } catch {
        /* Future receipt checks remain safe. */
      }
      setPending(null);
      setState("idle");
      throw new ApiError(
        "The transaction reverted, was cancelled, or did not contain this reward. No claim success was recorded. You can prepare a fresh claim.",
        409,
      );
    }
    await sync(activeClaim);
  }
  async function run() {
    if (locked.current || demo) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      if (pending) {
        if (state === "confirmed-syncing") await sync(pending);
        else await monitor(pending);
        return;
      }
      if (
        !CONTRACTS_READY ||
        !MANAGER_ADDRESS ||
        !client ||
        !address ||
        !user ||
        !trip.reward
      )
        throw new ApiError(
          "Wallet or contract configuration is unavailable.",
          400,
        );
      if (trip.reward.status !== "AVAILABLE")
        throw new ApiError(
          "This reward cannot start a new claim. Recover its original transaction instead.",
          409,
        );
      const wallet = address;
      const assertWallet = () => {
        if (currentWallet.current?.toLowerCase() !== wallet.toLowerCase())
          throw new ApiError("Wallet changed. Sign in again to continue.", 401);
      };
      // Verify recovery storage before asking the wallet to broadcast anything.
      const storageKey = keyFor(wallet, trip.id);
      localStorage.setItem(`${storageKey}:check`, "1");
      localStorage.removeItem(`${storageKey}:check`);
      if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID });
      setState("preparing");
      const { claimParams: params } = await api<{ claimParams: ClaimParams }>(
        `/trips/${encodeURIComponent(trip.id)}/claim`,
        { method: "POST" },
      );
      assertWallet();
      if (
        params.recipient.toLowerCase() !== wallet.toLowerCase() ||
        params.contractAddress.toLowerCase() !==
          MANAGER_ADDRESS.toLowerCase() ||
        params.chainId !== CHAIN_ID ||
        params.rewardId !== trip.reward.id ||
        params.assessmentHash !== trip.reward.assessmentHash ||
        BigInt(params.deadline) <= BigInt(Math.floor(Date.now() / 1000))
      )
        throw new ApiError(
          "Claim authorization does not match this wallet, trip, or network. Please try again.",
          409,
        );
      const [claimed, policy, token] = await Promise.all([
        client.readContract({
          address: MANAGER_ADDRESS,
          abi,
          functionName: "claimedAssessments",
          args: [params.assessmentHash],
        }),
        client.readContract({
          address: MANAGER_ADDRESS,
          abi,
          functionName: "getRewardPolicy",
        }),
        client.readContract({
          address: MANAGER_ADDRESS,
          abi,
          functionName: "gopaxToken",
        }),
      ]);
      const [maxReward, minReduction] = policy as [bigint, bigint];
      const carbon = BigInt(params.carbonKg),
        baseline = BigInt(params.baselineKg),
        amount = BigInt(params.amount);
      if (claimed)
        throw new ApiError(
          "This reward is already claimed on-chain. Use its original transaction hash to sync history.",
          409,
        );
      if (
        (token as string).toLowerCase() !== TOKEN_ADDRESS?.toLowerCase() ||
        amount <= 0n ||
        amount > maxReward ||
        (baseline > 0n &&
          (carbon >= baseline || baseline - carbon < minReduction))
      )
        throw new ApiError(
          "The claim does not match the configured token or current reward policy.",
          409,
        );
      const { request } = await client.simulateContract({
        account: wallet,
        address: MANAGER_ADDRESS,
        abi,
        functionName: "claimReward",
        args: [
          params.assessmentHash,
          carbon,
          baseline,
          amount,
          BigInt(params.deadline),
          params.signature,
        ],
      });
      assertWallet();
      setState("awaiting-wallet");
      const txHash = await writeContractAsync({
        ...request,
        chainId: CHAIN_ID,
      });
      const claim: PendingClaim = {
        wallet,
        chainId: CHAIN_ID,
        tripId: trip.id,
        rewardId: params.rewardId,
        assessmentHash: params.assessmentHash,
        txHash,
      };
      setPending(claim);
      setState("pending");
      try {
        storePending(claim);
      } catch {
        setError(
          "Transaction sent. Keep this transaction link: recovery storage is unavailable on this device.",
        );
      }
      assertWallet();
      await monitor(claim);
    } catch (cause) {
      setError(errorMessage(cause));
      setState((current) =>
        ["preparing", "awaiting-wallet"].includes(current) ? "idle" : current,
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function recover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || !user || !trip.reward?.assessmentHash) return;
    if (!/^0x[0-9a-fA-F]{64}$/.test(recoveryHash.trim())) {
      setError(
        "Enter a valid transaction hash: 0x followed by 64 hexadecimal characters.",
      );
      return;
    }
    const claim: PendingClaim = {
      wallet: user.walletAddress,
      chainId: CHAIN_ID,
      tripId: trip.id,
      rewardId: trip.reward.id,
      assessmentHash: trip.reward.assessmentHash,
      txHash: recoveryHash.trim() as Hash,
    };
    locked.current = true;
    setBusy(true);
    setError("");
    setPending(claim);
    try {
      storePending(claim);
      await monitor(claim);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const labels: Record<State, string> = {
    idle:
      trip.reward?.status === "FAILED"
        ? "Recover previous claim below"
        : "Claim reward",
    preparing: "Preparing your claim…",
    "awaiting-wallet": "Confirm in your wallet…",
    pending: busy ? "Waiting for confirmation…" : "Check transaction",
    "confirmed-syncing": busy ? "Syncing your history…" : "Sync history",
    claimed: "Reward claimed",
  };
  return (
    <div className="claim-action">
      <Button
        className="full-width"
        disabled={
          demo ||
          busy ||
          state === "claimed" ||
          !CONTRACTS_READY ||
          (!pending && trip.reward?.status !== "AVAILABLE")
        }
        onClick={run}
      >
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : state === "claimed" ? (
          <Check size={17} />
        ) : null}
        {demo ? "Claim unavailable in preview" : labels[state]}
      </Button>
      <p className="subtle" role="status">
        {state === "confirmed-syncing"
          ? "Confirmed on-chain. Only your history needs syncing; no new transaction will be sent."
          : state === "pending"
            ? "Your transaction was sent. A delay does not mean it failed. Check its status before trying anything else."
            : !CONTRACTS_READY && !demo
              ? "Claiming needs valid token and reward manager configuration."
              : "Your wallet will show the network gas fee before you confirm."}
      </p>
      {pending && (
        <a
          className="inline-link"
          href={explorerTx(pending.txHash)}
          target="_blank"
          rel="noreferrer"
        >
          View transaction <ArrowUpRight size={14} />
        </a>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!demo && !pending && state === "idle" && CONTRACTS_READY && (
        <details className="claim-recovery">
          <summary>Already sent a transaction?</summary>
          <p className="subtle">
            Paste your original transaction hash to check its receipt and sync
            this reward. This will not send a new transaction.
          </p>
          <form onSubmit={recover}>
            <label htmlFor="recovery-hash">Transaction hash</label>
            <input
              id="recovery-hash"
              value={recoveryHash}
              onChange={(event) => setRecoveryHash(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              required
            />
            <Button type="submit" variant="outline" disabled={busy}>
              Check and sync history
            </Button>
          </form>
        </details>
      )}
    </div>
  );
}
