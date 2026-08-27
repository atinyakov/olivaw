import type { Site } from '@olivaw/contracts';
import './SiteSelector.css';

export function SiteSelector({
  sites,
  value,
  onChange,
}: {
  sites: Site[];
  value: string;
  onChange: (siteId: string) => void;
}) {
  return (
    <label className="site-picker">
      Site
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </label>
  );
}
