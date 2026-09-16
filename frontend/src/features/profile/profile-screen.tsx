"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useSwitchChain } from "wagmi";
import { Coins, LogOut, ShieldCheck } from "lucide-react";
import { Balance } from "@/components/common";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";
import { CHAIN_ID } from "@/lib/web3/config";
import { errorMessage } from "@/lib/api";
import { ProfileForm, WalletIdentity } from "./profile-form";

export function ProfileScreen({ demo = false }: { demo?: boolean }) {
  const { user, logout } = useSession();
  const { chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <>
      <PageHeader
        title="Your profile"
        description="Your identity, your wallet, your journeys."
      />
      <div className="profile-layout">
        <section className="surface profile-panel">
          <div className="profile-intro">
            <span className="avatar avatar-large">
              {demo ? "M" : user?.name?.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2>{demo ? "Maya" : user?.name}</h2>
              <span className="subtle">Your Gopax travel companion</span>
            </div>
          </div>
          <ProfileForm demo={demo} key={user?.id || "demo"} />
          <div className="guide-divider" />
          <WalletIdentity
            address={
              demo
                ? "0x7A3d0b9e5f81234567890123456789012345C92E"
                : user?.walletAddress || ""
            }
          />
        </section>
        <aside className="stack">
          <section className="wallet-balance-card">
            <Coins size={25} />
            <span>GOPAX balance</span>
            <strong>
              <Balance demo={demo} /> <small>GOPAX</small>
            </strong>
            <p>
              Tokens held in your wallet, separate from rewards waiting to be
              claimed.
            </p>
          </section>
          <section className="surface network-card">
            <ShieldCheck size={23} />
            <h3>Your network</h3>
            <p>
              BSC Testnet <span className="badge">Chain 97</span>
            </p>
            {!demo && chainId !== CHAIN_ID ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={async () => {
                  setError("");
                  try {
                    await switchChainAsync({ chainId: CHAIN_ID });
                  } catch (cause) {
                    setError(errorMessage(cause));
                  }
                }}
              >
                {isPending ? "Switching…" : "Switch network"}
              </Button>
            ) : (
              <p className="subtle">
                {demo ? "Preview network" : "Connected to the correct network"}
              </p>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <Button
            variant="outline"
            onClick={() => {
              if (!demo) logout();
              router.replace("/");
            }}
          >
            <LogOut size={17} />
            {demo ? "Exit preview" : "Disconnect wallet"}
          </Button>
        </aside>
      </div>
    </>
  );
}
