import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const IdentifierSchema = Type.String({ minLength: 1, maxLength: 64 });
const TimestampSchema = Type.String({ minLength: 20, maxLength: 35 });

export const RobotStatusSchema = Type.Union([
  Type.Literal('operational'),
  Type.Literal('warning'),
  Type.Literal('stale'),
  Type.Literal('offline'),
]);
export type RobotStatus = Static<typeof RobotStatusSchema>;

export const FloorplanFeatureSchema = Type.Object({
  id: IdentifierSchema,
  label: Type.String({ minLength: 1, maxLength: 80 }),
  type: Type.Union([
    Type.Literal('zone'),
    Type.Literal('obstacle'),
    Type.Literal('charger'),
  ]),
  x: Type.Number({ minimum: 0, maximum: 100 }),
  y: Type.Number({ minimum: 0, maximum: 100 }),
  width: Type.Number({ exclusiveMinimum: 0, maximum: 100 }),
  height: Type.Number({ exclusiveMinimum: 0, maximum: 100 }),
});
export type FloorplanFeature = Static<typeof FloorplanFeatureSchema>;

export const SiteSchema = Type.Object({
  id: IdentifierSchema,
  name: Type.String({ minLength: 1, maxLength: 80 }),
  timezone: Type.String({ minLength: 1, maxLength: 80 }),
  features: Type.Array(FloorplanFeatureSchema),
});
export type Site = Static<typeof SiteSchema>;

export const RobotSchema = Type.Object({
  id: IdentifierSchema,
  name: Type.String({ minLength: 1, maxLength: 80 }),
  siteId: IdentifierSchema,
  model: Type.String({ minLength: 1, maxLength: 80 }),
});
export type Robot = Static<typeof RobotSchema>;

export const PositionSchema = Type.Object({
  x: Type.Number({ minimum: 0, maximum: 100 }),
  y: Type.Number({ minimum: 0, maximum: 100 }),
  heading: Type.Number({ minimum: 0, exclusiveMaximum: 360 }),
});
export type Position = Static<typeof PositionSchema>;

export const TelemetryReadingSchema = Type.Object({
  robotId: IdentifierSchema,
  sequence: Type.Integer({ minimum: 0 }),
  observedAt: TimestampSchema,
  batteryPercent: Type.Number({ minimum: 0, maximum: 100 }),
  position: PositionSchema,
  speedMps: Type.Number({ minimum: 0, maximum: 10 }),
  task: Type.String({ minLength: 1, maxLength: 120 }),
  fault: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
});
export type TelemetryReading = Static<typeof TelemetryReadingSchema>;

export const TelemetryBatchSchema = Type.Object({
  readings: Type.Array(TelemetryReadingSchema, { minItems: 1, maxItems: 500 }),
});
export type TelemetryBatch = Static<typeof TelemetryBatchSchema>;

export const TelemetrySampleSchema = Type.Object({
  observedAt: TimestampSchema,
  batteryPercent: Type.Number({ minimum: 0, maximum: 100 }),
  speedMps: Type.Number({ minimum: 0, maximum: 10 }),
});
export type TelemetrySample = Static<typeof TelemetrySampleSchema>;

export const FleetSnapshotSchema = Type.Object({
  eventId: Type.Integer({ minimum: 0 }),
  serverTime: TimestampSchema,
  sites: Type.Array(SiteSchema),
  robots: Type.Array(RobotSchema),
  telemetry: Type.Record(IdentifierSchema, TelemetryReadingSchema),
  statuses: Type.Record(IdentifierSchema, RobotStatusSchema),
  history: Type.Record(IdentifierSchema, Type.Array(TelemetrySampleSchema)),
});
export type FleetSnapshot = Static<typeof FleetSnapshotSchema>;

export const IngestionResultSchema = Type.Object({
  accepted: Type.Integer({ minimum: 0 }),
  ignored: Type.Integer({ minimum: 0 }),
  eventId: Type.Integer({ minimum: 0 }),
});
export type IngestionResult = Static<typeof IngestionResultSchema>;

export const FleetSnapshotEventSchema = Type.Object({
  id: Type.Integer({ minimum: 0 }),
  emittedAt: TimestampSchema,
  type: Type.Literal('fleet.snapshot'),
  data: FleetSnapshotSchema,
});

export const TelemetryUpdatedDataSchema = Type.Object({
  readings: Type.Array(TelemetryReadingSchema, { minItems: 1 }),
  statuses: Type.Record(IdentifierSchema, RobotStatusSchema),
});
export type TelemetryUpdatedData = Static<typeof TelemetryUpdatedDataSchema>;

export const TelemetryUpdatedEventSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
  emittedAt: TimestampSchema,
  type: Type.Literal('telemetry.updated'),
  data: TelemetryUpdatedDataSchema,
});

export const StatusChangedDataSchema = Type.Object({
  robotId: IdentifierSchema,
  previousStatus: RobotStatusSchema,
  status: RobotStatusSchema,
});
export type StatusChangedData = Static<typeof StatusChangedDataSchema>;

export const StatusChangedEventSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
  emittedAt: TimestampSchema,
  type: Type.Literal('status.changed'),
  data: StatusChangedDataSchema,
});

export const FleetEventSchema = Type.Union([
  FleetSnapshotEventSchema,
  TelemetryUpdatedEventSchema,
  StatusChangedEventSchema,
]);
export type FleetEvent = Static<typeof FleetEventSchema>;

export const isFleetSnapshot = (value: unknown): value is FleetSnapshot =>
  Value.Check(FleetSnapshotSchema, value);

export const isTelemetryUpdatedData = (
  value: unknown,
): value is TelemetryUpdatedData =>
  Value.Check(TelemetryUpdatedDataSchema, value);

export const isStatusChangedData = (
  value: unknown,
): value is StatusChangedData => Value.Check(StatusChangedDataSchema, value);
