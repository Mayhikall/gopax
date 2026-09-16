"use client";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ErrorState } from "@/components/feedback";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main id="main" className="onboarding">
      <Brand />
      <h1>This page needs another try.</h1>
      <ErrorState
        message="We couldn’t load this page. Your saved journeys are still yours."
        retry={retry}
      />
      <Link className="back-link" href="/">
        Return to Gopax
      </Link>
    </main>
  );
}
