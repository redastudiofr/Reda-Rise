import type { Metadata, Viewport } from 'next';
import './globals.css';
import TabBar from '@/components/TabBar';

export const metadata: Metadata = {
  title: 'Hustly',
  applicationName: 'Hustly',
  description: 'Habitudes, tâches et discipline quotidienne.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Hustly' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="app">
          <main className="screen">{children}</main>
          <TabBar />
        </div>
      </body>
    </html>
  );
}
