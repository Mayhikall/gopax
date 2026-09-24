import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  title,
  description,
  back,
  backLabel = "Back to trips",
  children,
}: {
  title: string;
  description?: string;
  back?: string;
  backLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {back && (
          <Link className="back-link" href={back}>
            <ArrowLeft size={16} /> {backLabel}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}
