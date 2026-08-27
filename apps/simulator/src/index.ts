import { SimulatorEngine } from './engine.js';
import { TelemetryPublisher } from './publisher.js';
import { abortableSleep } from './sleep.js';

const serverUrl = process.env['SERVER_URL'] ?? 'http://localhost:3000';
const intervalMs = Number.parseInt(
  process.env['SIM_INTERVAL_MS'] ?? '1000',
  10,
);
const seed = Number.parseInt(process.env['SIM_SEED'] ?? '42', 10);
const controller = new AbortController();
const engine = new SimulatorEngine({ seed });
const publisher = new TelemetryPublisher({
  endpoint: `${serverUrl}/api/v1/telemetry`,
});

const stop = () => controller.abort(new Error('Simulator stopped'));
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

console.info(
  `Simulator publishing to ${serverUrl} every ${intervalMs}ms (seed ${seed})`,
);

while (!controller.signal.aborted) {
  const startedAt = Date.now();
  const batch = engine.tick(new Date(startedAt));
  if (batch.readings.length > 0) {
    try {
      const result = await publisher.publish(batch, controller.signal);
      console.info(
        `telemetry accepted=${result.accepted} ignored=${result.ignored} event=${result.eventId}`,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        console.error('telemetry publish failed', error);
    }
  }
  const remaining = Math.max(0, intervalMs - (Date.now() - startedAt));
  try {
    await abortableSleep(remaining, controller.signal);
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  }
}
