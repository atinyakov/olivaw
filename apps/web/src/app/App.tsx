import type { RobotStatus } from '@olivaw/contracts';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { FleetFilters } from '../features/fleet-filters/index.js';
import {
  MobileViewToggle,
  type MobileView,
} from '../features/mobile-view/index.js';
import { RobotDetail } from '../features/robot-detail/index.js';
import { SiteSelector } from '../features/site-selection/index.js';
import type { FleetClient } from '../fleet-client.js';
import { LoadingState } from '../shared/ui/LoadingState.js';
import { AppHeader } from '../widgets/app-header/index.js';
import { FleetMap, FleetMapLegend } from '../widgets/fleet-map/index.js';
import { FleetSummary } from '../widgets/fleet-summary/index.js';
import { RobotList } from '../widgets/robot-list/index.js';
import './App.css';

export function App({ client }: { client: FleetClient }) {
  const { snapshot, connection, error } = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
  );
  const [siteId, setSiteId] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RobotStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('map');
  const closeDetail = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    void client.start();
    return () => client.stop();
  }, [client]);

  useEffect(() => {
    if (!siteId && snapshot?.sites[0]) setSiteId(snapshot.sites[0].id);
  }, [siteId, snapshot]);

  const site =
    snapshot?.sites.find((candidate) => candidate.id === siteId) ??
    snapshot?.sites[0];
  const siteRobots =
    snapshot?.robots.filter((robot) => robot.siteId === site?.id) ?? [];
  const visibleRobots = siteRobots.filter((robot) => {
    const matchesText = `${robot.name} ${robot.id}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return (
      matchesText &&
      (status === 'all' || snapshot?.statuses[robot.id] === status)
    );
  });
  const selected =
    snapshot?.robots.find((robot) => robot.id === selectedId) ?? null;

  useEffect(() => {
    if (selected && selected.siteId !== site?.id) setSelectedId(null);
  }, [selected, site]);

  if (!snapshot) {
    return <LoadingState error={error} onRetry={() => client.retry()} />;
  }

  return (
    <div className="app-shell">
      <AppHeader
        connection={connection}
        error={error}
        onReconnect={() => client.retry()}
      />
      <main>
        <section className="page-heading">
          <div>
            <p className="eyebrow">Operations overview</p>
            <h1>Fleet health, at a glance.</h1>
            <p>
              Monitor movement, energy and incidents across every active site.
            </p>
          </div>
          <SiteSelector
            sites={snapshot.sites}
            value={site?.id ?? ''}
            onChange={setSiteId}
          />
        </section>

        <FleetSummary robots={siteRobots} snapshot={snapshot} />

        <section className="workspace">
          <div className="workspace-toolbar">
            <div>
              <p className="eyebrow">Live floorplan</p>
              <h2>{site?.name}</h2>
            </div>
            <MobileViewToggle value={mobileView} onChange={setMobileView} />
            <FleetFilters
              search={search}
              status={status}
              onSearchChange={setSearch}
              onStatusChange={setStatus}
            />
          </div>

          <div className="fleet-layout">
            <div
              id="fleet-map-panel"
              className={`map-card mobile-${mobileView}`}
            >
              {site && (
                <FleetMap
                  site={site}
                  robots={visibleRobots}
                  snapshot={snapshot}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
              <FleetMapLegend />
            </div>
            <RobotList
              robots={visibleRobots}
              snapshot={snapshot}
              selectedId={selectedId}
              mobileView={mobileView}
              onSelect={setSelectedId}
            />
          </div>
        </section>
      </main>

      {selected && (
        <RobotDetail
          robot={selected}
          snapshot={snapshot}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
