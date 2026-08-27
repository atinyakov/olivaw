import { describe, expect, it, vi } from 'vitest';
import { TelemetryPublisher } from './publisher.js';

const batch = {
  readings: [
    {
      robotId: 'bf-01',
      sequence: 1,
      observedAt: '2026-08-24T12:00:00Z',
      batteryPercent: 80,
      position: { x: 10, y: 20, heading: 90 },
      speedMps: 1,
      task: 'Moving',
    },
  ],
};

describe('TelemetryPublisher', () => {
  it('retries temporary failures with exponential delays', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accepted: 1, ignored: 0, eventId: 2 }), {
          status: 202,
        }),
      );
    const sleep = vi.fn(async () => undefined);
    const publisher = new TelemetryPublisher({
      endpoint: 'http://server/telemetry',
      fetchFn,
      sleep,
    });
    await expect(publisher.publish(batch)).resolves.toMatchObject({
      accepted: 1,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250, undefined);
  });

  it('fails after the configured attempts', async () => {
    const publisher = new TelemetryPublisher({
      endpoint: 'http://server/telemetry',
      fetchFn: vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
      sleep: async () => undefined,
      maxAttempts: 2,
    });
    await expect(publisher.publish(batch)).rejects.toThrow('offline');
  });
});
