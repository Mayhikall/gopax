import { number, quantity } from "@/lib/format";
import { transports, transportLabels, type Trip } from "@/types";

export type ImpactPeriod = "all" | "year" | "month" | "week" | "day";

function savingsLabel(saved: number | null) {
  if (saved === null) return "No car comparison";
  if (saved <= 0) return "No savings";
  return `${quantity(saved)} kg saved`;
}

export function ImpactCharts({ trips }: { trips: Trip[] }) {
  const rows = transports
    .map((category) => {
      const modeTrips = trips.filter(
        (trip) => trip.status === "VERIFIED" && trip.category === category,
      );
      const comparedTrips = modeTrips.filter(
        (trip) =>
          trip.comparison?.type === "SYSTEM" &&
          trip.comparison.category === "CAR" &&
          number(trip.carbonReductionKg) !== null,
      );
      return {
        category,
        count: modeTrips.length,
        emitted: modeTrips.reduce(
          (sum, trip) => sum + (number(trip.carbonEmissionKg) ?? 0),
          0,
        ),
        saved: comparedTrips.length
          ? comparedTrips.reduce(
              (sum, trip) =>
                sum + Math.max(0, number(trip.carbonReductionKg) ?? 0),
              0,
            )
          : null,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.emitted - a.emitted);

  const maxEmission = Math.max(...rows.map((row) => row.emitted), 1);

  return (
    <section className="impact-charts" aria-labelledby="emissions-by-mode-title">
      <figure className="impact-chart">
        <figcaption>
          <h2 id="emissions-by-mode-title">CO₂ emitted by transport</h2>
          <p>Estimated emissions from your verified journeys.</p>
        </figcaption>

        <div className="mode-emissions-list" role="list">
          {rows.map((row) => (
            <div className="mode-emissions-row" role="listitem" key={row.category}>
              <div className="mode-emissions-heading">
                <strong>{transportLabels[row.category]}</strong>
                <span>{quantity(row.emitted)} kg CO₂e</span>
              </div>
              <div className="mode-emissions-track" aria-hidden="true">
                <span style={{ width: `${(row.emitted / maxEmission) * 100}%` }} />
              </div>
              <div className="mode-emissions-meta">
                <span>{row.count} {row.count === 1 ? "trip" : "trips"}</span>
                <strong className={row.saved === null ? "muted" : ""}>
                  {savingsLabel(row.saved)}
                </strong>
              </div>
            </div>
          ))}
        </div>

        <p className="chart-note">
          Savings compare eligible bus and train journeys with driving.
        </p>
      </figure>
    </section>
  );
}
