'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNet } from './NetContext';

const LINKS = [
  { href: '/network', label: 'Découvrir' },
  { href: '/network/carte', label: 'Carte' },
  { href: '/network/profil', label: 'Mon profil' },
];

/** Header of every Network page, with the section links (the only navigation members have). */
export default function NetNav({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  const pathname = usePathname();
  const { unread, owner } = useNet();
  const links = owner ? [...LINKS, { href: '/network/moderation', label: 'Modération' }] : LINKS;
  return (
    <>
      <header className="topbar">
        <div>
          <h1>{title}</h1>
          {sub ? <p className="sub">{sub}</p> : null}
        </div>
        {action}
      </header>
      <nav className="pill-row net-nav" aria-label="Network">
        {links.map((l) => {
          const on = l.href === '/network' ? pathname === '/network' || pathname.startsWith('/network/membre') : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className="pill" data-on={on} aria-current={on ? 'page' : undefined}>
              {l.label}
              {l.href === '/network/messages' && unread > 0 ? (
                <span className="net-badge" aria-label={`${unread} non lu${unread > 1 ? 's' : ''}`}>{unread > 99 ? '99+' : unread}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
