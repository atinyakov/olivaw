import type { FleetSnapshot, Robot } from '@olivaw/contracts';
import { countStatuses } from '../../../shared/model/fleet.js';
import './FleetSummary.css';

export function FleetSummary({
  robots,
  snapshot,
}: {
  robots: Robot[];
  snapshot: FleetSnapshot;
}) {
  const counts = countStatuses(robots, snapshot);
  return (
    <section className="kpi-grid" aria-label="Fleet status summary">
      <Kpi label="Total robots" value={robots.length} tone="neutral" />
      <Kpi label="Operational" value={counts.operational} tone="good" />
      <Kpi
        label="Needs attention"
        value={counts.warning + counts.stale}
        tone="warn"
      />
      <Kpi label="Offline" value={counts.offline} tone="danger" />
    </section>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <article className={`kpi kpi-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>
        <i /> Current site
      </small>
    </article>
  );
}
