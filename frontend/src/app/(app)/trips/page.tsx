import { TripsScreen } from "@/features/trips/trips-screen";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ rewardStatus?: string }>;
}) {
  const { rewardStatus } = await searchParams;
  return (
    <TripsScreen
      initialRewardStatus={
        ["AVAILABLE", "CLAIMED", "FAILED"].includes(rewardStatus || "")
          ? rewardStatus
          : ""
      }
    />
  );
}
