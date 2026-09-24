"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Check,
  Coffee,
  Coins,
  Copy,
  ExternalLink,
  SlidersHorizontal,
  Ticket,
  TrainFront,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Empty, ErrorState, Loading } from "@/components/feedback";
import { request, errorMessage } from "@/lib/api";
import { explorerTx } from "@/lib/web3/config";
import { pathFor } from "@/lib/navigation";
import { demoVouchers, demoRedemptions } from "@/fixtures/journeys";
import { VoucherModal } from "./voucher-modal";
import type { Voucher, VoucherCategory, VoucherRedemption } from "@/types";

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

export function RewardsScreen({ demo = false }: { demo?: boolean }) {
  const [, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"catalog" | "my-vouchers">("catalog");
  const [selectedCategory, setSelectedCategory] = useState<VoucherCategory>("ALL");

  const [vouchers, setVouchers] = useState<Voucher[]>(demo ? demoVouchers : []);
  const [redemptions, setRedemptions] = useState<VoucherRedemption[]>(
    demo ? demoRedemptions : [],
  );
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);

  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    if (demo) return;
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const token = getSessionToken();
        const [catalogRes, redemptionsRes] = await Promise.all([
          request<{ vouchers: Voucher[] }>("/vouchers"),
          token
            ? request<{ redemptions: VoucherRedemption[] }>(
                "/vouchers/my-vouchers",
                {},
                token,
              ).catch(() => ({ redemptions: [] }))
            : Promise.resolve({ redemptions: [] }),
        ]);

        if (isMounted) {
          setVouchers(catalogRes.vouchers || []);
          setRedemptions(redemptionsRes.redemptions || []);
        }
      } catch (err) {
        if (isMounted) {
          console.error("[rewards-screen] Failed to load rewards:", err);
          setError(errorMessage(err));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [demo]);

  function handleRedeemSuccess(newRedemption: VoucherRedemption) {
    startTransition(() => {
      setRedemptions((prev) => [newRedemption, ...prev]);
      setVouchers((prev) =>
        prev.map((v) =>
          v.id === newRedemption.voucherId
            ? { ...v, stock: Math.max(0, v.stock - 1) }
            : v,
        ),
      );
    });
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const filteredVouchers = vouchers.filter((v) => {
    if (selectedCategory === "ALL") return true;
    return v.category === selectedCategory;
  });

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case "TRANSIT":
        return <TrainFront size={16} />;
      case "FNB":
        return <Coffee size={16} />;
      case "UTILITY":
        return <Zap size={16} />;
      default:
        return <Ticket size={16} />;
    }
  };

  return (
    <>
      <PageHeader
        title="Vouchers and rewards"
        description="Exchange your earned GOPAX tokens for transit passes, partner discounts, and utility credits."
        back={pathFor("/profile", demo)}
        backLabel="Back to profile"
      />

      <div className="rewards-tabs-bar">
        <div className="tabs-container" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "catalog"}
            className={`tab-btn ${activeTab === "catalog" ? "active" : ""}`}
            onClick={() => setActiveTab("catalog")}
          >
            <Ticket size={17} />
            <span>Catalog</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "my-vouchers"}
            className={`tab-btn ${activeTab === "my-vouchers" ? "active" : ""}`}
            onClick={() => setActiveTab("my-vouchers")}
          >
            <Coins size={17} />
            <span>Your vouchers</span>
            {redemptions.length > 0 && (
              <span className="tab-count-badge">{redemptions.length}</span>
            )}
          </button>
        </div>
      </div>

      {loading && <Loading label="Loading available rewards..." />}

      {error && !loading && (
        <ErrorState
          message={error}
          retry={() => window.location.reload()}
        />
      )}

      {!loading && !error && activeTab === "catalog" && (
        <div className="stack">
          <div className="filter-bar">
            <SlidersHorizontal size={19} aria-hidden="true" />
            <label>
              Category
              <select
                aria-label="Category"
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as VoucherCategory)
                }
              >
                <option value="ALL">All categories</option>
                <option value="TRANSIT">Transit</option>
                <option value="FNB">Food & drink</option>
                <option value="UTILITY">Utilities</option>
              </select>
            </label>
          </div>

          {filteredVouchers.length === 0 ? (
            <Empty
              title="No vouchers found"
              description="No active vouchers found in this category. Check back soon."
              action={
                <Button variant="outline" onClick={() => setSelectedCategory("ALL")}>
                  View all categories
                </Button>
              }
            />
          ) : (
            <div className="vouchers-grid">
              {filteredVouchers.map((voucher) => (
                <article key={voucher.id} className="surface voucher-card stack">
                  <div className="voucher-card-top">
                    <span className="voucher-category-pill">
                      {categoryIcon(voucher.category)}
                      <span>{voucher.category}</span>
                    </span>
                    <span className="voucher-stock-label">
                      {voucher.stock} left
                    </span>
                  </div>

                  <div className="voucher-card-body">
                    <h3 className="voucher-title">{voucher.title}</h3>
                    <p className="voucher-description">{voucher.description}</p>
                  </div>

                  <div className="voucher-card-bottom">
                    <div className="voucher-price-tag">
                      <span className="price-amount">{voucher.price}</span>
                      <span className="price-unit">GOPAX</span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setSelectedVoucher(voucher)}
                      disabled={voucher.stock <= 0}
                    >
                      <Ticket size={15} />
                      <span>{voucher.stock <= 0 ? "Out of stock" : "Redeem"}</span>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !error && activeTab === "my-vouchers" && (
        <div className="stack">
          {redemptions.length === 0 ? (
            <Empty
              title="No vouchers redeemed yet"
              description="You have not redeemed any vouchers yet. Browse the catalog to exchange your GOPAX tokens."
              action={
                <Button variant="outline" onClick={() => setActiveTab("catalog")}>
                  <Ticket size={16} /> Browse catalog
                </Button>
              }
            />
          ) : (
            <div className="redemptions-list stack">
              {redemptions.map((red) => (
                <div key={red.id} className="surface redemption-card">
                  <div className="redemption-main">
                    <div className="redemption-header">
                      <span className="voucher-category-pill">
                        {categoryIcon(red.category)}
                        <span>{red.category}</span>
                      </span>
                      <span className="text-muted" style={{ fontSize: "13px" }}>
                        {new Date(red.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <h3 className="redemption-title">{red.voucherTitle}</h3>

                    <div className="redemption-meta">
                      <span>Cost: {red.amountPaid} GOPAX</span>
                      {red.txHash && !demo && (
                        <>
                          <span className="meta-dot" aria-hidden="true">·</span>
                          <a
                            href={explorerTx(red.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="external-link"
                          >
                            <span>View tx</span>
                            <ExternalLink size={12} />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="redemption-code-action">
                    <div className="redemption-code-box">
                      <span className="code-label">PROMO CODE</span>
                      <strong className="code-text">{red.voucherCode}</strong>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(red.voucherCode)}
                    >
                      {copiedCode === red.voucherCode ? (
                        <>
                          <Check size={14} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy code</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedVoucher && (
        <VoucherModal
          voucher={selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
          onSuccess={handleRedeemSuccess}
          demo={demo}
        />
      )}
    </>
  );
}
