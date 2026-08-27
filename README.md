# Olivaw Fleet Command

A small full-stack fleet monitoring system built for the Olivaw engineering challenge. An independent simulator publishes robot telemetry to a Fastify service, which validates and stores current fleet state and streams updates to a React dashboard using Server-Sent Events (SSE).

## Quick start

Prerequisites: Node.js 22 and pnpm 10.

```bash
pnpm install
pnpm dev
```

Open <http://127.0.0.1:5173>. The API listens on <http://localhost:3000>, and the simulator starts publishing telemetry once per second. All state is intentionally in memory and resets with the server.

Useful commands:

```bash
pnpm build       # build every workspace package
pnpm typecheck   # strict TypeScript checks
pnpm test        # unit, integration, and component tests
pnpm test:e2e    # full browser tests (requires Playwright Chromium)
pnpm format      # format repository files
```

To run applications independently:

```bash
pnpm --filter @olivaw/server dev
pnpm --filter @olivaw/simulator dev
pnpm --filter @olivaw/web dev
```

## Architecture

```text
apps/simulator                  apps/server                         apps/web
seeded simulation ── HTTP ──> telemetry ingestion ── REST/SSE ──> React dashboard
                                      │                                  │
                               in-memory store                    SVG floorplan
                               status derivation                  fleet triage
                               replay buffer                      robot details
                                      └──────── packages/contracts ───────┘
```

The pnpm monorepo contains:

- `apps/simulator`: deterministic robot movement, energy, task, fault, and disconnection simulation with an HTTP publisher and bounded retry. It stands in for physical robots or an on-site gateway.
- `apps/server`: Fastify API, validation, in-memory current state/history, fleet health rules, SSE fan-out, event replay, and heartbeats.
- `apps/web`: responsive React dashboard with REST bootstrap, native `EventSource`, filters, site floorplans, live robot details, and accessible interaction.
- `packages/contracts`: TypeBox schemas, inferred TypeScript types, site geometry, and robot inventory shared by all applications.

### Frontend structure

The dashboard uses a pragmatic Feature-Sliced structure:

```text
apps/web/src
├── app/       page composition and application-level layout
├── widgets/   header, fleet summary, map, and robot list
├── features/  filtering, site selection, mobile view, and robot details
├── entities/  reusable robot presentation
└── shared/    fleet helpers and small reusable UI primitives
```

Each slice exposes a small public API through `index.ts`. Component styles are colocated with their owning `.tsx` files; `app/App.css` contains only tokens, reset rules, accessibility defaults, and page-level layout.

### Data flow

1. The simulator advances every robot from a deterministic seed and sends one telemetry batch per tick.
2. Fastify validates ranges, timestamps, clock skew, and robot identity. Older sequences or timestamps are ignored.
3. The server stores the latest reading and a bounded history, derives freshness from server receipt time, and assigns monotonically increasing event IDs.
4. The dashboard loads and runtime-validates a complete fleet snapshot over REST, then opens one SSE connection.
5. SSE sends an initial snapshot followed by `telemetry.updated` and `status.changed` events. The client validates payloads, ignores duplicate event IDs, and refreshes its snapshot after reconnecting. Native browser reconnection supplies `Last-Event-ID`; the server replays buffered events or replaces state with a fresh snapshot.

### Status rules

- **Operational:** healthy telemetry newer than five seconds.
- **Warning:** current telemetry with battery below 20% or an active fault.
- **Stale:** no telemetry for at least five seconds.
- **Offline:** no telemetry for at least fifteen seconds, or no reading received yet.

## HTTP interface

| Method | Path                | Purpose                                         |
| ------ | ------------------- | ----------------------------------------------- |
| `GET`  | `/healthz`          | Service readiness                               |
| `POST` | `/api/v1/telemetry` | Validate and ingest a telemetry batch           |
| `GET`  | `/api/v1/fleet`     | Retrieve the current fleet snapshot and history |
| `GET`  | `/api/v1/events`    | Subscribe to the SSE fleet event stream         |

Configuration:

| Variable            | Application | Default                                  |
| ------------------- | ----------- | ---------------------------------------- |
| `PORT`              | Server      | `3000`                                   |
| `HOST`              | Server      | `0.0.0.0`                                |
| `CORS_ORIGIN`       | Server      | `*` for local uncredentialed development |
| `MAX_CLOCK_SKEW_MS` | Server      | `30000`                                  |
| `SERVER_URL`        | Simulator   | `http://localhost:3000`                  |
| `SIM_INTERVAL_MS`   | Simulator   | `1000`                                   |
| `SIM_SEED`          | Simulator   | `42`                                     |
| `VITE_API_URL`      | Web         | `http://localhost:3000`                  |

## Why this scope

I implemented all three challenge parts to demonstrate the boundaries between telemetry production, ingestion/business rules, and an operations-focused presentation layer. The implementation stays small enough to review: a database, broker, third-party map, authentication, and robot controls are deliberately omitted.

SSE is a better fit than WebSockets here because live traffic is one-way from server to browser. It uses ordinary HTTP, has native browser reconnection, carries event IDs, and remains simple to inspect. Future commands such as pause or return-to-charge would use an idempotent `POST /api/v1/robots/:id/commands`; their asynchronous accepted, acknowledged, or failed states could return over the existing SSE stream. Bidirectional WebSockets would become worthwhile for high-frequency manual control.

The schematic SVG floorplan avoids API keys and keeps the challenge self-contained; it is a presentation shortcut, not the proposed production map architecture. Normalized site coordinates keep that choice behind the UI boundary and can later map onto real floorplan geometry without changing telemetry contracts. The dashboard is monitoring-only so attention stays on live fleet state, incident recognition, filtering, and robot inspection.

For production indoor mapping, I would replace the hand-rendered SVG with a dedicated map layer. Leaflet is a reasonable lightweight option: configure `CRS.Simple`, load each warehouse plan through an image or SVG overlay, and render robots, charging areas, restricted zones, routes, and incidents as independently controlled layers. That provides pan/zoom, coordinate projection, bounds handling, interaction, and layer lifecycle without growing a custom map engine. Floorplan assets would be versioned per site, and the backend would expose their dimensions, coordinate transform, and revision. If the product later requires CAD/BIM data, multiple floors, very large vector datasets, or advanced routing, I would evaluate a specialized indoor-mapping or WebGL solution rather than force those requirements into Leaflet.

The simulator models charging as an explicit state transition. A low-battery robot enters `Returning to charger`, navigates to the charging feature defined in its site geometry, stops on arrival, and only then enters `Charging`. This is intentionally simple point-to-point navigation; production routing would account for aisles, obstacles, reservations, and charger availability.

## Testing

- Contract tests cover valid fixtures and rejected telemetry ranges.
- Server tests cover validation, unknown robots, ordering, bounded history, and health transitions.
- Simulator tests cover seeded determinism, boundaries, and publisher retry behavior.
- React tests cover loading, service failure, filtering, selection, and robot details.
- Playwright runs the real simulator, API, SSE connection, and dashboard on desktop and mobile viewports. It also verifies live position changes and scans for serious or critical accessibility violations with axe.

Install the Playwright browser once before running browser tests:

```bash
pnpm --filter @olivaw/web exec playwright install chromium
```

## Production evolution

With more time, I would add authenticated robot identities, operator authentication and authorization, database or time-series persistence, durable event transport, horizontal SSE fan-out, audit records, structured metrics/tracing, versioned real site geometry, and a dedicated indoor-map renderer such as Leaflet with floorplan overlays and marker virtualization for larger fleets. Reconnection and delivery would use durable offsets instead of this process-local replay buffer.

Commands would require an idempotency key, authorization policy, durable command state, robot acknowledgement, timeout handling, and an audit trail. Emergency controls need a separately reviewed safety path rather than being treated as ordinary UI actions.

See [plan.md](./plan.md) for the detailed implementation plan and explicit tradeoffs.
