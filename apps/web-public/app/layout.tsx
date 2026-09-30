import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Footer, Header } from '@/components/site';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Alumni Connect India — Athletic Scholarships', template: '%s · Alumni Connect India' },
  description: 'Apply for athletic scholarships at partner universities across India. Create your athlete profile, apply online and sign securely.',
  openGraph: { title: 'Alumni Connect India', description: 'Athletic scholarships for India\'s student-athletes', type: 'website', locale: 'en_IN' },
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png' }],
    apple: [{ url: '/icon.png', type: 'image/png' }],
    shortcut: '/icon.png',
  },
};

export const viewport: Viewport = { themeColor: '#121110', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${archivo.variable} ${plexMono.variable}`}>
      <body className="min-h-screen antialiased">
        <a href="#main" className="skip-link">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
