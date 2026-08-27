import type {
  FleetSnapshot,
  RobotStatus,
  StatusChangedData,
  TelemetryReading,
  TelemetryUpdatedData,
} from '@olivaw/contracts';
import {
  isFleetSnapshot,
  isStatusChangedData,
  isTelemetryUpdatedData,
} from '@olivaw/contracts';

export type ConnectionState =
  'connecting' | 'live' | 'reconnecting' | 'unavailable';

export interface ClientState {
  snapshot: FleetSnapshot | null;
  connection: ConnectionState;
  error: string | null;
}

const HISTORY_LIMIT = 60;

export interface FleetClientOptions {
  reconnectUnavailableMs?: number;
}

export class FleetClient {
  readonly #apiUrl: string;
  readonly #listeners = new Set<() => void>();
  #state: ClientState = {
    snapshot: null,
    connection: 'connecting',
    error: null,
  };
  #source: EventSource | null = null;
  #started = false;
  #generation = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #needsRefresh = false;
  readonly #reconnectUnavailableMs: number;

  constructor(apiUrl: string, options: FleetClientOptions = {}) {
    this.#apiUrl = apiUrl.replace(/\/$/, '');
    this.#reconnectUnavailableMs = options.reconnectUnavailableMs ?? 10_000;
  }

  getSnapshot = (): ClientState => this.#state;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    const generation = ++this.#generation;
    this.#setState({ connection: 'connecting', error: null });
    try {
      const snapshot = await this.#fetchSnapshot();
      if (generation !== this.#generation) return;
      this.#state = {
        snapshot,
        connection: 'connecting',
        error: null,
      };
      this.#emit();
      this.#connectEvents();
    } catch (error) {
      if (generation !== this.#generation) return;
      this.#setState({
        connection: 'unavailable',
        error:
          error instanceof Error ? error.message : 'Fleet service unavailable',
      });
      this.#started = false;
    }
  }

  retry(): void {
    this.stop();
    void this.start();
  }

  stop(): void {
    this.#generation += 1;
    this.#source?.close();
    this.#source = null;
    this.#clearReconnectTimer();
    this.#needsRefresh = false;
    this.#started = false;
  }

  #connectEvents(): void {
    const source = new EventSource(`${this.#apiUrl}/api/v1/events`);
    this.#source = source;
    source.onopen = () => {
      if (this.#source !== source) return;
      this.#clearReconnectTimer();
      this.#setState({ connection: 'live', error: null });
      if (this.#needsRefresh) {
        this.#needsRefresh = false;
        void this.#refreshSnapshot(source);
      }
    };
    source.onerror = () => {
      if (this.#source !== source) return;
      this.#needsRefresh = true;
      this.#setState({ connection: 'reconnecting', error: null });
      this.#startReconnectTimer(source);
    };
    source.addEventListener('fleet.snapshot', (event) => {
      this.#consumeEvent(source, event, isFleetSnapshot, (data) =>
        this.#applySnapshot(data),
      );
    });
    source.addEventListener('telemetry.updated', (event) => {
      this.#consumeEvent(source, event, isTelemetryUpdatedData, (data, id) =>
        this.#applyTelemetry(data, id),
      );
    });
    source.addEventListener('status.changed', (event) => {
      this.#consumeEvent(source, event, isStatusChangedData, (data, id) =>
        this.#applyStatus(data, id),
      );
    });
  }

  async #fetchSnapshot(): Promise<FleetSnapshot> {
    const response = await fetch(`${this.#apiUrl}/api/v1/fleet`);
    if (!response.ok)
      throw new Error(`Fleet request returned ${response.status}`);
    const data: unknown = await response.json();
    if (!isFleetSnapshot(data)) throw new Error('Fleet response was invalid');
    return normalizeHistory(data);
  }

  async #refreshSnapshot(source: EventSource): Promise<void> {
    try {
      const snapshot = await this.#fetchSnapshot();
      if (this.#source !== source) return;
      this.#applySnapshot(snapshot);
      this.#setState({ connection: 'live', error: null });
    } catch (error) {
      if (this.#source !== source) return;
      this.#setState({
        connection: 'live',
        error: error instanceof Error ? error.message : 'Fleet refresh failed',
      });
    }
  }

  #consumeEvent<T>(
    source: EventSource,
    event: Event,
    validate: (value: unknown) => value is T,
    apply: (data: T, eventId: number) => void,
  ): void {
    if (this.#source !== source) return;
    try {
      const message = event as MessageEvent<string>;
      const data: unknown = JSON.parse(message.data);
      if (!validate(data)) throw new Error('Event payload failed validation');
      apply(data, Number.parseInt(message.lastEventId, 10));
      if (this.#state.connection !== 'live' || this.#state.error) {
        this.#setState({ connection: 'live', error: null });
      }
    } catch {
      this.#setState({
        connection: 'reconnecting',
        error: 'Received invalid live telemetry; refreshing fleet state',
      });
      void this.#refreshSnapshot(source);
    }
  }

  #startReconnectTimer(source: EventSource): void {
    if (this.#reconnectTimer) return;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      if (this.#source === source) {
        this.#setState({
          connection: 'unavailable',
          error: 'Live telemetry connection is unavailable',
        });
      }
    }, this.#reconnectUnavailableMs);
  }

  #clearReconnectTimer(): void {
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
  }

  #applySnapshot(snapshot: FleetSnapshot): void {
    if (this.#state.snapshot && snapshot.eventId < this.#state.snapshot.eventId)
      return;
    this.#state = { ...this.#state, snapshot };
    this.#emit();
  }

  #applyTelemetry(data: TelemetryUpdatedData, eventId: number): void {
    const current = this.#state.snapshot;
    if (!current || !Number.isFinite(eventId) || eventId <= current.eventId)
      return;
    const telemetry = { ...current.telemetry };
    const statuses = { ...current.statuses, ...data.statuses };
    const history = { ...current.history };
    for (const reading of data.readings) {
      telemetry[reading.robotId] = reading;
      history[reading.robotId] = appendSample(
        history[reading.robotId] ?? [],
        reading,
      );
    }
    this.#state = {
      ...this.#state,
      snapshot: {
        ...current,
        eventId,
        serverTime: new Date().toISOString(),
        telemetry,
        statuses,
        history,
      },
    };
    this.#emit();
  }

  #applyStatus(data: StatusChangedData, eventId: number): void {
    const current = this.#state.snapshot;
    if (!current || !Number.isFinite(eventId) || eventId <= current.eventId)
      return;
    const statuses: Record<string, RobotStatus> = {
      ...current.statuses,
      [data.robotId]: data.status,
    };
    this.#state = {
      ...this.#state,
      snapshot: { ...current, eventId, statuses },
    };
    this.#emit();
  }

  #setState(patch: Partial<ClientState>): void {
    this.#state = { ...this.#state, ...patch };
    this.#emit();
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}

function appendSample(
  samples: FleetSnapshot['history'][string],
  reading: TelemetryReading,
): FleetSnapshot['history'][string] {
  return [
    ...samples,
    {
      observedAt: reading.observedAt,
      batteryPercent: reading.batteryPercent,
      speedMps: reading.speedMps,
    },
  ].slice(-HISTORY_LIMIT);
}

function normalizeHistory(snapshot: FleetSnapshot): FleetSnapshot {
  return {
    ...snapshot,
    history: Object.fromEntries(
      Object.entries(snapshot.history).map(([robotId, samples]) => [
        robotId,
        samples.slice(-HISTORY_LIMIT),
      ]),
    ),
  };
}
