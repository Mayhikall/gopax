"use client";
import { useRouter } from "next/navigation";
import { Coins, LogOut } from "lucide-react";
import { Balance } from "@/components/common";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";
import { ProfileForm, WalletIdentity } from "./profile-form";

export function ProfileScreen({ demo = false }: { demo?: boolean }) {
  const { user, logout } = useSession();
  const router = useRouter();
  return (
    <>
      <PageHeader
        title="Your profile"
        description="Manage your name and connected wallet."
      />
      <div className="profile-layout">
        <section className="surface profile-panel">
          <div className="profile-intro">
            <span className="avatar avatar-large">
              {demo ? "M" : user?.name?.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2>{demo ? "Maya" : user?.name}</h2>
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
