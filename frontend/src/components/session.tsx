"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useAccount,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { createSiweMessage } from "viem/siwe";
import { request, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { CHAIN_ID } from "@/lib/config";

type Session = {
  user: User | null;
  ready: boolean;
  busy: boolean;
  login: () => Promise<User>;
  logout: () => void;
  setUser: (user: User) => void;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
};

const Context = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const cache = useQueryClient();

  const [session, setSession] = useState<{ token: string; user: User } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeAddress = useRef(address);
  activeAddress.current = address;
  const generation = useRef(0);

  const clear = useCallback(() => {
    generation.current++;
    setSession(null);
    void cache.cancelQueries();
    cache.clear();
  }, [cache]);

  useEffect(() => {
    setReady(true);
    clear();
  }, [address, isConnected, clear]);

  const user =
    session &&
    isConnected &&
    session.user.walletAddress.toLowerCase() === address?.toLowerCase()
      ? session.user
      : null;

  const api = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      if (!session || !user)
        throw new ApiError("Please sign in to continue.", 401);
      const epoch = generation.current;
      try {
        const data = await request<T>(path, options, session.token);
        if (epoch !== generation.current)
          throw new ApiError("Wallet session changed.", 401);
        return data;
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 401 &&
          epoch === generation.current
        ) {
          clear();
        }
        throw error;
      }
    },
    [session, user, clear],
  );

  async function login() {
    if (!address) throw new Error("Connect wallet first");
    setBusy(true);
    const wallet = address;
    const epoch = generation.current;
    try {
      if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID });
      const { nonce } = await request<{ nonce: string }>("/auth/nonce", {
        method: "POST",
        body: JSON.stringify({ walletAddress: wallet }),
      });
      const message = createSiweMessage({
        address: wallet,
        chainId: CHAIN_ID,
        domain: process.env.NEXT_PUBLIC_SIWE_DOMAIN || window.location.hostname,
        uri: process.env.NEXT_PUBLIC_SIWE_URI || window.location.origin,
        version: "1",
        nonce,
        statement:
          "Sign in to Gopax. This signature does not submit a transaction or cost gas.",
        issuedAt: new Date(),
      });
      const signature = await signMessageAsync({ message });
      const data = await request<{ token: string; user: User }>(
        "/auth/verify",
        {
          method: "POST",
          body: JSON.stringify({ message, signature }),
        },
      );
      if (
        activeAddress.current?.toLowerCase() !== wallet.toLowerCase() ||
        epoch !== generation.current
      ) {
        throw new Error("Wallet changed");
      }
      setSession(data);
      return data.user;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Context.Provider
      value={{
        user,
        ready,
        busy,
        login,
        api,
        logout: () => {
          clear();
          disconnect();
        },
        setUser: (user) =>
          setSession((current) => (current ? { ...current, user } : null)),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("SessionProvider missing");
  return context;
}
