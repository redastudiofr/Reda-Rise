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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="boot-name" src="/icons/telos-wordmark.png" alt="Telos" width={1167} height={252} />
      <div className="boot-bar">
        <i />
      </div>
    </div>
  );
}
