'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: "Aujourd'hui", icon: 'sun' },
  { href: '/habitudes', label: 'Habitudes', icon: 'checklist' },
  { href: '/taches', label: 'Tâches', icon: 'list' },
  { href: '/statistiques', label: 'Statistiques', icon: 'bars' },
  { href: '/parametres', label: 'Paramètres', icon: 'gear' },
];

export default function TabBar() {
  const pathname = usePathname();
  const active = Math.max(
    0,
    TABS.findIndex((t) => (t.href === '/' ? pathname === '/' : pathname.startsWith(t.href))),
  );

  return (
    <nav className="tabbar" aria-label="Navigation principale">
      <div className="tabbar-inner">
        <span
          className="tabbar-pill"
          style={{ transform: `translateX(${active * 100}%)` }}
          aria-hidden="true"
        />
        {TABS.map((t, i) => (
          <Link
            key={t.href}
            href={t.href}
            className={`tab ${i === active ? 'is-active' : ''}`}
            aria-current={i === active ? 'page' : undefined}
            prefetch
          >
            <Icon name={t.icon} size={24} strokeWidth={2.1} />
            <span>{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
