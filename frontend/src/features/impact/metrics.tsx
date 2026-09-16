import { type LucideIcon } from "lucide-react";
import { TransportIcon } from "@/components/common";
import { transports, transportLabels, type Impact } from "@/types";

export function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  caption,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  unit?: string;
  caption: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-heading">
        <span>{label}</span>
        <Icon size={19} />
      </div>
      <div className="metric-value">
        {value} {unit && <small>{unit}</small>}
      </div>
      <p>{caption}</p>
    </article>
  );
}
export function TransportBreakdown({ impact }: { impact: Impact }) {
  const total = impact.transportBreakdown.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  return (
    <section className="surface transport-breakdown">
      <div className="section-heading">
        <h2>Your transport mix</h2>
        <span className="subtle">By trip count</span>
      </div>
      <div className="breakdown-rows">
        {transports.map((category) => {
          const count =
            impact.transportBreakdown.find((row) => row.category === category)
              ?.count ?? 0;
          return (
            <div className="breakdown-row" key={category}>
              <TransportIcon category={category} />
              <span>{transportLabels[category]}</span>
              <div className="bar-track" aria-hidden="true">
                <div
                  style={{ width: `${total ? (count / total) * 100 : 0}%` }}
                />
              </div>
              <strong>
                {count}
                <span className="sr-only"> verified trips</span>
              </strong>
            </div>
          );
        })}
      </div>
      <p className="subtle breakdown-note">
        Each journey is one trip. This breakdown does not rank transport by
        emissions.
      </p>
    </section>
  );
}
