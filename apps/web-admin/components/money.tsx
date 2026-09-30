'use client';
import clsx from 'clsx';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { convert, type Currency } from '@aci/contracts';
import { money } from '@aci/web-shared';

type Display = 'INR' | 'USD';
const Ctx = createContext<{ display: Display; setDisplay: (d: Display) => void }>({ display: 'INR', setDisplay: () => undefined });

/** Admin screens show both currencies; the toggle picks which one is primary. */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [display, setDisplay] = useState<Display>('INR');
  useEffect(() => {
    try {
      const v = localStorage.getItem('aci:display-currency');
      if (v === 'INR' || v === 'USD') setDisplay(v);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const set = (d: Display) => {
    setDisplay(d);
    try {
      localStorage.setItem('aci:display-currency', d);
    } catch {
      /* ignore */
    }
  };
  return <Ctx.Provider value={{ display, setDisplay: set }}>{children}</Ctx.Provider>;
}

export const useDisplayCurrency = () => useContext(Ctx);

export function CurrencyToggle({ dark }: { dark?: boolean }) {
  const { display, setDisplay } = useDisplayCurrency();
  return (
    <div className={clsx('eyebrow inline-flex rounded-[4px] p-0.5 text-[0.62rem]', dark ? 'bg-white/10' : 'bg-slate-100')} role="group" aria-label="Display currency">
      {(['INR', 'USD'] as const).map((c) => (
        <button
          key={c}
          onClick={() => setDisplay(c)}
          aria-pressed={display === c}
          className={clsx(
            'rounded-[3px] px-2.5 py-1 transition',
            display === c ? (dark ? 'bg-white text-ink-900' : 'bg-white text-slate-900 shadow-sm') : dark ? 'text-white/70' : 'text-slate-500',
          )}
        >
          {c === 'INR' ? '₹ INR' : '$ USD'}
        </button>
      ))}
    </div>
  );
}

/** An amount in its native currency, rendered in the chosen display currency with the other one underneath. */
export function Money({ minor, currency = 'INR', rate4, compact, inline, className }: { minor: number; currency?: string; rate4: number; compact?: boolean; inline?: boolean; className?: string }) {
  const { display } = useDisplayCurrency();
  const other: Display = display === 'INR' ? 'USD' : 'INR';
  const main = convert(Number(minor ?? 0), currency as Currency, display, rate4);
  const sub = convert(Number(minor ?? 0), currency as Currency, other, rate4);
  if (inline) {
    return (
      <span className={className}>
        {money(main, display, { compact })} <span className="text-xs font-normal text-slate-400">({money(sub, other, { compact })})</span>
      </span>
    );
  }
  return (
    <span className={clsx('inline-flex flex-col', className)}>
      <span>{money(main, display, { compact })}</span>
      <span className="text-[11px] font-normal text-slate-400">{money(sub, other, { compact })}</span>
    </span>
  );
}

/** For API values that already come as { inr, usd }. */
export function MoneyPair({ value, compact, className }: { value: { inr: number; usd: number }; compact?: boolean; className?: string }) {
  const { display } = useDisplayCurrency();
  const [a, b] = display === 'INR' ? [money(value.inr, 'INR', { compact }), money(value.usd, 'USD', { compact })] : [money(value.usd, 'USD', { compact }), money(value.inr, 'INR', { compact })];
  return (
    <span className={clsx('inline-flex flex-col', className)}>
      <span>{a}</span>
      <span className="text-xs font-medium text-slate-400">{b}</span>
    </span>
  );
}
