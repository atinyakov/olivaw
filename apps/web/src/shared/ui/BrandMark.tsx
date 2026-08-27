import './BrandMark.css';

export function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span className={`brand-mark ${large ? 'brand-mark-large' : ''}`}>O</span>
  );
}
