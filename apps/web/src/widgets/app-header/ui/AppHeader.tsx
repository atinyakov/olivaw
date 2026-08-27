import type { ConnectionState } from '../../../fleet-client.js';
import { BrandMark } from '../../../shared/ui/BrandMark.js';
import './AppHeader.css';

export function AppHeader({
  connection,
  error,
  onReconnect,
}: {
  connection: ConnectionState;
  error: string | null;
  onReconnect: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <div>
          <strong>Olivaw</strong>
          <small>Fleet command</small>
        </div>
      </div>
      <div
        className={`connection connection-${connection}`}
        role="status"
        title={error ?? undefined}
      >
        <span aria-hidden="true" />
        {connection === 'live' ? 'Live telemetry' : connection}
        {connection === 'unavailable' && (
          <button onClick={onReconnect}>Reconnect</button>
        )}
      </div>
    </header>
  );
}
