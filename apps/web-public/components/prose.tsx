import type { ReactNode } from 'react';

export function ProsePage({ title, eyebrow, updated, children }: { title: string; eyebrow?: string; updated?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-7xl px-4 pb-28 pt-12 sm:px-6">
      <header className="border-b-2 border-ink pb-10">
        {eyebrow && <p className="eyebrow text-brand-600">{eyebrow}</p>}
        <h1 className="display mt-3 max-w-5xl text-[clamp(3rem,8vw,6.5rem)]">{title}</h1>
        {updated && <p className="eyebrow mt-6 text-ink/55">Last updated {updated}</p>}
      </header>
      <div className="prose-ac mt-10 max-w-3xl space-y-5 text-[17px] leading-8 text-ink/75">{children}</div>
    </article>
  );
}
