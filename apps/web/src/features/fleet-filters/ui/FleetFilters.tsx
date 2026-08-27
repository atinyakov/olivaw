import type { RobotStatus } from '@olivaw/contracts';
import { statusLabels } from '../../../shared/model/fleet.js';
import './FleetFilters.css';

export function FleetFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: {
  search: string;
  status: RobotStatus | 'all';
  onSearchChange: (value: string) => void;
  onStatusChange: (value: RobotStatus | 'all') => void;
}) {
  return (
    <div className="filters">
      <label>
        <span className="sr-only">Search robots</span>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search robots"
        />
      </label>
      <label>
        <span className="sr-only">Filter by status</span>
        <select
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value as RobotStatus | 'all')
          }
        >
          <option value="all">All statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
