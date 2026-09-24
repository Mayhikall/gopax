"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Empty,
  ErrorState,
  Loading,
  TripCard,
} from "@/components/common";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { transports, transportLabels } from "@/types";
import { usePreview } from "@/components/layout/preview-context";
import { errorMessage } from "@/lib/api";
import { useTrips } from "./queries";

export function TripsScreen({
  demo = false,
  initialRewardStatus = "",
}: {
  demo?: boolean;
  initialRewardStatus?: string;
}) {
  const preview = usePreview();
  const [category, setCategory] = useState("");
  const [rewardStatus, setRewardStatus] = useState(initialRewardStatus);
  const query = useTrips(category, rewardStatus, demo);
  const trips = demo
    ? preview?.trips.filter(
        (trip) =>
          (!category || trip.category === category) &&
          (!rewardStatus || trip.reward?.status === rewardStatus),
      )
    : query.data?.pages.flatMap((page) => page.trips);
  return (
    <>
      <PageHeader
        title="Your trips"
        description="Your tickets, routes, and rewards in one travel record."
      />
      <div className="filter-bar">
        <SlidersHorizontal size={19} aria-hidden="true" />
        <label>
          Transport
          <select
            aria-label="Transport"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All transport</option>
            {transports.map((value) => (
              <option key={value} value={value}>
                {transportLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reward status
          <select
            aria-label="Reward status"
            value={rewardStatus}
            onChange={(event) => setRewardStatus(event.target.value)}
          >
            <option value="">All rewards</option>
            <option value="AVAILABLE">Available</option>
            <option value="CLAIMED">Claimed</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>
        {(category || rewardStatus) && (
          <Button
            variant="ghost"
            onClick={() => {
              setCategory("");
              setRewardStatus("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      {query.isError && !demo && !trips ? (
        <ErrorState
          message={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : !trips ? (
        <Loading />
      ) : (
        <>
          <p className="list-caption" role="status">
            {trips.length} {trips.length === 1 ? "journey" : "journeys"} shown ·
            Newest first
          </p>
          {trips.length ? (
            <div className="trip-list">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} demo={demo} />
              ))}
            </div>
          ) : (
            <Empty
              title={
                category || rewardStatus
                  ? "No journeys match these filters"
                  : undefined
              }
              description={
                category || rewardStatus
                  ? "Try another transport or reward status to find your journey."
                  : undefined
              }
              demo={demo}
            />
          )}
          {query.isError && (
            <ErrorState
              message={errorMessage(query.error)}
              retry={() => void query.fetchNextPage()}
            />
          )}
          {!demo && query.hasNextPage && (
            <div className="load-more">
              <Button
                variant="outline"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
