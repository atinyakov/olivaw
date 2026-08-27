import type { IngestionResult, TelemetryBatch } from '@olivaw/contracts';
import { abortableSleep } from './sleep.js';

export interface PublisherOptions {
  endpoint: string;
  fetchFn?: typeof fetch;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  maxAttempts?: number;
  requestTimeoutMs?: number;
}

export class TelemetryPublisher {
  readonly #endpoint: string;
  readonly #fetch: typeof fetch;
  readonly #sleep: NonNullable<PublisherOptions['sleep']>;
  readonly #maxAttempts: number;
  readonly #requestTimeoutMs: number;

  constructor(options: PublisherOptions) {
    this.#endpoint = options.endpoint;
    this.#fetch = options.fetchFn ?? fetch;
    this.#sleep = options.sleep ?? abortableSleep;
    this.#maxAttempts = options.maxAttempts ?? 5;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 3_000;
  }

  async publish(
    batch: TelemetryBatch,
    signal?: AbortSignal,
  ): Promise<IngestionResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.#maxAttempts; attempt += 1) {
      try {
        const timeoutSignal = AbortSignal.timeout(this.#requestTimeoutMs);
        const combined = signal
          ? AbortSignal.any([signal, timeoutSignal])
          : timeoutSignal;
        const response = await this.#fetch(this.#endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(batch),
          signal: combined,
        });
        if (!response.ok)
          throw new Error(`Telemetry ingestion returned ${response.status}`);
        return (await response.json()) as IngestionResult;
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        lastError = error;
        if (attempt + 1 < this.#maxAttempts) {
          await this.#sleep(Math.min(250 * 2 ** attempt, 4_000), signal);
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Telemetry publish failed');
  }
}
