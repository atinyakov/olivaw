import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { robots, sites } from './fixtures.js';
import {
  RobotSchema,
  SiteSchema,
  TelemetryBatchSchema,
  type TelemetryBatch,
} from './index.js';

const validBatch = {
  readings: [
    {
      robotId: 'bf-01',
      sequence: 1,
      observedAt: '2026-08-24T12:00:00.000Z',
      batteryPercent: 82,
      position: { x: 25, y: 30, heading: 90 },
      speedMps: 1.2,
      task: 'Deliver tote A-104',
    },
  ],
} satisfies TelemetryBatch;

describe('shared contracts', () => {
  it('validates every demo fixture', () => {
    expect(sites.every((site) => Value.Check(SiteSchema, site))).toBe(true);
    expect(robots.every((robot) => Value.Check(RobotSchema, robot))).toBe(true);
  });

  it('accepts a valid telemetry batch', () => {
    expect(Value.Check(TelemetryBatchSchema, validBatch)).toBe(true);
  });

  it('rejects out-of-range telemetry', () => {
    const invalidBatch = structuredClone(validBatch);
    invalidBatch.readings[0]!.batteryPercent = 101;
    invalidBatch.readings[0]!.position.x = -1;

    expect(Value.Check(TelemetryBatchSchema, invalidBatch)).toBe(false);
  });

  it('rejects empty telemetry batches', () => {
    expect(Value.Check(TelemetryBatchSchema, { readings: [] })).toBe(false);
  });
});
