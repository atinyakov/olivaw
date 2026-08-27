import { describe, expect, it } from 'vitest';
import { SimulatorEngine } from './engine.js';

describe('SimulatorEngine', () => {
  it('is deterministic for the same seed', () => {
    const first = new SimulatorEngine({ seed: 7 });
    const second = new SimulatorEngine({ seed: 7 });
    const time = new Date('2026-08-24T12:00:00Z');
    expect(first.tick(time)).toEqual(second.tick(time));
    expect(first.tick(time)).toEqual(second.tick(time));
  });

  it('keeps robot telemetry inside valid boundaries', () => {
    const engine = new SimulatorEngine({ seed: 99 });
    for (let tick = 0; tick < 500; tick += 1) {
      for (const reading of engine.tick(
        new Date(1_700_000_000_000 + tick * 1000),
      ).readings) {
        expect(reading.position.x).toBeGreaterThanOrEqual(4);
        expect(reading.position.x).toBeLessThanOrEqual(96);
        expect(reading.position.y).toBeGreaterThanOrEqual(5);
        expect(reading.position.y).toBeLessThanOrEqual(94);
        expect(reading.batteryPercent).toBeGreaterThanOrEqual(0);
        expect(reading.batteryPercent).toBeLessThanOrEqual(100);
      }
    }
  });

  it('returns to charger geometry before charging and remains stationary', () => {
    const engine = new SimulatorEngine({
      robots: [
        {
          id: 'bf-01',
          name: 'Ada',
          siteId: 'berlin-fulfillment',
          model: 'OLV-Courier Mk2',
        },
      ],
      random: { next: () => 0.5 },
      initialBatteryPercent: 7.9,
    });
    const startedAt = Date.parse('2026-08-24T12:00:00Z');
    let chargingReading;

    for (let tick = 0; tick < 300; tick += 1) {
      const reading = engine.tick(new Date(startedAt + tick * 1000))
        .readings[0]!;
      if (reading.task === 'Charging') {
        chargingReading = reading;
        break;
      }
    }

    expect(chargingReading).toBeDefined();
    expect(chargingReading?.position).toMatchObject({ x: 87, y: 85 });
    expect(chargingReading?.speedMps).toBe(0);

    const next = engine.tick(new Date(startedAt + 301_000)).readings[0]!;
    expect(next.position).toEqual(chargingReading?.position);
    expect(next.batteryPercent).toBeGreaterThan(
      chargingReading?.batteryPercent ?? 0,
    );
  });
});
