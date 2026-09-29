import type { Metadata } from 'next';
import { Mail, MessageCircle, Phone } from 'lucide-react';

export const metadata: Metadata = { title: 'Contact us' };

const EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@alumniconnectindia.com';
const PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '';
const WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '';

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-black tracking-tight text-slate-900">Contact us</h1>
      <p className="mt-2 max-w-2xl text-slate-500">
        Questions about a scholarship, your application or your yearly renewal? Reach our athlete support team. Please include your Athlete ID (for example
        AC-01042) if you have one.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <a href={`mailto:${EMAIL}`} className="rounded-2xl p-6 ring-1 ring-slate-200 hover:ring-brand-300">
          <Mail className="size-6 text-brand-600" />
          <p className="mt-4 font-bold text-slate-900">Email</p>
          <p className="text-sm text-slate-600">{EMAIL}</p>
        </a>
        {WHATSAPP && (
          <a href={`https://wa.me/${WHATSAPP.replace(/\D/g, '')}`} className="rounded-2xl p-6 ring-1 ring-slate-200 hover:ring-brand-300">
            <MessageCircle className="size-6 text-accent-600" />
            <p className="mt-4 font-bold text-slate-900">WhatsApp</p>
            <p className="text-sm text-slate-600">{WHATSAPP}</p>
          </a>
        )}
        {PHONE && (
          <a href={`tel:${PHONE}`} className="rounded-2xl p-6 ring-1 ring-slate-200 hover:ring-brand-300">
            <Phone className="size-6 text-slate-700" />
            <p className="mt-4 font-bold text-slate-900">Phone</p>
            <p className="text-sm text-slate-600">{PHONE}</p>
          </a>
        )}
      </div>
    </div>
  );
}
