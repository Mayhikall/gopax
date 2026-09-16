import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="onboarding">
      <Brand />
      <section className="empty-state">
        <span className="empty-icon">
          <MapPinOff size={28} />
        </span>
        <h1>A little off the route.</h1>
        <p>We couldn’t find this page. Let’s get you back on your way.</p>
        <Button asChild>
          <Link href="/">Back to Gopax</Link>
        </Button>
      </section>
    </main>
  );
}
