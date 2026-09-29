import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-brand-600">404</p>
      <h1 className="mt-2 text-3xl font-black text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you are looking for doesn’t exist or has moved.</p>
      <Link href="/scholarships" className="mt-8 rounded-xl bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700">
        Browse scholarships
      </Link>
    </div>
  );
}
