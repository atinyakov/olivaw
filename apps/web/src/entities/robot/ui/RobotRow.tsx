import type { FleetSnapshot, Robot } from '@olivaw/contracts';
import { statusLabels } from '../../../shared/model/fleet.js';
import '../../../shared/ui/status.css';
import './RobotRow.css';

export function RobotRow({
  robot,
  snapshot,
  selected,
  onSelect,
}: {
  robot: Robot;
  snapshot: FleetSnapshot;
  selected: boolean;
  onSelect: () => void;
}) {
  const telemetry = snapshot.telemetry[robot.id];
  const status = snapshot.statuses[robot.id] ?? 'offline';
  return (
    <button
      className={`robot-row ${selected ? 'selected' : ''}`}
      aria-label={`Open details for ${robot.name}`}
      onClick={onSelect}
    >
      <span className={`robot-avatar status-${status}`}>
        {robot.name.slice(0, 1)}
      </span>
      <span className="robot-name">
        <strong>{robot.name}</strong>
        <small>
          {robot.id} · {telemetry?.task ?? 'Awaiting telemetry'}
        </small>
      </span>
      <span className="robot-metric">
        <strong>
          {telemetry ? `${Math.round(telemetry.batteryPercent)}%` : '—'}
        </strong>
        <small>
          <i className={`status-dot status-${status}`} />
          {statusLabels[status]}
        </small>
      </span>
    </button>
  );
}
