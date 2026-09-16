"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import type { Impact, Trip, TripPage } from "@/types";

export function useImpact(demo = false) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["impact", user?.id],
    enabled: !!user && !demo,
    queryFn: ({ signal }) => api<Impact>("/impact", { signal }),
  });
}
export function useTrips(category = "", rewardStatus = "", demo = false) {
  const { api, user } = useSession();
  return useInfiniteQuery({
    queryKey: ["trips", user?.id, category, rewardStatus],
    enabled: !!user && !demo,
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) =>
      api<TripPage>(
        `/trips?${new URLSearchParams({ limit: "12", offset: String(pageParam), ...(category && { category }), ...(rewardStatus && { rewardStatus }) })}`,
        { signal },
      ),
    getNextPageParam: (last) =>
      last.hasMore ? (last.nextOffset ?? undefined) : undefined,
  });
}
export function useTrip(id: string, demo = false) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["trip", user?.id, id],
    enabled: !!user && !demo,
    queryFn: ({ signal }) =>
      api<Trip>(`/trips/${encodeURIComponent(id)}`, { signal }),
  });
}
