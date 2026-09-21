"use client";
import Link from "next/link";
import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import {
  Home,
  ChartNoAxesCombined,
  Plus,
  Ticket,
  UserRound,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { useSession } from "@/features/auth/session-provider";
import { pathFor } from "@/components/common";
import { Button } from "@/components/ui/button";
import { CHAIN_ID } from "@/lib/web3/config";
import { errorMessage } from "@/lib/api";
const nav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/impact", label: "Impact", icon: ChartNoAxesCombined },
  { href: "/trips/new", label: "Add trip", icon: Plus },
  { href: "/trips", label: "Trips", icon: Ticket },
  { href: "/profile", label: "Profile", icon: UserRound },
];
export function Shell({
  children,
  screen,
  demo = false,
}: {
  children: React.ReactNode;
  screen: string;
  demo?: boolean;
}) {
  const { user } = useSession();
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [networkError, setNetworkError] = useState("");
  const active = (href: string) =>
    href === "/trips"
      ? screen.startsWith("/trips") && screen !== "/trips/new"
      : screen === href;
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={pathFor(item.href, demo)}
              className={`nav-item ${active(item.href) ? "active" : ""} ${item.href === "/trips/new" ? "add-nav" : ""}`}
              aria-current={active(item.href) ? "page" : undefined}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="breadcrumb">
            Travel journal <span>/</span>{" "}
            {screen.startsWith("/trips/") && screen !== "/trips/new"
              ? "Trip details"
              : nav.find((n) => n.href === screen)?.label || "Home"}
          </div>
          <div className="topbar-right">
            <Link className="user-chip" href={pathFor("/profile", demo)}>
              <span className="avatar">
                {demo ? "M" : user?.name?.slice(0, 1).toUpperCase()}
              </span>
              <span>{demo ? "Maya" : user?.name?.split(" ")[0]}</span>
              <ChevronDown size={14} />
            </Link>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <strong>Design preview</strong>
            <span>Sample journeys. No wallet transactions.</span>
            <Link href="/">
              Exit preview <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
        {!demo && chainId !== CHAIN_ID && (
          <div className="network-warning">
            Your wallet is on another network.
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setNetworkError("");
                try {
                  await switchChainAsync({ chainId: CHAIN_ID });
                } catch (cause) {
                  setNetworkError(errorMessage(cause));
                }
              }}
            >
              Switch to BSC Testnet
            </Button>
            {networkError && <span role="alert">{networkError}</span>}
          </div>
        )}
        <main id="main" className="page-content">
          <div className="screen-enter" key={screen}>
            {children}
          </div>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={pathFor(item.href, demo)}
            className={`${active(item.href) ? "active" : ""} ${item.href === "/trips/new" ? "bottom-add" : ""}`}
            aria-label={item.label}
            aria-current={active(item.href) ? "page" : undefined}
          >
            <item.icon size={21} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
