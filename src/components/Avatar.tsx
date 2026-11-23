'use client';

function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Profile picture, or a clean lettered fallback when none is set. */
export default function Avatar({
  src,
  name,
  size = 28,
}: {
  src?: string;
  name?: string;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={src} alt="" style={{ width: size, height: size }} />;
  }

  const initials = initialsOf(name ?? '');
  return (
    <span className="avatar avatar-empty" style={style} aria-hidden="true">
      {initials || (
        <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
        </svg>
      )}
    </span>
  );
}
