import type { ReactNode } from 'react';

export function ProsePage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-black tracking-tight text-slate-900">{title}</h1>
      {updated && <p className="mt-2 text-sm text-slate-500">Last updated {updated}</p>}
      <div className="mt-8 space-y-5 text-[15px] leading-7 text-slate-600 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </article>
  );
}
