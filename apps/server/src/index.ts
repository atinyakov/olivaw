import { createApp } from './app.js';

const port = Number.parseInt(process.env['PORT'] ?? '3000', 10);
const host = process.env['HOST'] ?? '0.0.0.0';
const maxClockSkewMs = Number.parseInt(
  process.env['MAX_CLOCK_SKEW_MS'] ?? '30000',
  10,
);
const app = await createApp({
  logger: true,
  maxClockSkewMs,
  ...(process.env['CORS_ORIGIN']
    ? { corsOrigin: process.env['CORS_ORIGIN'] }
    : {}),
});

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
