import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Contact us' };

const EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@alumniconnectindia.com';
const PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '';
const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '';

export default function ContactPage() {
  const channels = [
    { label: 'Email', value: EMAIL, href: `mailto:${EMAIL}` },
    WHATSAPP && { label: 'WhatsApp', value: WHATSAPP, href: `https://wa.me/${WHATSAPP.replace(/\D/g, '')}` },
    PHONE && { label: 'Phone', value: PHONE, href: `tel:${PHONE}` },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-12 sm:px-6">
      <div className="grid grid-cols-1 gap-6 border-b-2 border-ink pb-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <p className="eyebrow text-brand-600">Athlete support</p>
          <h1 className="display mt-3 text-[clamp(3.5rem,11vw,9rem)]">Talk to us.</h1>
        </div>
        <p className="text-ink/70 lg:col-span-4">
          Questions about a scholarship, your application or your yearly renewal? Include your Athlete ID (for example AC-01042) if you have one — it helps
          us find you faster.
        </p>
      </div>

      <ul>
        {channels.map((c) => (
          <li key={c.label} className="border-b border-ink/15">
            <a href={c.href} className="group grid grid-cols-1 items-baseline gap-x-8 gap-y-2 py-8 transition-[padding] duration-300 hover:pl-3 md:grid-cols-[10rem_minmax(0,1fr)_auto]">
              <span className="eyebrow text-ink/55">{c.label}</span>
              <span className="display break-all text-[clamp(1.9rem,5vw,4rem)] transition-colors group-hover:text-brand-600">{c.value}</span>
              <span className="eyebrow hidden md:inline">
                Open <span className="arrow">→</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
