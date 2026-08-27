import type { FleetSnapshot, Robot } from '@olivaw/contracts';
import { RobotRow } from '../../../entities/robot/index.js';
import { EmptyState } from '../../../shared/ui/EmptyState.js';
import './RobotList.css';

export function RobotList({
  robots,
  snapshot,
  selectedId,
  mobileView,
  onSelect,
}: {
  robots: Robot[];
  snapshot: FleetSnapshot;
  selectedId: string | null;
  mobileView: 'map' | 'list';
  onSelect: (id: string) => void;
}) {
  return (
    <aside
      id="fleet-list-panel"
      className={`robot-list mobile-${mobileView}`}
      aria-label="Robots"
    >
      <div className="list-heading">
        <strong>{robots.length} robots</strong>
        <span>Updated continuously</span>
      </div>
      {robots.length ? (
        robots.map((robot) => (
          <RobotRow
            key={robot.id}
            robot={robot}
            snapshot={snapshot}
            selected={selectedId === robot.id}
            onSelect={() => onSelect(robot.id)}
          />
        ))
      ) : (
        <EmptyState
          title="No robots found"
          description="Try changing the search or status filter."
        />
      )}
    </aside>
  );
}
