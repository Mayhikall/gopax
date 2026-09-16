"use client";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/features/auth/auth-guard";
import { Shell } from "@/components/layout/app-shell";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AuthGuard>
      <Shell screen={pathname}>{children}</Shell>
    </AuthGuard>
  );
}
