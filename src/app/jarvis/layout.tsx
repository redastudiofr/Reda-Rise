import type { Metadata, Viewport } from 'next';
import { Chakra_Petch, Orbitron, Share_Tech_Mono } from 'next/font/google';
import './jarvis.css';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-orbitron' });
const chakra = Chakra_Petch({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-chakra' });
const sharetech = Share_Tech_Mono({ subsets: ['latin'], weight: '400', variable: '--font-sharetech' });

export const metadata: Metadata = {
  title: 'Jarvis',
  description: 'Assistant vocal personnel',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#03080d' };

/** Jarvis lives inside Reda Rise but has its own full screen, without the tab bar. */
export default function JarvisLayout({ children }: { children: React.ReactNode }) {
  return <div className={`jarvis-root ${orbitron.variable} ${chakra.variable} ${sharetech.variable}`}>{children}</div>;
}
