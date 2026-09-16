"use client";
import { createContext, useContext } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Impact, Trip } from "@/types";
import { ErrorState, Loading } from "@/components/feedback";

export type PreviewData = {
  trips: Trip[];
  impact: Impact;
  state: string;
  balance: string;
};
const Context = createContext<PreviewData | null>(null);
export const usePreview = () => useContext(Context);
export function PreviewProvider({
  data,
  children,
}: {
  data: PreviewData;
  children: React.ReactNode;
}) {
  return <Context.Provider value={data}>{children}</Context.Provider>;
}
export function PreviewControls() {
  const data = usePreview();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="preview-controls">
      Preview state
      <select
        aria-label="Preview state"
        value={data?.state || "default"}
        onChange={(event) => {
          const next = new URLSearchParams(params);
          next.set("state", event.target.value);
          router.replace(`${pathname}?${next}`);
        }}
      >
        {[
          ["default", "Sample journeys"],
          ["empty", "Empty account"],
          ["pending", "Processing"],
          ["unavailable", "Assessment unavailable"],
          ["no-reward", "No reward"],
          ["no-comparison", "No comparison"],
          ["negative", "Negative comparison"],
          ["zero", "Zero savings"],
          ["tiny", "Small values"],
          ["long-route", "Long route names"],
          ["loading", "Loading"],
          ["error", "Service error"],
        ].map(([value, label]) => (
          <option value={value} key={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function PreviewState({ children }: { children: React.ReactNode }) {
  const data = usePreview();
  const router = useRouter();
  const params = useSearchParams();
  if (data?.state === "loading") return <Loading />;
  if (data?.state === "error")
    return (
      <ErrorState
        message="Sample service error. Your trips are still saved. Try again to restore the sample journeys."
        retry={() => {
          const next = new URLSearchParams(params);
          next.delete("state");
          router.replace(`/preview?${next}`);
        }}
      />
    );
  return children;
}
