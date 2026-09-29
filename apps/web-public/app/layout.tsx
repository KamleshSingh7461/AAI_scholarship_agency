import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Footer, Header } from '@/components/site';

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

export const viewport: Viewport = { themeColor: '#d0262e', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen bg-white">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
