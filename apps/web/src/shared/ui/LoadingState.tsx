export function LoadingState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <main className="loading-state">
      <BrandMark large />
      <h1>
        {error ? 'Fleet service unavailable' : 'Connecting to your fleet'}
      </h1>
      <p>
        {error ?? 'Loading sites and establishing a live telemetry stream…'}
      </p>
      {error && <button onClick={onRetry}>Try again</button>}
    </main>
  );
}
import { BrandMark } from './BrandMark.js';
import './LoadingState.css';
