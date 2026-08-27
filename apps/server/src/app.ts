import cors from '@fastify/cors';
import {
  IngestionResultSchema,
  TelemetryBatchSchema,
  type FleetEvent,
  type TelemetryBatch,
} from '@olivaw/contracts';
import { robots, sites } from '@olivaw/contracts/fixtures';
import Fastify, { type FastifyInstance } from 'fastify';
import { FleetStore } from './store.js';

export interface AppOptions {
  logger?: boolean;
  now?: () => number;
  statusIntervalMs?: number;
  heartbeatIntervalMs?: number;
  corsOrigin?: string;
  maxClockSkewMs?: number;
}

function encodeEvent(event: FleetEvent): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export async function createApp(
  options: AppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const corsOrigin = options.corsOrigin ?? '*';
  const now = options.now ?? Date.now;
  const store = new FleetStore({
    sites,
    robots,
    now,
  });
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15_000;
  const maxClockSkewMs = options.maxClockSkewMs ?? 30_000;

  await app.register(cors, {
    origin: corsOrigin,
  });

  app.decorate('fleetStore', store);

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/api/v1/fleet', async () => store.snapshot());

  app.post<{ Body: TelemetryBatch }>(
    '/api/v1/telemetry',
    {
      schema: {
        body: TelemetryBatchSchema,
        response: { 202: IngestionResultSchema },
      },
    },
    async (request, reply) => {
      for (const reading of request.body.readings) {
        if (!store.hasRobot(reading.robotId)) {
          return reply.code(400).send({
            error: 'Unknown robot',
            message: `Robot ${reading.robotId} is not registered`,
            statusCode: 400,
          });
        }
        if (Number.isNaN(Date.parse(reading.observedAt))) {
          return reply.code(400).send({
            error: 'Invalid timestamp',
            message: `Reading for ${reading.robotId} has an invalid observedAt`,
            statusCode: 400,
          });
        }
        if (Date.parse(reading.observedAt) > now() + maxClockSkewMs) {
          return reply.code(400).send({
            error: 'Future timestamp',
            message: `Reading for ${reading.robotId} exceeds allowed clock skew`,
            statusCode: 400,
          });
        }
      }
      return reply.code(202).send(store.ingest(request.body.readings));
    },
  );

  app.get('/api/v1/events', async (request, reply) => {
    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, {
      'Access-Control-Allow-Origin': corsOrigin,
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
    });

    const pendingDuringInitialization: FleetEvent[] = [];
    let initializing = true;
    let closed = false;
    let writable = true;
    const pendingChunks: string[] = [];
    const maxPendingChunks = 100;

    const flush = () => {
      writable = true;
      while (!closed && writable && pendingChunks.length > 0) {
        writable = response.write(pendingChunks.shift()!);
      }
    };
    const enqueue = (chunk: string) => {
      if (closed) return;
      if (writable && pendingChunks.length === 0) {
        writable = response.write(chunk);
        return;
      }
      pendingChunks.push(chunk);
      if (pendingChunks.length > maxPendingChunks) {
        pendingChunks.splice(
          0,
          pendingChunks.length,
          encodeEvent(store.snapshotEvent()),
        );
      }
    };
    const sendEvent = (event: FleetEvent) => enqueue(encodeEvent(event));
    response.on('drain', flush);

    const unsubscribe = store.subscribe((event) => {
      if (initializing) pendingDuringInitialization.push(event);
      else sendEvent(event);
    });

    const rawLastEventId = request.headers['last-event-id'];
    const lastEventId =
      typeof rawLastEventId === 'string'
        ? Number.parseInt(rawLastEventId, 10)
        : null;
    const replay =
      lastEventId !== null && Number.isFinite(lastEventId)
        ? store.eventsAfter(lastEventId)
        : null;

    let lastSentEventId = lastEventId ?? 0;
    if (replay === null) {
      const snapshot = store.snapshotEvent();
      sendEvent(snapshot);
      lastSentEventId = snapshot.id;
    } else {
      for (const event of replay) {
        sendEvent(event);
        lastSentEventId = event.id;
      }
    }

    initializing = false;
    for (const event of pendingDuringInitialization) {
      if (event.id > lastSentEventId) sendEvent(event);
    }
    const heartbeat = setInterval(() => {
      if (writable && pendingChunks.length === 0)
        writable = response.write(': heartbeat\n\n');
    }, heartbeatIntervalMs);
    heartbeat.unref();
    request.raw.on('close', () => {
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      response.off('drain', flush);
      pendingChunks.length = 0;
    });
  });

  const statusTimer = setInterval(
    () => store.refreshStatuses(),
    options.statusIntervalMs ?? 1_000,
  );
  statusTimer.unref();
  app.addHook('onClose', async () => clearInterval(statusTimer));

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    fleetStore: FleetStore;
  }
}
