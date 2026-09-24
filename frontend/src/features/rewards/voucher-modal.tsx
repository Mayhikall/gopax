"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { parseUnits, formatUnits, type Abi } from "viem";
import { Button } from "@/components/ui/button";
import {
  Check,
  Coffee,
  Copy,
  ExternalLink,
  LoaderCircle,
  Ticket,
  TrainFront,
  X,
  Zap,
} from "lucide-react";
import { request, errorMessage } from "@/lib/api";
import {
  TOKEN_ADDRESS,
  MANAGER_ADDRESS,
  CHAIN_ID,
  explorerTx,
} from "@/lib/web3/config";
import { useSession } from "@/features/auth/session-provider";

function getSessionToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem("gopax.auth.session.v1");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return typeof parsed?.token === "string" ? parsed.token : undefined;
  } catch {
    return undefined;
  }
}
import tokenArtifact from "@/lib/web3/abi/GopaxToken.json";
import managerArtifact from "@/lib/web3/abi/RewardManager.json";
import type { Voucher, VoucherRedemption } from "@/types";

const tokenAbi = tokenArtifact as Abi;
const managerAbi = managerArtifact as Abi;

interface VoucherModalProps {
  voucher: Voucher | null;
  onClose: () => void;
  onSuccess: (redemption: VoucherRedemption) => void;
  demo?: boolean;
}

export function VoucherModal({
  voucher,
  onClose,
  onSuccess,
  demo = false,
}: VoucherModalProps) {
  const { address } = useAccount();
  const { user, api } = useSession();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<
    "confirm" | "approving" | "redeeming" | "recording" | "success"
  >("confirm");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [redemptionData, setRedemptionData] = useState<VoucherRedemption | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Read current token balance and allowance
  const { data: balanceData } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !demo && !!address && !!TOKEN_ADDRESS },
  });

  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "allowance",
    args: address && MANAGER_ADDRESS ? [address, MANAGER_ADDRESS] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !demo && !!address && !!TOKEN_ADDRESS && !!MANAGER_ADDRESS },
  });

  if (!voucher) return null;

  const priceWei = parseUnits(voucher.price.toString(), 18);
  const currentBalanceWei = (balanceData as bigint | undefined) ?? 0n;
  const currentAllowanceWei = (allowanceData as bigint | undefined) ?? 0n;
  const hasEnoughBalance = demo || currentBalanceWei >= priceWei;
  const needsApproval = !demo && currentAllowanceWei < priceWei;

  async function handleRedeem() {
    setError(null);

    if (demo) {
      const demoResult: VoucherRedemption = {
        id: `demo-red-${Date.now()}`,
        voucherId: voucher!.id,
        voucherTitle: voucher!.title,
        category: voucher!.category,
        voucherCode: `${voucher!.code}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        amountPaid: voucher!.price,
        txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        createdAt: new Date().toISOString(),
      };
      setRedemptionData(demoResult);
      setStep("success");
      onSuccess(demoResult);
      return;
    }

    if (!address) {
      setError("Please connect your wallet first.");
      return;
    }

    if (!TOKEN_ADDRESS || !MANAGER_ADDRESS) {
      setError("Smart contracts are not configured on this network.");
      return;
    }

    try {
      // 1. Fresh on-chain allowance check to prevent unnecessary / failed approvals
      let currentAllowance = currentAllowanceWei;
      if (publicClient && address && MANAGER_ADDRESS && TOKEN_ADDRESS) {
        try {
          currentAllowance = (await publicClient.readContract({
            address: TOKEN_ADDRESS,
            abi: tokenAbi,
            functionName: "allowance",
            args: [address, MANAGER_ADDRESS],
          })) as bigint;
        } catch (e) {
          console.warn("[voucher-modal] Could not query fresh allowance:", e);
        }
      }

      // Approve step if allowance is less than voucher price
      if (currentAllowance < priceWei) {
        setStep("approving");
        const approveTx = await writeContractAsync({
          address: TOKEN_ADDRESS,
          abi: tokenAbi,
          functionName: "approve",
          args: [MANAGER_ADDRESS, priceWei],
        });

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
        await refetchAllowance();
      }

      // 2. Redeem on-chain step
      setStep("redeeming");
      const redeemTx = await writeContractAsync({
        address: MANAGER_ADDRESS,
        abi: managerAbi,
        functionName: "redeemVoucher",
        args: [voucher!.id, priceWei],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: redeemTx });
      }

      // 3. Record redemption with backend API
      setStep("recording");
      const authToken = getSessionToken();
      let res: { success: boolean; redemption: VoucherRedemption };

      if (api && user) {
        try {
          res = await api<{ success: boolean; redemption: VoucherRedemption }>(
            "/vouchers/redeem",
            {
              method: "POST",
              body: JSON.stringify({
                voucherId: voucher!.id,
                txHash: redeemTx,
              }),
            },
          );
        } catch (apiErr) {
          if (authToken) {
            res = await request<{ success: boolean; redemption: VoucherRedemption }>(
              "/vouchers/redeem",
              {
                method: "POST",
                body: JSON.stringify({
                  voucherId: voucher!.id,
                  txHash: redeemTx,
                }),
              },
              authToken,
            );
          } else {
            throw apiErr;
          }
        }
      } else {
        res = await request<{ success: boolean; redemption: VoucherRedemption }>(
          "/vouchers/redeem",
          {
            method: "POST",
            body: JSON.stringify({
              voucherId: voucher!.id,
              txHash: redeemTx,
            }),
          },
          authToken,
        );
      }

      setRedemptionData(res.redemption);
      setStep("success");
      onSuccess(res.redemption);
    } catch (err) {
      console.error("[voucher-modal] Redemption failed:", err);
      const rawMsg = errorMessage(err);
      if (rawMsg.includes("gas limit too high") || rawMsg.includes("reverted")) {
        setError(
          "On-chain transaction reverted. Please verify that your token approval and balance are sufficient.",
        );
      } else if (rawMsg.includes("rejected") || rawMsg.includes("denied")) {
        setError("Transaction was cancelled in your wallet.");
      } else {
        setError(rawMsg);
      }
      setStep("confirm");
    }
  }

  function handleCopy() {
    if (!redemptionData?.voucherCode) return;
    navigator.clipboard.writeText(redemptionData.voucherCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="voucher-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-voucher-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && step === "confirm") {
          onClose();
        }
      }}
    >
      <div className="surface voucher-modal-card">
        <div className="voucher-modal-header">
          <div>
            <span className="voucher-category-pill">
              {voucher.category === "TRANSIT" && <TrainFront size={14} />}
              {voucher.category === "FNB" && <Coffee size={14} />}
              {voucher.category === "UTILITY" && <Zap size={14} />}
              {!["TRANSIT", "FNB", "UTILITY"].includes(voucher.category) && <Ticket size={14} />}
              <span>{voucher.category}</span>
            </span>
            <h2 id="modal-voucher-title" className="voucher-modal-title">
              {voucher.title}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button text-muted"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {step === "success" && redemptionData ? (
          <div className="voucher-modal-content stack">
            <div className="voucher-success-banner">
              <span className="voucher-success-icon">
                <Check size={24} />
              </span>
              <h3>Voucher claimed successfully</h3>
              <p className="text-muted">
                Your code is ready to use. Show or enter this code at checkout.
              </p>
            </div>

            <div className="voucher-code-box">
              <span className="voucher-code-label">PROMO CODE</span>
              <strong className="voucher-code-display">
                {redemptionData.voucherCode}
              </strong>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="voucher-copy-btn"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? "Copied" : "Copy code"}</span>
              </Button>
            </div>

            <div className="voucher-details-strip">
              <span>Paid: {redemptionData.amountPaid} GOPAX</span>
              {redemptionData.txHash && !demo && (
                <a
                  href={explorerTx(redemptionData.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  View on Explorer <ExternalLink size={13} />
                </a>
              )}
            </div>

            <Button onClick={onClose} className="full-width">
              Done
            </Button>
          </div>
        ) : (
          <div className="voucher-modal-content stack">
            <p className="text-muted">{voucher.description}</p>

            <div className="voucher-summary-box">
              <div className="voucher-summary-row">
                <span>Voucher cost</span>
                <strong>{voucher.price} GOPAX</strong>
              </div>
              <div className="voucher-summary-row">
                <span>Your balance</span>
                <span>
                  {demo
                    ? "95 GOPAX"
                    : balanceData !== undefined
                      ? `${formatUnits(balanceData as bigint, 18)} GOPAX`
                      : "N/A"}
                </span>
              </div>
              <div className="voucher-summary-row">
                <span>Remaining stock</span>
                <span>{voucher.stock} available</span>
              </div>
            </div>

            {!hasEnoughBalance && (
              <div className="metric-error" role="alert">
                Insufficient GOPAX tokens. Complete more green trips to earn tokens.
              </div>
            )}

            {error && (
              <div className="metric-error" role="alert">
                {error}
              </div>
            )}

            <div className="modal-actions">
              <Button variant="outline" onClick={onClose} disabled={step !== "confirm"}>
                Cancel
              </Button>
              <Button
                onClick={handleRedeem}
                disabled={!hasEnoughBalance || step !== "confirm"}
              >
                {step === "approving" && (
                  <>
                    <LoaderCircle className="spinner" size={16} />
                    <span>Approving tokens...</span>
                  </>
                )}
                {step === "redeeming" && (
                  <>
                    <LoaderCircle className="spinner" size={16} />
                    <span>Confirming on-chain...</span>
                  </>
                )}
                {step === "recording" && (
                  <>
                    <LoaderCircle className="spinner" size={16} />
                    <span>Issuing code...</span>
                  </>
                )}
                {step === "confirm" && (
                  <>
                    <Ticket size={16} />
                    <span>
                      {needsApproval
                        ? "Approve & Redeem"
                        : `Redeem for ${voucher.price} GOPAX`}
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
