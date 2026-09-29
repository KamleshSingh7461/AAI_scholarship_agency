'use client';
import clsx from 'clsx';
import { MessageCircle, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import { useAuth, type SessionUser } from './auth';
import { Alert, Button, Field, Input } from './ui';

interface ChallengeResponse {
  challengeId: string;
  channel: 'SMS' | 'WHATSAPP';
  maskedPhone: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  devCode?: string;
}

/**
 * Passwordless login: phone number → 6-digit code by WhatsApp (default) or SMS.
 * `audience="staff"` only lets existing staff in; `audience="student"` also creates new athlete accounts.
 */
export function OtpLogin({ audience, onSuccess, title, subtitle }: { audience: 'student' | 'staff'; onSuccess: (user: SessionUser, isNewUser: boolean) => void; title?: string; subtitle?: string }) {
  const { setSession } = useAuth();
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const request = async (e?: FormEvent, ch = channel) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api<ChallengeResponse>('/auth/otp/request', { method: 'POST', body: { phone, channel: ch, audience } });
      setChallenge(r);
      setDigits(Array(6).fill(''));
      setCooldown(r.resendAfterSeconds);
      setTimeout(() => refs.current[0]?.focus(), 50);
    } catch (err) {
      const e2 = err as ApiError;
      setError(e2.body?.retryAfterSeconds ? `${e2.message} (${e2.body.retryAfterSeconds}s)` : e2.message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (code: string) => {
    if (!challenge) return;
    setError(null);
    setLoading(true);
    try {
      const r = await api<{ accessToken: string; user: SessionUser; isNewUser: boolean }>('/auth/otp/verify', { method: 'POST', body: { challengeId: challenge.challengeId, code } });
      setSession(r.accessToken, r.user);
      onSuccess(r.user, r.isNewUser);
    } catch (err) {
      setError((err as Error).message);
      setDigits(Array(6).fill(''));
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) {
      // pasted the whole code
      const next = clean.slice(0, 6).split('');
      const filled = [...next, ...Array(6 - next.length).fill('')];
      setDigits(filled);
      if (next.length === 6) void verify(next.join(''));
      else refs.current[next.length]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d)) void verify(next.join(''));
  };

  if (!challenge) {
    return (
      <form onSubmit={request} className="space-y-5">
        {title && (
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
        )}
        <Field label="Mobile number" hint="Indian numbers can be entered without +91">
          <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Send the code by</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['WHATSAPP', 'WhatsApp', <MessageCircle key="w" className="size-4" />],
                ['SMS', 'SMS', <Smartphone key="s" className="size-4" />],
              ] as const
            ).map(([v, label, icon]) => (
              <button
                type="button"
                key={v}
                onClick={() => setChannel(v)}
                className={clsx(
                  'flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold ring-1 ring-inset transition',
                  channel === v ? 'bg-brand-50 text-brand-700 ring-brand-500' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" block size="lg" loading={loading}>
          Send code
        </Button>
        <p className="text-center text-xs text-slate-500">We never ask for a password. Codes expire in 5 minutes and must not be shared.</p>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Enter your code</h1>
        <p className="mt-1 text-sm text-slate-500">
          We sent a 6-digit code by {challenge.channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'} to <span className="font-semibold text-slate-800">{challenge.maskedPhone}</span>.
        </p>
      </div>
      <div className="flex justify-between gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && refs.current[i - 1]?.focus()}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            className="h-14 w-full rounded-xl border-0 text-center text-2xl font-bold text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-500"
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>
      {challenge.devCode && (
        <Alert tone="warning" title="Local development">
          Your code is <button className="font-mono font-bold underline" onClick={() => setDigit(0, challenge.devCode!)}>{challenge.devCode}</button> (click to fill). Real deployments never show this.
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <Button block size="lg" loading={loading} disabled={digits.some((d) => !d)} onClick={() => verify(digits.join(''))}>
        Verify & continue
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button className="text-slate-500 hover:text-slate-800" onClick={() => setChallenge(null)}>
          ← Change number
        </button>
        {cooldown > 0 ? (
          <span className="text-slate-400">Resend in {cooldown}s</span>
        ) : (
          <div className="flex gap-3">
            <button className="font-semibold text-brand-700 hover:underline" onClick={() => request(undefined, challenge.channel)}>
              Resend
            </button>
            <button className="font-semibold text-slate-600 hover:underline" onClick={() => request(undefined, challenge.channel === 'WHATSAPP' ? 'SMS' : 'WHATSAPP')}>
              Use {challenge.channel === 'WHATSAPP' ? 'SMS' : 'WhatsApp'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
