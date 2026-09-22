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
import type { User } from "@/types";
import { CHAIN_ID } from "@/lib/web3/config";

type StoredSession = { token: string; user: User };
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
const SESSION_STORAGE_KEY = "gopax.auth.session.v1";

function readStoredSession(): StoredSession | null {
  try {
    const value = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<StoredSession>;
    const user = parsed.user;
    if (
      typeof parsed.token !== "string" ||
      !parsed.token ||
      !user ||
      typeof user.id !== "string" ||
      typeof user.walletAddress !== "string" ||
      (user.name !== null && typeof user.name !== "string")
    ) {
      writeStoredSession(null);
      return null;
    }
    return { token: parsed.token, user };
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null) {
  try {
    if (session)
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Authentication still works for this tab when storage is unavailable.
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const cache = useQueryClient();

  const [session, setSession] = useState<StoredSession | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeAddress = useRef(address);
  const generation = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const requests = useRef(new Set<AbortController>());

  useEffect(() => {
    activeAddress.current = address;
  }, [address]);

  const clear = useCallback(() => {
    generation.current++;
    tokenRef.current = null;
    writeStoredSession(null);
    requests.current.forEach((controller) => controller.abort());
    requests.current.clear();
    setSession(null);
    setReady(true);
    void cache.cancelQueries();
    cache.clear();
  }, [cache]);

  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      setReady(true);
      return;
    }

    const epoch = generation.current;
    const controller = new AbortController();
    tokenRef.current = stored.token;
    setSession(stored);
    setReady(true);

    void request<User>(
      "/users/me",
      { signal: controller.signal },
      stored.token,
    )
      .then((freshUser) => {
        if (epoch !== generation.current) return;
        const connectedAddress = activeAddress.current;
        if (
          connectedAddress &&
          freshUser.walletAddress.toLowerCase() !==
            connectedAddress.toLowerCase()
        ) {
          clear();
          return;
        }
        const restored = { token: stored.token, user: freshUser };
        tokenRef.current = stored.token;
        setSession(restored);
        writeStoredSession(restored);
      })
      .catch((error) => {
        if (controller.signal.aborted || epoch !== generation.current) return;
        if (error instanceof ApiError && error.status === 401) clear();
      });

    return () => controller.abort();
  }, [clear]);

  useEffect(() => {
    if (
      !address ||
      !isConnected ||
      !session ||
      session.user.walletAddress.toLowerCase() === address.toLowerCase()
    )
      return;
    clear();
  }, [address, isConnected, session, clear]);

  const user =
    session &&
    (!address ||
      session.user.walletAddress.toLowerCase() === address.toLowerCase())
      ? session.user
      : null;

  const api = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      if (
        !session ||
        !user ||
        tokenRef.current !== session.token ||
        (activeAddress.current &&
          activeAddress.current.toLowerCase() !==
            user.walletAddress.toLowerCase())
      )
        throw new ApiError("Please sign in to continue.", 401);
      const epoch = generation.current;
      const controller = new AbortController();
      requests.current.add(controller);
      try {
        const signal = options.signal
          ? AbortSignal.any([controller.signal, options.signal])
          : controller.signal;
        const data = await request<T>(
          path,
          { ...options, signal },
          session.token,
        );
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
      } finally {
        requests.current.delete(controller);
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
      const nextSession = { token: data.token, user: data.user };
      tokenRef.current = nextSession.token;
      setSession(nextSession);
      writeStoredSession(nextSession);
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
        setUser: (user) => {
          setSession((current) => {
            if (!current) return null;
            const updated = { ...current, user };
            writeStoredSession(updated);
            return updated;
          });
        },
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
