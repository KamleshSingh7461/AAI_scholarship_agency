import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-16 sm:px-6">
      <p className="eyebrow text-brand-600">Error 404</p>
      <h1 className="display mt-3 text-[clamp(4rem,14vw,11rem)]">Off track.</h1>
      <p className="mt-6 max-w-lg text-lg text-ink/70">This page isn’t on the course. It may have moved, or the link may be wrong.</p>
      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
        <Link href="/scholarships" className="btn btn-ink">
          Browse scholarships <span className="arrow">→</span>
        </Link>
        <Link href="/" className="link-underline font-semibold">
          Back to the start line
        </Link>
      </div>
    </div>
  );
}
