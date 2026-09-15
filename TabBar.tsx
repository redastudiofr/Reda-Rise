'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Avatar from './Avatar';
import { useData } from './DataProvider';

const TABS = [
  { href: '/', label: "Aujourd'hui", icon: 'today' },
  { href: '/muscu', label: 'Musculation', icon: 'muscu' },
  { href: '/calendrier', label: 'Calendrier', icon: 'calendar' },
  { href: '/entrepreneuriat', label: 'Business', icon: 'growth' },
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
    case 'muscu':
      return (
        <svg {...common}>
          <rect x="1.5" y="9.5" width="2.8" height="5" rx="1" />
          <rect x="5.2" y="7" width="3.4" height="10" rx="1.2" />
          <rect x="15.4" y="7" width="3.4" height="10" rx="1.2" />
          <rect x="19.7" y="9.5" width="2.8" height="5" rx="1" />
          <path d="M8.6 12h6.8" />
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
        <Avatar src={profile.avatar} name={profile.pseudo || profile.name} size={24} />
        <span>Profil</span>
      </Link>
    </nav>
  );
}
