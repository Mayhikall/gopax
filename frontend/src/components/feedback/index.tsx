"use client";
import Link from "next/link";
import { LoaderCircle, AlertCircle, Ticket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pathFor } from "@/lib/navigation";
export function Loading({
  label = "Loading your journeys…",
}: {
  label?: string;
}) {
  return (
    <div className="state-card" role="status">
      <LoaderCircle className="spin" size={27} />
      <p>{label}</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Something needs a second look</strong>
        <p>{message}</p>
        {retry && (
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = "Your next journey starts here",
  description = "Upload your first ticket to understand your travel impact.",
  demo = false,
}: {
  title?: string;
  description?: string;
  demo?: boolean;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Ticket size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <Button asChild variant="outline">
        <Link href={pathFor("/trips/new", demo)}>
          Add a trip <ArrowRight size={16} />
        </Link>
      </Button>
    </div>
  );
}
