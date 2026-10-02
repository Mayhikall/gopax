"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { request, ApiError } from "@/lib/api";
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
    (method: LoginMethod = "google") => {
      privyLogin({ loginMethods: [method] });
    },
    [privyLogin],
  );

  return (
    <Context.Provider
      value={{
        user,
        ready,
        busy: isModalOpen || syncing,
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
