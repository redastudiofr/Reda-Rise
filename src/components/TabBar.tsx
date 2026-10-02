'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import FramedAvatar from './FramedAvatar';
import { dayXp } from '@/lib/logic';
import { activeCosmetics } from '@/lib/unlocks';
import { levelFromXp, totalXpOf } from '@/lib/xp';
import { useData } from './DataProvider';

const TABS = [
  { href: '/', label: "Aujourd'hui", icon: 'today' },
  { href: '/calendrier', label: 'Calendrier', icon: 'calendar' },
  { href: '/finances', label: 'Finances', icon: 'wallet' },
  { href: '/entrepreneuriat', label: 'Business', icon: 'growth' },
  { href: '/vetements', label: 'Vêtements', icon: 'shirt' },
  { href: '/network', label: 'Network', icon: 'network' },
] as const;

function Icon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'today':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="16" rx="3" />
          <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
          <path d="M8.8 14.2 11 16.4l4.2-4.4" />
        </svg>
      );
    case 'wallet':
      return (
        <svg {...common}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V8" />
          <rect x="4" y="8" width="16.5" height="11" rx="2.5" />
          <path d="M16 13.5h1.5" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="16" rx="3" />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
          <path d="M7.5 13h3M7.5 16.8h3M13.5 13h3M13.5 16.8h3" />
        </svg>
      );
    case 'shirt':
      return (
        <svg {...common}>
          <path d="M8.5 3.5 4 6l-1.5 4.5 3 1.2V20.5h13V11.7l3-1.2L20 6l-4.5-2.5" />
          <path d="M8.5 3.5a3.5 3 0 0 0 7 0" />
        </svg>
      );
    case 'network':
      return (
        <svg {...common}>
          <circle cx="12" cy="6" r="2.6" />
          <circle cx="5.5" cy="17" r="2.6" />
          <circle cx="18.5" cy="17" r="2.6" />
          <path d="M10.7 8.3 6.8 14.7M13.3 8.3l3.9 6.4M8.1 17h7.8" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M3 17.5 9 11l4 4 7.5-7.5" />
          <path d="M14.5 7.5h6v6" />
        </svg>
      );
  }
}

export default function TabBar() {
  const pathname = usePathname();
  const { data } = useData();
  const profile = data.settings.profile;
  const profileActive = pathname.startsWith('/profil');
  const level = useMemo(() => levelFromXp(totalXpOf(data, dayXp)).level, [data]);
  const { frame } = activeCosmetics(data.settings.cosmetics, level);

  return (
    <nav className="tabbar">
      {TABS.map((tab) => {
        // Quests belong to the day view, so the first tab stays lit there too.
        const active =
          tab.href === '/'
            ? pathname === '/' || pathname.startsWith('/quetes')
            : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className="tab" data-on={active}>
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </Link>
        );
      })}

      <Link href="/profil" className="tab tab-profile" data-on={profileActive}>
        <FramedAvatar frame={frame} src={profile.avatar} name={profile.pseudo || profile.name} size={frame ? 20 : 24} />
        <span>Profil</span>
      </Link>
    </nav>
  );
}
