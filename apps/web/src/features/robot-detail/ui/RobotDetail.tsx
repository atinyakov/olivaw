import type { FleetSnapshot, Robot } from '@olivaw/contracts';
import { useEffect, useRef } from 'react';
import { formatRelative, statusLabels } from '../../../shared/model/fleet.js';
import { EmptyState } from '../../../shared/ui/EmptyState.js';
import { Sparkline } from '../../../shared/ui/Sparkline.js';
import '../../../shared/ui/status.css';
import './RobotDetail.css';

export function RobotDetail({
  robot,
  snapshot,
  onClose,
}: {
  robot: Robot;
  snapshot: FleetSnapshot;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const telemetry = snapshot.telemetry[robot.id];
  const status = snapshot.statuses[robot.id] ?? 'offline';

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const background = [
      document.querySelector<HTMLElement>('.topbar'),
      document.querySelector<HTMLElement>('main'),
    ].filter((element): element is HTMLElement => element !== null);
    for (const element of background) element.setAttribute('inert', '');
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const drawer = closeRef.current?.closest<HTMLElement>('[role="dialog"]');
      const focusable = drawer
        ? [
            ...drawer.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ]
        : [];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      for (const element of background) element.removeAttribute('inert');
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="robot-detail-title"
      >
        <div className="drawer-head">
          <div>
            <p className="eyebrow">Robot detail</p>
            <h2 id="robot-detail-title">{robot.name}</h2>
            <span>
              {robot.model} · {robot.id}
            </span>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            onClick={onClose}
            aria-label="Close robot details"
          >
            ×
          </button>
        </div>
        <div className={`health-banner status-${status}`}>
          <i className={`status-dot status-${status}`} />
          <div>
            <strong>{statusLabels[status]}</strong>
            <span>
              {telemetry?.fault ??
                (status === 'operational'
                  ? 'All systems nominal'
                  : 'Telemetry needs attention')}
            </span>
          </div>
        </div>
        {telemetry ? (
          <>
            <div className="detail-grid">
              <Metric
                label="Battery"
                value={`${Math.round(telemetry.batteryPercent)}%`}
              />
              <Metric
                label="Speed"
                value={`${telemetry.speedMps.toFixed(1)} m/s`}
              />
              <Metric
                label="Heading"
                value={`${Math.round(telemetry.position.heading)}°`}
              />
              <Metric
                label="Position"
                value={`${telemetry.position.x.toFixed(1)}, ${telemetry.position.y.toFixed(1)}`}
                testId="robot-position"
              />
            </div>
            <section className="task-card">
              <span>Current task</span>
              <strong>{telemetry.task}</strong>
              <small>Last update {formatRelative(telemetry.observedAt)}</small>
            </section>
            <HistoryChart
              label="Battery"
              samples={snapshot.history[robot.id] ?? []}
              value="batteryPercent"
            />
            <HistoryChart
              label="Speed"
              samples={snapshot.history[robot.id] ?? []}
              value="speedMps"
            />
          </>
        ) : (
          <EmptyState title="Awaiting first telemetry reading" />
        )}
      </aside>
    </div>
  );
}

function Metric({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong data-testid={testId}>{value}</strong>
    </div>
  );
}

function HistoryChart({
  label,
  samples,
  value,
}: {
  label: string;
  samples: FleetSnapshot['history'][string];
  value: 'batteryPercent' | 'speedMps';
}) {
  return (
    <section className="chart-section">
      <div>
        <strong>{label}</strong>
        <span>Last 60 readings</span>
      </div>
      <Sparkline samples={samples.slice(-60)} value={value} />
    </section>
  );
}
