import type { TelemetryReading } from '@olivaw/contracts';
import { robots, sites } from '@olivaw/contracts/fixtures';
import { describe, expect, it, vi } from 'vitest';
import { FleetStore } from './store.js';

function reading(overrides: Partial<TelemetryReading> = {}): TelemetryReading {
  return {
    robotId: 'bf-01',
    sequence: 1,
    observedAt: '2026-08-24T12:00:00.000Z',
    batteryPercent: 80,
    position: { x: 20, y: 30, heading: 90 },
    speedMps: 1,
    task: 'Deliver tote',
    ...overrides,
  };
}

describe('FleetStore', () => {
  it('stores accepted readings and ignores older sequences', () => {
    const store = new FleetStore({
      sites,
      robots,
      now: () => Date.parse('2026-08-24T12:00:01Z'),
    });
    expect(store.ingest([reading()])).toMatchObject({
      accepted: 1,
      ignored: 0,
    });
    expect(store.ingest([reading({ sequence: 1 })])).toMatchObject({
      accepted: 0,
      ignored: 1,
    });
    expect(store.snapshot().telemetry['bf-01']?.sequence).toBe(1);
  });

  it('derives warning, stale, and offline states', () => {
    const now = vi.fn(() => Date.parse('2026-08-24T12:00:01Z'));
    const store = new FleetStore({ sites, robots, now });
    store.ingest([reading({ batteryPercent: 10 })]);
    expect(store.snapshot().statuses['bf-01']).toBe('warning');
    now.mockReturnValue(Date.parse('2026-08-24T12:00:06Z'));
    store.refreshStatuses();
    expect(store.snapshot().statuses['bf-01']).toBe('stale');
    now.mockReturnValue(Date.parse('2026-08-24T12:00:16Z'));
    store.refreshStatuses();
    expect(store.snapshot().statuses['bf-01']).toBe('offline');
  });

  it('uses server receipt time rather than robot clock for freshness', () => {
    const now = vi.fn(() => Date.parse('2026-08-24T12:00:00Z'));
    const store = new FleetStore({ sites, robots, now });
    store.ingest([
      reading({ observedAt: '2026-08-20T12:00:00.000Z', batteryPercent: 80 }),
    ]);
    expect(store.snapshot().statuses['bf-01']).toBe('operational');

    now.mockReturnValue(Date.parse('2026-08-24T12:00:05Z'));
    store.refreshStatuses();
    expect(store.snapshot().statuses['bf-01']).toBe('stale');
  });

  it('bounds history and reports replay gaps', () => {
    const store = new FleetStore({
      sites,
      robots,
      historyLimit: 2,
      replayLimit: 2,
    });
    for (let sequence = 1; sequence <= 3; sequence += 1) {
      store.ingest([
        reading({
          sequence,
          observedAt: new Date(
            1_700_000_000_000 + sequence * 1000,
          ).toISOString(),
        }),
      ]);
    }
    expect(store.snapshot().history['bf-01']).toHaveLength(2);
    expect(store.eventsAfter(0)).toBeNull();
  });
});
