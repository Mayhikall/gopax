"use client";

// wagmi chain objects contain BigInt fields (e.g. blockGasLimit).
// Next.js uses JSON.stringify internally; this polyfill prevents the
// "Do not know how to serialize a BigInt" runtime error.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof BigInt !== "undefined" && !(BigInt.prototype as any).toJSON) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

import React, { Component, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import {
  WagmiProvider,
  createConfig,
} from "@privy-io/wagmi";
import { http } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { RPC_URL } from "@/lib/web3/config";
import { SessionProvider } from "@/features/auth/session-provider";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// ponytail: Privy v3.44+ has a bug where a stale internal navigation state
// (SignRequestScreen) crashes on reload. This boundary catches it and
// surgically clears only the corrupt key, preserving the auth session.
class PrivyErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (error.message?.includes("signMessage")) {
      // Clear only Privy's stale modal/navigation keys, not the auth token.
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("privy:") && !key.includes("token") && !key.includes("auth") && !key.includes("session") && !key.includes("user")) {
          localStorage.removeItem(key);
        }
      }
      // Re-render with clean state.
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  const [wagmiConfig] = useState(() =>
    createConfig({
      chains: [bscTestnet],
      transports: { [bscTestnet.id]: http(RPC_URL) },
      ssr: true,
    }),
  );

  useEffect(() => setMounted(true), []);

  // Privy validates the app ID as soon as its provider renders. Deferring that
  // provider until hydration keeps CI/build-time prerendering independent of
  // secrets while still failing clearly in a misconfigured browser runtime.
  if (!mounted) return null;

  if (!privyAppId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 text-center text-stone-800">
        <div>
          <h1 className="text-xl font-semibold">Privy configuration required</h1>
          <p className="mt-2 text-sm text-stone-600">
            Set NEXT_PUBLIC_PRIVY_APP_ID to start Gopax.
          </p>
        </div>
      </main>
    );
  }

  return (
    <PrivyErrorBoundary>
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ["google", "wallet"],
          supportedChains: [bscTestnet],
          defaultChain: bscTestnet,
          embeddedWallets: {
            ethereum: { createOnLogin: "users-without-wallets" },
          },
          appearance: {
            theme: "light",
            accentColor: "#17634c",
            logo: "/logo-gopax.png",
            landingHeader: "Welcome to Gopax",
            loginMessage: "Continue with Google or your preferred wallet.",
            showWalletLoginFirst: false,
            walletChainType: "ethereum-only",
            walletList: [
              "detected_ethereum_wallets",
              "detected_wallets",
              "bitget_wallet",
              "metamask",
              "coinbase_wallet",
              "wallet_connect",
            ],
          },
          ...(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
            ? {
                walletConnectCloudProjectId:
                  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
              }
            : {}),
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider
            config={wagmiConfig}
            setActiveWalletForWagmi={({ wallets, user }) => {
              if (user?.google) {
                const embeddedWallet = wallets.find(
                  (wallet) =>
                    wallet.walletClientType === "privy" ||
                    wallet.connectorType === "embedded",
                );
                if (embeddedWallet) return embeddedWallet;
              }
              const primaryAddress = user?.wallet?.address.toLowerCase();
              return (
                wallets.find(
                  (wallet) =>
                    wallet.address.toLowerCase() === primaryAddress,
                ) || wallets[0]
              );
            }}
          >
            <SessionProvider>{children}</SessionProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </PrivyErrorBoundary>
  );
}
