'use client';

/** Branded boot screen, shown while the first sync is in flight. */
export default function Loader() {
  return (
    <div className="boot" role="status" aria-label="Chargement">
      <div className="boot-mark">
        <span className="boot-ring" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={72} height={72} />
      </div>
      <div className="boot-name">REDA RISE</div>
      <div className="boot-bar">
        <i />
      </div>
    </div>
  );
}
