'use client';

import { useState } from 'react';

// Mirrors the athlete portal's document step (MANDATORY_ATHLETE_DOCUMENTS + the optional sports/academic uploads).
const GROUPS = [
  {
    title: 'Must have',
    items: [
      ['photo', 'Passport-size photo', 'For your profile'],
      ['govt-id', 'Government ID', 'Aadhaar, passport, PAN or similar'],
      ['dob', 'Date-of-birth proof', 'Birth certificate or SSC certificate'],
      ['address', 'Address proof', 'Aadhaar, a utility bill or similar'],
    ],
  },
  {
    title: 'Good to have',
    items: [
      ['sports-id', 'Sports ID or federation card', 'If you have one'],
      ['certs', 'Achievement certificates', 'Your latest results and medals'],
      ['coach', 'Coach recommendation letter', ''],
      ['marks', '10th and 12th marksheets', ''],
      ['guardian', 'Parent or guardian ID', 'If you are under 18'],
    ],
  },
] as const;

const MUST_IDS: string[] = GROUPS[0].items.map(([id]) => id);
const TOTAL = GROUPS.reduce((n, g) => n + g.items.length, 0);

export function KitList({ signupUrl }: { signupUrl: string }) {
  const [packed, setPacked] = useState<Set<string>>(new Set());
  const ready = MUST_IDS.every((id) => packed.has(id));
  const toggle = (id: string) =>
    setPacked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow text-ink/60">Kit bag</p>
        <p className="eyebrow tabular-nums" aria-live="polite">
          {packed.size} of {TOTAL} packed
        </p>
      </div>
      <div className="meter mt-3" role="presentation">
        <span style={{ width: `${(packed.size / TOTAL) * 100}%`, transition: 'width .4s cubic-bezier(.2,.8,.2,1)' }} />
      </div>

      {GROUPS.map((g) => (
        <fieldset key={g.title} className="mt-8">
          <legend className="eyebrow text-brand-600">{g.title}</legend>
          <ul className="mt-2 border-t border-ink/15">
            {g.items.map(([id, label, hint]) => (
              <li key={id} className="border-b border-ink/15">
                <label className="flex cursor-pointer items-center gap-4 py-4">
                  <input type="checkbox" className="sr-only" checked={packed.has(id)} onChange={() => toggle(id)} />
                  <span className="tick" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold transition-colors ${packed.has(id) ? 'text-ink/40 line-through decoration-2' : ''}`}>{label}</span>
                    {hint && <span className="block text-sm text-ink/55">{hint}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}

      <div className={`mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[6px] p-5 transition-colors ${ready ? 'bg-ink text-paper' : 'bg-paper-2'}`}>
        <p className="font-semibold">{ready ? 'Must-haves packed. You’re ready to go.' : 'You can sign up now — documents are uploaded in the last step.'}</p>
        <a href={signupUrl} className={`btn btn-sm ${ready ? 'btn-red' : 'btn-ink'}`}>
          Create profile <span className="arrow">→</span>
        </a>
      </div>
    </div>
  );
}
