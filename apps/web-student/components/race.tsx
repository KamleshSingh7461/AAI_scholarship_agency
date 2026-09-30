import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Scoreboard number: digits roll up to their value on first paint (CSS only); units like ₹ render smaller. */
export function Odometer({ value }: { value: string }) {
  let digit = 0;
  return (
    <>
      <span className="sr-only">{value}</span>
      <span className="odo" aria-hidden="true">
        {[...value].map((ch, i) =>
          /\d/.test(ch) ? (
            <span key={i} className="odo-d" style={{ '--d': Number(ch) + 10, '--i': digit++ } as CSSProperties}>
              <span className="odo-s">
                {STRIP.map((n, k) => (
                  <span key={k}>{n}</span>
                ))}
              </span>
            </span>
          ) : /[.,\s/—-]/.test(ch) ? (
            <span key={i} className="whitespace-pre">
              {ch}
            </span>
          ) : (
            <span key={i} className="odo-unit">
              {ch}
            </span>
          ),
        )}
      </span>
    </>
  );
}

/** Splits a code like "IES-4Y-2627-412" or "AC-01042" into the small printed prefix and the big number. */
export function bibNumber(code: string | null | undefined): [string, string] {
  if (!code) return ['', '—'];
  const i = code.lastIndexOf('-');
  return i > 0 ? [code.slice(0, i), code.slice(i + 1)] : ['', code];
}

export function Pins({ bottom = true }: { bottom?: boolean }) {
  return (
    <>
      <span className="bib-pin left-2.5 top-2.5" aria-hidden />
      <span className="bib-pin right-2.5 top-2.5" aria-hidden />
      {bottom && (
        <>
          <span className="bib-pin bottom-2.5 left-2.5" aria-hidden />
          <span className="bib-pin bottom-2.5 right-2.5" aria-hidden />
        </>
      )}
    </>
  );
}

/** The athlete's own race bib: their Athlete ID as the number. */
export function AthleteBib({ code, name, sub, notch }: { code: string | null | undefined; name?: string | null; sub?: ReactNode; notch?: string }) {
  const [prefix, number] = bibNumber(code);
  return (
    <div className="bib text-ink" style={notch ? ({ '--notch': notch } as CSSProperties) : undefined}>
      <Pins />
      <div className="bib-band flex items-center justify-between px-5 pb-2.5 pt-4">
        <span className="eyebrow text-[0.62rem] text-white/85">Athlete</span>
        <span className="eyebrow text-[0.62rem] text-white/85">{prefix || 'ID'}</span>
      </div>
      <div className="px-5 pb-4 pt-2">
        <p className="display text-[3.6rem] leading-[0.85] tracking-tight">{number}</p>
        {name && <p className="mt-1 truncate text-sm font-semibold">{name}</p>}
        {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

export function SeatsMeter({ left, total }: { left: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((left / total) * 100))) : 0;
  const few = total > 0 && left > 0 && left / total <= 0.2;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{left === 0 ? 'All seats taken' : `${left} of ${total} seats left`}</span>
        {few && <span className="eyebrow text-[0.62rem] text-brand-600">Few left</span>}
      </div>
      <div className="meter mt-2" role="presentation">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="eyebrow link-grow mb-6 inline-block text-slate-600 hover:text-ink">
      ← {children}
    </Link>
  );
}

/** Full-width outcome panel for the payment / signing return pages. */
export function ResultPanel({ state, eyebrow, title, children, actions }: { state: 'success' | 'pending' | 'fail'; eyebrow: string; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mx-auto max-w-2xl overflow-hidden rounded-[8px] bg-ink text-paper" aria-live="polite">
      {state === 'success' ? (
        <div className="checker h-4" aria-hidden />
      ) : (
        <div className={`h-4 ${state === 'pending' ? 'split' : 'bg-brand-600'}`} data-state={state === 'pending' ? 'current' : undefined} aria-hidden />
      )}
      <div className="px-7 pb-9 pt-8 sm:px-10">
        <p className={`eyebrow ${state === 'success' ? 'text-accent-300' : state === 'pending' ? 'text-[#f4c65a]' : 'text-brand-400'}`}>{eyebrow}</p>
        <h1 className="display rise mt-3 text-[clamp(3rem,9vw,5.5rem)]">{title}</h1>
        <div className="mt-5 max-w-lg text-paper/75">{children}</div>
        {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </section>
  );
}

/** Small mono label + value pair used in ledgers. */
export function Ledger({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-dashed divide-ink/15">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-6 py-3">
          <dt className="eyebrow text-[0.66rem] text-slate-500">{k}</dt>
          <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
