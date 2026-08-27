import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const apps: Awaited<ReturnType<typeof createApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('fleet API', () => {
  it('reports health and an initial fleet snapshot', async () => {
    const app = await createApp();
    apps.push(app);
    expect(
      (await app.inject({ method: 'GET', url: '/healthz' })).json(),
    ).toEqual({ status: 'ok' });
    const snapshot = (
      await app.inject({ method: 'GET', url: '/api/v1/fleet' })
    ).json();
    expect(snapshot.sites).toHaveLength(2);
    expect(snapshot.robots).toHaveLength(16);
  });

  it('validates and ingests telemetry', async () => {
    const app = await createApp({
      now: () => Date.parse('2026-08-24T12:00:01Z'),
    });
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      payload: {
        readings: [
          {
            robotId: 'bf-01',
            sequence: 1,
            observedAt: '2026-08-24T12:00:00.000Z',
            batteryPercent: 75,
            position: { x: 10, y: 20, heading: 45 },
            speedMps: 1,
            task: 'Moving',
          },
        ],
      },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({ accepted: 1, ignored: 0 });
  });

  it('rejects unknown robots and invalid ranges', async () => {
    const app = await createApp();
    apps.push(app);
    const base = {
      sequence: 1,
      observedAt: new Date().toISOString(),
      batteryPercent: 75,
      position: { x: 10, y: 20, heading: 45 },
      speedMps: 1,
      task: 'Moving',
    };
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      payload: { readings: [{ ...base, robotId: 'missing' }] },
    });
    expect(unknown.statusCode).toBe(400);
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      payload: {
        readings: [{ ...base, robotId: 'bf-01', batteryPercent: 101 }],
      },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it('rejects telemetry beyond the allowed future clock skew', async () => {
    const app = await createApp({
      now: () => Date.parse('2026-08-24T12:00:00Z'),
      maxClockSkewMs: 30_000,
    });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      payload: {
        readings: [
          {
            robotId: 'bf-01',
            sequence: 1,
            observedAt: '2026-08-24T12:00:31.000Z',
            batteryPercent: 75,
            position: { x: 10, y: 20, heading: 45 },
            speedMps: 1,
            task: 'Moving',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'Future timestamp' });
  });
});
