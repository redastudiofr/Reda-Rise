import type { Metadata, Viewport } from 'next';
import { Chakra_Petch, Orbitron, Share_Tech_Mono } from 'next/font/google';
import './globals.css';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-orbitron' });
const chakra = Chakra_Petch({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-chakra' });
const sharetech = Share_Tech_Mono({ subsets: ['latin'], weight: '400', variable: '--font-sharetech' });

export const metadata: Metadata = {
  title: 'Jarvis',
  description: 'Assistant vocal personnel',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#03080d', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${orbitron.variable} ${chakra.variable} ${sharetech.variable}`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
