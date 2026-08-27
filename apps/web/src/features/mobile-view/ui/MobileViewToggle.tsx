export type MobileView = 'map' | 'list';

export function MobileViewToggle({
  value,
  onChange,
}: {
  value: MobileView;
  onChange: (value: MobileView) => void;
}) {
  return (
    <div className="mobile-toggle" aria-label="Choose dashboard view">
      <button
        className={value === 'map' ? 'active' : ''}
        aria-pressed={value === 'map'}
        aria-controls="fleet-map-panel"
        onClick={() => onChange('map')}
      >
        Map
      </button>
      <button
        className={value === 'list' ? 'active' : ''}
        aria-pressed={value === 'list'}
        aria-controls="fleet-list-panel"
        onClick={() => onChange('list')}
      >
        List
      </button>
    </div>
  );
}
import './MobileViewToggle.css';
