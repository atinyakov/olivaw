import type { TelemetrySample } from '@olivaw/contracts';
import { useMemo } from 'react';
import './Sparkline.css';

export function Sparkline({
  samples,
  value,
}: {
  samples: TelemetrySample[];
  value: 'batteryPercent' | 'speedMps';
}) {
  const points = useMemo(() => {
    if (!samples.length) return '';
    const values = samples.map((sample) => sample[value]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values
      .map(
        (item, index) =>
          `${(index / Math.max(1, values.length - 1)) * 100},${28 - ((item - min) / range) * 24}`,
      )
      .join(' ');
  }, [samples, value]);

  return (
    <svg
      className="sparkline"
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-label={`${value} history chart`}
    >
      <path d="M0 30 H100" />
      <polyline points={points} />
    </svg>
  );
}
