import type { FleetSnapshot, Robot, RobotStatus } from '@olivaw/contracts';

export const statusLabels: Record<RobotStatus, string> = {
  operational: 'Operational',
  warning: 'Warning',
  stale: 'Stale',
  offline: 'Offline',
};

export function countStatuses(
  robots: Robot[],
  snapshot: FleetSnapshot,
): Record<RobotStatus, number> {
  return robots.reduce<Record<RobotStatus, number>>(
    (counts, robot) => {
      counts[snapshot.statuses[robot.id] ?? 'offline'] += 1;
      return counts;
    },
    { operational: 0, warning: 0, stale: 0, offline: 0 },
  );
}

export function formatRelative(timestamp: string): string {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - Date.parse(timestamp)) / 1000),
  );
  return seconds < 2 ? 'just now' : `${seconds}s ago`;
}
