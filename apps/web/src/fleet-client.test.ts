import type { FleetSnapshot } from '@olivaw/contracts';
import { robots, sites } from '@olivaw/contracts/fixtures';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FleetClient } from './fleet-client.js';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly listeners = new Map<string, (event: MessageEvent<string>) => void>();
  closed = false;

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.set(type, listener as (event: MessageEvent<string>) => void);
  }

  emit(type: string, data: unknown, lastEventId: number) {
    this.listeners.get(type)?.({
      data: JSON.stringify(data),
      lastEventId: String(lastEventId),
    } as MessageEvent<string>);
  }

  close() {
    this.closed = true;
  }
}

const reading = {
  robotId: 'bf-01',
  sequence: 1,
  observedAt: '2026-08-24T12:00:00.000Z',
  batteryPercent: 82,
  position: { x: 20, y: 30, heading: 90 },
  speedMps: 1.2,
  task: 'Delivering tote',
};

function makeSnapshot(eventId = 1): FleetSnapshot {
  return {
    eventId,
    serverTime: '2026-08-24T12:00:00.000Z',
    sites: [...sites],
    robots: [...robots],
    telemetry: { 'bf-01': reading },
    statuses: Object.fromEntries(
      robots.map((robot) => [
        robot.id,
        robot.id === 'bf-01' ? 'operational' : 'offline',
      ]),
    ),
    history: Object.fromEntries(
      robots.map((robot) => [
        robot.id,
        robot.id === 'bf-01'
          ? Array.from({ length: 75 }, (_, index) => ({
              observedAt: new Date(
                Date.UTC(2026, 7, 24, 12, 0, index),
              ).toISOString(),
              batteryPercent: 82,
              speedMps: 1.2,
            }))
          : [],
      ]),
    ),
  };
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('FleetClient', () => {
  it('validates snapshots and keeps only the configured history window', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(makeSnapshot()))),
    );
    const client = new FleetClient('http://api');

    await client.start();

    expect(client.getSnapshot().snapshot?.history['bf-01']).toHaveLength(60);
    expect(MockEventSource.instances[0]?.url).toBe('http://api/api/v1/events');
    client.stop();
  });

  it('applies ordered live events and ignores duplicate event IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(makeSnapshot()))),
    );
    const client = new FleetClient('http://api');
    await client.start();
    const source = MockEventSource.instances[0]!;
    const update = {
      readings: [{ ...reading, sequence: 2, batteryPercent: 70 }],
      statuses: { 'bf-01': 'operational' },
    };

    source.emit('telemetry.updated', update, 2);
    source.emit(
      'telemetry.updated',
      {
        ...update,
        readings: [{ ...reading, sequence: 3, batteryPercent: 10 }],
      },
      2,
    );

    expect(
      client.getSnapshot().snapshot?.telemetry['bf-01']?.batteryPercent,
    ).toBe(70);
    expect(client.getSnapshot().snapshot?.eventId).toBe(2);
    client.stop();
  });

  it('refreshes from REST after reconnecting', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeSnapshot(1))))
      .mockResolvedValueOnce(new Response(JSON.stringify(makeSnapshot(5))));
    vi.stubGlobal('fetch', fetchMock);
    const client = new FleetClient('http://api');
    await client.start();
    const source = MockEventSource.instances[0]!;

    source.onerror?.();
    expect(client.getSnapshot().connection).toBe('reconnecting');
    source.onopen?.();
    await vi.waitFor(() =>
      expect(client.getSnapshot().snapshot?.eventId).toBe(5),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.getSnapshot().connection).toBe('live');
    client.stop();
  });

  it('rejects invalid REST payloads and exposes recovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ eventId: 1 }))),
    );
    const client = new FleetClient('http://api');

    await client.start();

    expect(client.getSnapshot()).toMatchObject({
      snapshot: null,
      connection: 'unavailable',
      error: 'Fleet response was invalid',
    });
  });

  it('refreshes the snapshot after a malformed live event', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeSnapshot(1))))
      .mockResolvedValueOnce(new Response(JSON.stringify(makeSnapshot(4))));
    vi.stubGlobal('fetch', fetchMock);
    const client = new FleetClient('http://api');
    await client.start();

    MockEventSource.instances[0]!.emit(
      'telemetry.updated',
      { readings: [] },
      2,
    );
    await vi.waitFor(() =>
      expect(client.getSnapshot().snapshot?.eventId).toBe(4),
    );

    expect(client.getSnapshot().connection).toBe('live');
    client.stop();
  });

  it('marks a prolonged reconnect as unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(makeSnapshot()))),
    );
    const client = new FleetClient('http://api', {
      reconnectUnavailableMs: 20,
    });
    await client.start();

    MockEventSource.instances[0]!.onerror?.();
    await vi.waitFor(() =>
      expect(client.getSnapshot().connection).toBe('unavailable'),
    );

    expect(client.getSnapshot().error).toBe(
      'Live telemetry connection is unavailable',
    );
    client.stop();
  });

  it('keeps a healthy stream live when its reconnect refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makeSnapshot(1))))
      .mockRejectedValueOnce(new Error('refresh failed'));
    vi.stubGlobal('fetch', fetchMock);
    const client = new FleetClient('http://api');
    await client.start();
    const source = MockEventSource.instances[0]!;

    source.onerror?.();
    source.onopen?.();
    await vi.waitFor(() =>
      expect(client.getSnapshot().error).toBe('refresh failed'),
    );
    expect(client.getSnapshot().connection).toBe('live');

    source.emit(
      'telemetry.updated',
      {
        readings: [{ ...reading, sequence: 2, batteryPercent: 70 }],
        statuses: { 'bf-01': 'operational' },
      },
      2,
    );
    expect(client.getSnapshot()).toMatchObject({
      connection: 'live',
      error: null,
    });
    client.stop();
  });
});
