"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePrivy, useWallets, useLoginWithSiwe } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { request, ApiError } from "@/lib/api";
import { CHAIN_ID } from "@/lib/web3/config";
import type { User } from "@/types";

type LoginMethod = "google" | "wallet";
type Session = {
  user: User | null;
  ready: boolean;
  busy: boolean;
  login: (method?: LoginMethod) => Promise<void> | void;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
};

const Context = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const {
    ready: privyReady,
    authenticated,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
    isModalOpen,
  } = usePrivy();
  const { ready: walletsReady } = useWallets();
  const { generateSiweMessage, loginWithSiwe } = useLoginWithSiwe();
  const [directConnecting, setDirectConnecting] = useState(false);
  const cache = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const generation = useRef(0);
  const requests = useRef(new Set<AbortController>());

  const clear = useCallback(() => {
    generation.current += 1;
    requests.current.forEach((controller) => controller.abort());
    requests.current.clear();
    setUser(null);
    setSyncing(false);
    void cache.cancelQueries();
    cache.clear();
  }, [cache]);

  useEffect(() => {
    if (!privyReady) return;
    if (!authenticated) {
      clear();
      return;
    }
    if (!walletsReady) return;

    const epoch = generation.current;
    const controller = new AbortController();
    setSyncing(true);

    void getAccessToken()
      .then((token) => {
        if (!token) throw new ApiError("Privy session is unavailable.", 401);
        return request<User>("/users/me", { signal: controller.signal }, token);
      })
      .then((profile) => {
        if (!controller.signal.aborted && epoch === generation.current) {
          setUser(profile);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || epoch !== generation.current) return;
        setUser(null);
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error("[auth] Unable to restore Gopax profile:", error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && epoch === generation.current) {
          setSyncing(false);
        }
      });

    return () => controller.abort();
  }, [
    authenticated,
    clear,
    getAccessToken,
    privyReady,
    walletsReady,
  ]);

  const api = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      if (!authenticated || !user) {
        throw new ApiError("Please sign in to continue.", 401);
      }

      const epoch = generation.current;
      const controller = new AbortController();
      requests.current.add(controller);

      try {
        const token = await getAccessToken();
        if (!token) throw new ApiError("Your session has expired.", 401);
        const signal = options.signal
          ? AbortSignal.any([controller.signal, options.signal])
          : controller.signal;
        const data = await request<T>(path, { ...options, signal }, token);
        if (epoch !== generation.current) {
          throw new ApiError("Your session changed.", 401);
        }
        return data;
      } finally {
        requests.current.delete(controller);
      }
    },
    [authenticated, getAccessToken, user],
  );

  const ready =
    privyReady && (!authenticated || (walletsReady && !syncing));

  const login = useCallback(
    async (method: LoginMethod = "google") => {
      if (method === "wallet" && typeof window !== "undefined") {
        const anyWin = window as unknown as {
          ethereum?: {
            isBitKeep?: boolean;
            isMetaMask?: boolean;
            isCoinbaseWallet?: boolean;
            request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            providers?: Array<{
              isBitKeep?: boolean;
              request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            }>;
          };
          bitkeep?: {
            ethereum?: {
              request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            };
          };
        };

        const injected =
          anyWin.bitkeep?.ethereum ||
          anyWin.ethereum?.providers?.find((p) => p.isBitKeep) ||
          anyWin.ethereum;

        if (injected && typeof injected.request === "function") {
          try {
            setDirectConnecting(true);
            const accounts = (await injected.request({
              method: "eth_requestAccounts",
            })) as string[];

            if (!accounts || accounts.length === 0 || !accounts[0]) {
              throw new Error("No accounts found in connected wallet.");
            }

            const address = accounts[0];
            const message = await generateSiweMessage({
              address,
              chainId: `eip155:${CHAIN_ID}` as `eip155:${number}`,
            });

            const signature = (await injected.request({
              method: "personal_sign",
              params: [message, address],
            })) as string;

            const clientType =
              anyWin.bitkeep || anyWin.ethereum?.isBitKeep
                ? "bitget_wallet"
                : anyWin.ethereum?.isMetaMask
                  ? "metamask"
                  : anyWin.ethereum?.isCoinbaseWallet
                    ? "coinbase_wallet"
                    : "unknown_browser_extension";

            await loginWithSiwe({
              signature,
              message,
              walletClientType: clientType,
              connectorType: "injected",
            });
            return;
          } catch (error: unknown) {
            const err = error as { code?: number; message?: string };
            if (
              err?.code === 4001 ||
              err?.message?.includes("rejected") ||
              err?.message?.includes("denied")
            ) {
              throw new Error("Connection request was cancelled.");
            }
            console.warn(
              "[auth] Direct wallet connection failed, falling back to Privy modal:",
              error,
            );
          } finally {
            setDirectConnecting(false);
          }
        }
      }

      privyLogin({ loginMethods: [method] });
    },
    [generateSiweMessage, loginWithSiwe, privyLogin],
  );

  return (
    <Context.Provider
      value={{
        user,
        ready,
        busy: isModalOpen || syncing || directConnecting,
        login,
        logout: async () => {
          clear();
          await privyLogout();
        },
        setUser,
        api,
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
