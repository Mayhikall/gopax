"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { encodeFunctionData, formatUnits, parseSignature, parseUnits, type Abi } from "viem";
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
import { errorMessage } from "@/lib/api";
import {
  TOKEN_ADDRESS,
  MANAGER_ADDRESS,
  CHAIN_ID,
  explorerTx,
} from "@/lib/web3/config";
import { useSession } from "@/features/auth/session-provider";
import { useGopaxTransaction } from "@/lib/web3/use-gopax-transaction";

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
  const { address: wagmiAddress } = useAccount();
  const { api, user } = useSession();
  const address =
    (user?.walletAddress as `0x${string}` | undefined) || wagmiAddress;
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const {
    sendTransaction: sendGopaxTransaction,
    signTypedData,
    isSponsored,
  } = useGopaxTransaction();

  const [step, setStep] = useState<
    "confirm" | "signing" | "redeeming" | "recording" | "success"
  >("confirm");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [redemptionData, setRedemptionData] = useState<VoucherRedemption | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Read the current GOPAX token balance.
  const { data: balanceData } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !demo && !!address && !!TOKEN_ADDRESS },
  });


  if (!voucher) return null;

  const priceWei = parseUnits(voucher.price.toString(), 18);
  const currentBalanceWei = (balanceData as bigint | undefined) ?? 0n;
  const hasEnoughBalance = demo || currentBalanceWei >= priceWei;

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
      if (!publicClient) throw new Error("BSC RPC is unavailable.");

      setStep("signing");
      const nonce = (await publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: tokenAbi,
        functionName: "nonces",
        args: [address],
      })) as bigint;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
      const signature = await signTypedData(
        address,
        {
          domain: {
            name: "Gopax",
            version: "1",
            chainId: CHAIN_ID,
            verifyingContract: TOKEN_ADDRESS,
          },
          types: {
            Permit: [
              { name: "owner", type: "address" },
              { name: "spender", type: "address" },
              { name: "value", type: "uint256" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" },
            ],
          },
          primaryType: "Permit",
          message: {
            owner: address,
            spender: MANAGER_ADDRESS,
            value: priceWei,
            nonce,
            deadline,
          },
        },
      );
      const parsed = parseSignature(signature as `0x${string}`);
      const v = Number(parsed.v ?? BigInt((parsed.yParity ?? 0) + 27));

      setStep("redeeming");
      const redeemTx = await sendGopaxTransaction({
        from: address,
        to: MANAGER_ADDRESS,
        data: encodeFunctionData({
          abi: managerAbi,
          functionName: "redeemVoucherWithPermit",
          args: [
            voucher!.id,
            priceWei,
            deadline,
            v,
            parsed.r,
            parsed.s,
          ],
        }),
        action: "Redeem voucher",
      });

      await publicClient.waitForTransactionReceipt({ hash: redeemTx });

      setStep("recording");
      const res = await api<{
        success: boolean;
        redemption: VoucherRedemption;
      }>("/vouchers/redeem", {
        method: "POST",
        body: JSON.stringify({ voucherId: voucher!.id, txHash: redeemTx }),
      });

      setRedemptionData(res.redemption);
      setStep("success");
      onSuccess(res.redemption);
    } catch (err) {
      console.error("[voucher-modal] Redemption failed:", err);
      const rawMsg = errorMessage(err);
      if (rawMsg.includes("gas limit too high") || rawMsg.includes("reverted")) {
        setError(
          "On-chain transaction reverted. Please verify that your token balance is sufficient.",
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
              {!demo && address && (
                <div className="voucher-summary-row">
                  <span>Network fee</span>
                  <span>
                    {isSponsored(address)
                      ? "Sponsored by Gopax"
                      : "Paid in BNB by wallet"}
                  </span>
                </div>
              )}
            </div>

            {!hasEnoughBalance && (
              <div className="metric-error" role="alert">
                Insufficient GOPAX balance. Complete eligible green trips to earn tokens.
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
                {step === "signing" && (
                  <>
                    <LoaderCircle className="spinner" size={16} />
                    <span>Authorizing permit…</span>
                  </>
                )}
                {step === "redeeming" && (
                  <>
                    <LoaderCircle className="spinner" size={16} />
                    <span>Submitting transaction…</span>
                  </>
                )}
                {step === "recording" && (
                  <>
                    <LoaderCircle className="spinner" size={16} />
                    <span>Finalizing voucher…</span>
                  </>
                )}
                {step === "confirm" && (
                  <>
                    <Ticket size={16} />
                    <span>Redeem for {voucher.price} GOPAX</span>
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
