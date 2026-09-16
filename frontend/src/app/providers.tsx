"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { bscTestnet } from "wagmi/chains";
import {
  getDefaultConfig,
  RainbowKitProvider,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { RPC_URL } from "@/lib/web3/config";
import { SessionProvider } from "@/features/auth/session-provider";
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const config = projectId
  ? getDefaultConfig({
      appName: "Gopax",
      projectId,
      chains: [bscTestnet],
      transports: { [bscTestnet.id]: http(RPC_URL) },
      ssr: true,
    })
  : createConfig({
      chains: [bscTestnet],
      connectors: [injected()],
      transports: { [bscTestnet.id]: http(RPC_URL) },
      ssr: true,
    });
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: "#17634c",
            accentColorForeground: "white",
            borderRadius: "large",
            fontStack: "system",
          })}
          initialChain={bscTestnet}
        >
          <SessionProvider>{children}</SessionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
