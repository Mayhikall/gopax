"use client";
import { Brand } from "@/components/brand";
import { AuthGuard } from "@/features/auth/auth-guard";
import { useSession } from "@/features/auth/session-provider";
import { ProfileForm, WalletIdentity } from "@/features/profile/profile-form";
export default function OnboardingPage() {
  const { user } = useSession();
  return (
    <AuthGuard onboarding>
      <main id="main" className="onboarding">
        <Brand />
        <section className="surface onboarding-card">
          <h1>What should we call you?</h1>
          <ProfileForm key={user?.id} onboarding />
          <div className="guide-divider" />
          <WalletIdentity address={user?.walletAddress || ""} />
        </section>
      </main>
    </AuthGuard>
  );
}
