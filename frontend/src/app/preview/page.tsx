import { Shell } from "@/components/layout/app-shell";
import { HomeScreen } from "@/features/impact/home-screen";
import { ImpactScreen } from "@/features/impact/impact-screen";
import { TripsScreen } from "@/features/trips/trips-screen";
import { TripDetail } from "@/features/trips/trip-detail";
import { UploadProof } from "@/features/trips/upload-proof";
import { ProfileScreen } from "@/features/profile/profile-screen";
import { notFound } from "next/navigation";
import {
  PreviewControls,
  PreviewProvider,
  PreviewState,
} from "@/components/layout/preview-context";
import { previewData } from "@/fixtures/journeys";
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; state?: string }>;
}) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_PREVIEW !== "true"
  )
    notFound();
  const { screen = "/home", state = "default" } = await searchParams;
  const url = new URL(
    screen.startsWith("/") ? screen : "/home",
    "https://preview.invalid",
  );
  const path = url.pathname;
  const content =
    path === "/impact" ? (
      <ImpactScreen demo />
    ) : path === "/trips/new" ? (
      <UploadProof demo />
    ) : path === "/trips" ? (
      <TripsScreen
        demo
        initialRewardStatus={url.searchParams.get("rewardStatus") || ""}
      />
    ) : path.startsWith("/trips/") ? (
      <TripDetail demo id={path.slice(7)} />
    ) : path === "/profile" ? (
      <ProfileScreen demo />
    ) : (
      <HomeScreen demo />
    );
  return (
    <PreviewProvider data={previewData(state)}>
      <Shell demo screen={path}>
        <PreviewControls />
        <PreviewState>
          <div key={`${screen}:${state}`}>{content}</div>
        </PreviewState>
      </Shell>
    </PreviewProvider>
  );
}
