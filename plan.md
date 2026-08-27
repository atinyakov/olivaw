# Full-Stack Fleet Monitoring Challenge Plan

## Summary

Build a pnpm workspace containing:

- A React/TypeScript fleet dashboard.
- A Fastify/TypeScript telemetry service.
- An independent robot simulator CLI.
- A shared contracts package.

Telemetry will flow from the simulator through an HTTP ingestion API, remain in server memory, and reach the dashboard through REST and Server-Sent Events (SSE). The design remains compatible with future robot commands sent through HTTP POST endpoints.

## Execution Steps and Approval Gates

Implementation proceeds one step at a time. At the end of every step, report the files changed, commands run, validation results, and any deviations from this plan. Do not begin the next step until it is explicitly approved.

### Step 1: Create and refine the implementation plan

1. Create `plan.md` at the repository root.
2. Record the agreed architecture, interfaces, user experience, testing strategy, and assumptions.
3. Break implementation into independently reviewable steps and sub-steps.
4. Verify that planning is the only repository change.
5. Stop and request approval for Step 2.

**Completion criteria:** `plan.md` is complete, internally consistent, and no application files exist yet.

### Step 2: Scaffold the workspace and shared contracts

1. Create the pnpm workspace and root TypeScript, formatting, and test configuration.
2. Add workspace packages for the web application, server, simulator, and shared contracts.
3. Add root scripts for `dev`, `build`, `typecheck`, `test`, and end-to-end tests.
4. Define TypeBox schemas and inferred TypeScript types for sites, robots, telemetry batches, fleet snapshots, statuses, ingestion responses, and SSE events.
5. Add deterministic fixtures for two sites and approximately 12–20 robots.
6. Add focused contract tests for valid and invalid payloads.
7. Install dependencies and verify workspace resolution, type checking, and contract tests.
8. Stop and request approval for Step 3.

**Completion criteria:** every workspace package resolves, shared schemas compile and validate fixtures, and no backend, simulator, or dashboard behavior has been implemented.

### Step 3: Implement the Fastify backend and SSE stream

1. Create the Fastify application factory separately from the process entry point for testability.
2. Implement the in-memory fleet store, latest-reading comparison, bounded history, event sequencing, and replay buffer.
3. Implement server-side operational, warning, stale, and offline status derivation.
4. Add telemetry ingestion with TypeBox validation, unknown-robot rejection, and out-of-order reading handling.
5. Add fleet snapshot and health endpoints.
6. Add the SSE endpoint with named events, event IDs, replay through `Last-Event-ID`, snapshot fallback, heartbeats, and connection cleanup.
7. Add environment configuration, local CORS, structured logging, and graceful shutdown.
8. Add unit and integration tests for routes, storage, status transitions, SSE delivery, replay, and fallback.
9. Run server tests, type checking, and build verification.
10. Stop and request approval for Step 4.

**Completion criteria:** validated telemetry can be ingested and observed through REST and SSE with passing backend tests; telemetry still comes only from tests or manual requests.

### Step 4: Implement the standalone simulator

1. Create a seeded pseudo-random simulation engine independent of transport code.
2. Model bounded movement, heading, speed, battery drain, tasks, faults, and temporary disconnections.
3. Produce one telemetry batch per one-second tick with per-robot reading sequences and timestamps.
4. Add an HTTP publisher with request timeouts, bounded exponential backoff, recovery logging, and clean cancellation.
5. Add CLI/environment configuration for server URL, seed, and update interval.
6. Add unit tests for determinism, movement boundaries, state transitions, batching, and retry timing.
7. Run the simulator against the backend and verify changing snapshots and SSE events.
8. Run simulator tests, workspace type checking, and builds.
9. Stop and request approval for Step 5.

**Completion criteria:** the independent simulator continuously supplies reproducible telemetry to the backend and recovers from temporary backend unavailability.

### Step 5: Implement the React dashboard

1. Create the Vite React/TypeScript application, CSS tokens, responsive shell, and API environment configuration.
2. Implement the typed REST client and fleet snapshot bootstrap flow.
3. Implement the SSE client, event ordering, reconnection state, snapshot replacement, and cleanup.
4. Build site selection, connection status, fleet KPIs, search, status filters, and the robot list.
5. Build responsive SVG site floorplans with zones, obstacles, charging areas, status legend, and robot markers.
6. Synchronize selection between the map and robot list.
7. Build the desktop detail drawer and mobile detail sheet with current telemetry and 60-second battery/speed history.
8. Add loading, reconnecting, unavailable, and empty-filter states.
9. Complete keyboard behavior, focus management, semantic labels, non-color status cues, and reduced-motion support.
10. Add component tests for data updates, filters, site switching, selection, detail presentation, and accessibility behavior.
11. Run frontend tests, type checking, and production build verification.
12. Stop and request approval for Step 6.

**Completion criteria:** a fleet manager can monitor both sites, find and inspect robots, and observe live telemetry across desktop and mobile layouts.

### Step 6: Add system-level automated tests

1. Configure Playwright to start the backend, simulator, and production-like frontend test environment.
2. Add the primary end-to-end journey from telemetry ingestion through map/list updates and robot detail inspection.
3. Test warning filtering, site switching, responsive navigation, and detail panel behavior.
4. Test backend interruption and SSE reconnection without duplicated visible state.
5. Add automated accessibility checks for the primary dashboard state.
6. Remove timing flakiness by using deterministic seeds and observable readiness conditions.
7. Run the complete unit, integration, component, and end-to-end test suite.
8. Stop and request approval for Step 7.

**Completion criteria:** automated tests exercise the complete telemetry path and critical fleet-manager journeys reliably.

### Step 7: Complete documentation and final verification

1. Write the README with prerequisites, installation, one-command startup, individual application commands, and test commands.
2. Document the architecture, contracts, HTTP/SSE data flow, reconnection behavior, and repository layout.
3. Explain scope choices, mocked infrastructure, tradeoffs, and why SSE was selected over WebSockets.
4. Document the future HTTP POST command pattern and production hardening work.
5. Verify fresh installation and startup instructions from the repository root.
6. Run formatting checks, type checking, all tests, and all production builds.
7. Inspect runtime logs and browser output for errors, leaked connections, or timers.
8. Compare the finished repository against every requirement and assumption in this plan.
9. Report final results and any remaining limitations; do not make additional scope changes without approval.

**Completion criteria:** the repository is reproducible, documented, fully verified, and ready to share as the engineering challenge submission.

## Implementation Changes

### Workspace and contracts

- Organize the repository as `apps/web`, `apps/server`, `apps/simulator`, and `packages/contracts`.
- Provide root commands for development, building, type checking, unit tests, and end-to-end tests.
- Use TypeBox schemas for shared runtime validation and TypeScript types.
- Define sites, robots, telemetry, fleet snapshots, statuses, ingestion results, and SSE events in the contracts package.
- Supply two fictional warehouse sites with approximately 12–20 robots through shared demo fixtures.

### Simulator and backend

- Run the simulator as an independent CLI process with deterministic seeded behavior.
- Update robot position, heading, speed, battery, task, and faults approximately once per second.
- Keep positions within site boundaries and stop sending readings for simulated disconnected robots.
- Send one telemetry batch per tick with bounded retry/backoff when the server is unavailable.
- Implement:
  - `POST /api/v1/telemetry` to validate and ingest telemetry batches.
  - `GET /api/v1/fleet` to return the current fleet snapshot and recent history.
  - `GET /api/v1/events` to provide the live SSE stream.
  - `GET /healthz` to report readiness.
- Reject malformed telemetry and unknown robot IDs; ignore readings older than the latest accepted reading.
- Store current state, a bounded event replay buffer, and recent history in memory.
- Derive statuses on the server:
  - `operational` for healthy current telemetry.
  - `warning` for battery below 20% or a simulated fault.
  - `stale` after five seconds without telemetry.
  - `offline` after fifteen seconds without telemetry.
- Emit named SSE events:
  - `fleet.snapshot`
  - `telemetry.updated`
  - `status.changed`
- Assign every SSE event a monotonically increasing event ID.
- Honor `Last-Event-ID` when the requested events remain buffered; send a fresh snapshot when replay is unavailable.
- Send periodic SSE heartbeat comments so clients and proxies can detect dead connections.
- Configure development CORS, environment-based ports, structured logging, and graceful shutdown.

### Frontend experience

- Build a responsive map-first dashboard with a header, live-connection indicator, site selector, fleet KPIs, filters, fleet list, floorplan, and robot detail panel.
- Render self-contained SVG warehouse floorplans with zones, obstacles, charging areas, and accessible robot markers.
- Bootstrap from `GET /api/v1/fleet`, then subscribe through browser `EventSource`.
- Apply SSE updates by event ID, ignoring duplicate or older events.
- Rely on native SSE reconnection and refresh the REST snapshot when the server indicates replay is unavailable.
- Clearly indicate connecting, live, reconnecting, stale, and unavailable states.
- Synchronize robot selection between the fleet list and map.
- Encode operational, warning, stale, offline, and low-battery states using text/icons as well as color.
- Show the selected robot in a desktop side panel or mobile full-screen sheet with battery, task, speed, heading, coordinates, last update, health state, and 60 seconds of battery/speed history.
- Preserve filters and selection across responsive map/list layouts.
- Support keyboard navigation, visible focus, semantic labels, focus restoration, Escape-to-close, reduced motion, and meaningful loading/error/empty states.

### Documentation

- Document one-command startup, individual service commands, architecture, API contracts, data flow, and testing.
- Explain why HTTP ingestion plus SSE was chosen over WebSockets for one-way telemetry delivery.
- Note that future commands should use idempotent HTTP POST requests, with their asynchronous status updates returned through SSE.
- Explain the choice to implement all three challenge parts while leaving persistence and deployment infrastructure mocked.
- Record deliberate omissions: authentication, authorization, durable storage, real site geometry, robot controls, and production messaging infrastructure.
- Describe production evolution: authenticated robot identities, database/time-series storage, durable event transport, horizontal SSE fan-out, observability, deployment configuration, and large-fleet rendering optimization.

## Public Interfaces and Data Flow

1. The simulator sends a validated `TelemetryBatch` to Fastify.
2. Fastify validates and stores the readings, derives robot statuses, and appends typed events to its replay buffer.
3. The dashboard fetches a `FleetSnapshot` over REST.
4. The dashboard opens one `EventSource` connection for live fleet events.
5. On reconnection, the browser supplies `Last-Event-ID`; the server replays missing events or sends a replacement snapshot.
6. The client applies snapshots atomically and patches later updates in sequence order.

Core shared shapes:

- `TelemetryReading`: robot ID, reading sequence, observation time, battery, position, heading, speed, task, and optional fault.
- `FleetSnapshot`: server event ID/time, sites, robots, latest telemetry, statuses, and recent history.
- `FleetEvent`: event ID plus a `fleet.snapshot`, `telemetry.updated`, or `status.changed` payload.
- `IngestionResult`: accepted count, ignored count, and latest server event ID.

Future command shape, documented but not implemented:

- `POST /api/v1/robots/:robotId/commands`
- Return `202 Accepted` with a command ID.
- Report `accepted`, `dispatched`, `acknowledged`, or `failed` changes through a `command.updated` SSE event.
- Require authentication, authorization, idempotency keys, and audit logging before production use.

## Test Plan

- Unit-test deterministic simulation, movement boundaries, battery/fault transitions, batching, and retry behavior.
- Unit-test schema validation, unknown robots, out-of-order readings, history limits, and stale/offline thresholds.
- Integration-test ingestion-to-snapshot behavior, SSE delivery, heartbeat behavior, event replay, and snapshot fallback.
- Component-test KPIs, filters, site switching, selection synchronization, detail content, and connection states.
- Accessibility-test keyboard marker selection, drawer focus behavior, semantic statuses, and non-color indicators.
- End-to-end test telemetry flowing from the simulator through the server to the dashboard.
- Test disconnect and reconnect behavior without duplicated or missing visible state.
- Verify desktop/mobile layouts, clean shutdown, type checking, production builds, and absence of console errors or leaked timers.

## Assumptions

- Use the available Node 22 and pnpm 10 environment with compatible stable dependencies.
- Default local ports are `5173` for the frontend and `3000` for the server.
- `pnpm dev` starts the frontend, backend, and simulator concurrently.
- Coordinates are normalized site-relative values rather than geographic coordinates.
- Backend data resets when the server restarts.
- No database, Docker, cloud service, third-party map, or API key is required.
- The implemented application is monitoring-only; command APIs remain a documented extension point.
