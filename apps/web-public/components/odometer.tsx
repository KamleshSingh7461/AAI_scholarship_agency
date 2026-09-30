import type { CSSProperties } from 'react';

const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Scoreboard number: each digit rolls up a 0–9 strip to its value on first paint. Pure CSS (no client JS), so the
 * server-rendered value is correct even before hydration; screen readers get the plain value.
 */
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
          ) : /[.,\s—-]/.test(ch) ? (
            <span key={i} className="whitespace-pre">{ch}</span>
          ) : (
            <span key={i} className="odo-unit">{ch}</span>
          ),
        )}
      </span>
    </>
  );
}
