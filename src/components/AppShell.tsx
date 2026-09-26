'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import DataProvider, { useData } from './DataProvider';
import TabBar from './TabBar';
import Loader from './Loader';

function useServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* the app still works without offline support */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
}

/** Holds the boot screen until the first sync settles, then reveals the app. */
function Booted({ children }: { children: React.ReactNode }) {
  const { status } = useData();
  if (status === 'loading') return <Loader />;
  return (
    <>
      <div className="shell">{children}</div>
      <TabBar />
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useServiceWorker();

  if (pathname === '/login' || pathname === '/offline') return <>{children}</>;

  return (
    <DataProvider>
      <Booted>{children}</Booted>
    </DataProvider>
  );
}
