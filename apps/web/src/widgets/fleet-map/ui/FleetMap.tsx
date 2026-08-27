import type { FleetSnapshot, Robot, Site } from '@olivaw/contracts';
import { statusLabels } from '../../../shared/model/fleet.js';
import '../../../shared/ui/status.css';
import './FleetMap.css';

export function FleetMap({
  site,
  robots,
  snapshot,
  selectedId,
  onSelect,
}: {
  site: Site;
  robots: Robot[];
  snapshot: FleetSnapshot;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <svg
      className="floorplan"
      viewBox="0 0 100 100"
      role="group"
      aria-label={`${site.name} live robot floorplan`}
    >
      <title>{site.name} live robot floorplan</title>
      <rect className="floor" x="1" y="1" width="98" height="98" rx="3" />
      {site.features.map((feature) => (
        <g key={feature.id} className={`feature feature-${feature.type}`}>
          <rect
            x={feature.x}
            y={feature.y}
            width={feature.width}
            height={feature.height}
            rx="1.5"
          />
          <text x={feature.x + 2} y={feature.y + 5}>
            {feature.label}
          </text>
        </g>
      ))}
      <path
        className="route-line"
        d="M 8 52 H 28 Q 32 52 32 48 V 18 M 32 52 H 72 Q 76 52 76 48 V 18 M 32 58 H 76"
      />
      {robots.map((robot) => {
        const telemetry = snapshot.telemetry[robot.id];
        if (!telemetry) return null;
        const status = snapshot.statuses[robot.id] ?? 'offline';
        return (
          <g
            key={robot.id}
            className={`robot-marker marker-${status} ${selectedId === robot.id ? 'selected' : ''}`}
            transform={`translate(${telemetry.position.x} ${telemetry.position.y})`}
            role="button"
            tabIndex={0}
            aria-label={`${robot.name}, ${statusLabels[status]}, battery ${Math.round(telemetry.batteryPercent)} percent`}
            onClick={() => onSelect(robot.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(robot.id);
              }
            }}
          >
            <circle r="3.3" />
            <path
              d="M 0 -2 L 1.3 1.6 L 0.1 1 L -1.3 1.6 Z"
              transform={`rotate(${telemetry.position.heading + 90})`}
            />
            <text x="4.6" y="1.2">
              {robot.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function FleetMapLegend() {
  return (
    <div className="legend" aria-label="Status legend">
      {Object.entries(statusLabels).map(([key, label]) => (
        <span key={key}>
          <i className={`status-dot status-${key}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
