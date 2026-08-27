import type {
  FleetEvent,
  FleetSnapshot,
  IngestionResult,
  Robot,
  RobotStatus,
  Site,
  TelemetryReading,
  TelemetrySample,
} from '@olivaw/contracts';

type Listener = (event: FleetEvent) => void;

export interface FleetStoreOptions {
  sites: readonly Site[];
  robots: readonly Robot[];
  now?: () => number;
  historyLimit?: number;
  replayLimit?: number;
}

export class FleetStore {
  readonly #sites: readonly Site[];
  readonly #robots: readonly Robot[];
  readonly #robotIds: Set<string>;
  readonly #now: () => number;
  readonly #historyLimit: number;
  readonly #replayLimit: number;
  readonly #latest = new Map<string, TelemetryReading>();
  readonly #receivedAt = new Map<string, number>();
  readonly #history = new Map<string, TelemetrySample[]>();
  readonly #statuses = new Map<string, RobotStatus>();
  readonly #events: FleetEvent[] = [];
  readonly #listeners = new Set<Listener>();
  #eventId = 0;

  constructor(options: FleetStoreOptions) {
    this.#sites = options.sites;
    this.#robots = options.robots;
    this.#robotIds = new Set(options.robots.map((robot) => robot.id));
    this.#now = options.now ?? Date.now;
    this.#historyLimit = options.historyLimit ?? 120;
    this.#replayLimit = options.replayLimit ?? 500;

    for (const robot of options.robots) {
      this.#statuses.set(robot.id, 'offline');
      this.#history.set(robot.id, []);
    }
  }

  hasRobot(robotId: string): boolean {
    return this.#robotIds.has(robotId);
  }

  ingest(readings: readonly TelemetryReading[]): IngestionResult {
    const accepted: TelemetryReading[] = [];
    let ignored = 0;
    const receivedAt = this.#now();

    for (const reading of readings) {
      const previous = this.#latest.get(reading.robotId);
      if (
        previous &&
        (reading.sequence <= previous.sequence ||
          Date.parse(reading.observedAt) <= Date.parse(previous.observedAt))
      ) {
        ignored += 1;
        continue;
      }

      this.#latest.set(reading.robotId, reading);
      this.#receivedAt.set(reading.robotId, receivedAt);
      const samples = this.#history.get(reading.robotId) ?? [];
      samples.push({
        observedAt: reading.observedAt,
        batteryPercent: reading.batteryPercent,
        speedMps: reading.speedMps,
      });
      if (samples.length > this.#historyLimit) {
        samples.splice(0, samples.length - this.#historyLimit);
      }
      this.#history.set(reading.robotId, samples);
      accepted.push(reading);
    }

    if (accepted.length > 0) {
      const nextStatuses: Record<string, RobotStatus> = {};
      for (const reading of accepted) {
        const previousStatus = this.#statuses.get(reading.robotId) ?? 'offline';
        const status = this.#deriveStatus(reading, receivedAt, receivedAt);
        this.#statuses.set(reading.robotId, status);
        nextStatuses[reading.robotId] = status;
        if (status !== previousStatus) {
          this.#publish('status.changed', {
            robotId: reading.robotId,
            previousStatus,
            status,
          });
        }
      }
      this.#publish('telemetry.updated', {
        readings: accepted,
        statuses: nextStatuses,
      });
    }

    return { accepted: accepted.length, ignored, eventId: this.#eventId };
  }

  refreshStatuses(): number {
    let changes = 0;
    const now = this.#now();
    for (const [robotId, reading] of this.#latest) {
      const previousStatus = this.#statuses.get(robotId) ?? 'offline';
      const receivedAt = this.#receivedAt.get(robotId) ?? now;
      const status = this.#deriveStatus(reading, receivedAt, now);
      if (status !== previousStatus) {
        this.#statuses.set(robotId, status);
        this.#publish('status.changed', { robotId, previousStatus, status });
        changes += 1;
      }
    }
    return changes;
  }

  snapshot(): FleetSnapshot {
    return {
      eventId: this.#eventId,
      serverTime: new Date(this.#now()).toISOString(),
      sites: [...this.#sites],
      robots: [...this.#robots],
      telemetry: Object.fromEntries(this.#latest),
      statuses: Object.fromEntries(this.#statuses),
      history: Object.fromEntries(
        [...this.#history].map(([id, samples]) => [id, [...samples]]),
      ),
    };
  }

  snapshotEvent(): FleetEvent {
    const snapshot = this.snapshot();
    return {
      id: snapshot.eventId,
      emittedAt: snapshot.serverTime,
      type: 'fleet.snapshot',
      data: snapshot,
    };
  }

  eventsAfter(lastEventId: number): FleetEvent[] | null {
    if (lastEventId >= this.#eventId) return [];
    const oldest = this.#events[0]?.id ?? this.#eventId + 1;
    if (lastEventId < oldest - 1) return null;
    return this.#events.filter((event) => event.id > lastEventId);
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #deriveStatus(
    reading: TelemetryReading,
    receivedAt: number,
    now: number,
  ): RobotStatus {
    const age = now - receivedAt;
    if (age >= 15_000) return 'offline';
    if (age >= 5_000) return 'stale';
    if (reading.fault || reading.batteryPercent < 20) return 'warning';
    return 'operational';
  }

  #publish<T extends FleetEvent['type']>(
    type: T,
    data: Extract<FleetEvent, { type: T }>['data'],
  ): void {
    this.#eventId += 1;
    const event = {
      id: this.#eventId,
      emittedAt: new Date(this.#now()).toISOString(),
      type,
      data,
    } as Extract<FleetEvent, { type: T }>;
    this.#events.push(event);
    if (this.#events.length > this.#replayLimit) {
      this.#events.splice(0, this.#events.length - this.#replayLimit);
    }
    for (const listener of this.#listeners) listener(event);
  }
}
