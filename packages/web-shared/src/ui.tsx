'use client';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, X, XCircle } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { statusLabel, statusTone, type Tone } from './status';
import { initials } from './format';

export { clsx as cx };

// ---------------------------------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'dark';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 disabled:bg-brand-300',
  secondary: 'bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  success: 'bg-accent-600 text-white hover:bg-accent-700 disabled:bg-accent-300',
  dark: 'bg-ink-900 text-white hover:bg-ink-800 disabled:bg-slate-400',
};
const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------------------------------- Inputs
const inputBase =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={clsx(inputBase, 'h-10', invalid && 'ring-red-500', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(inputBase, 'min-h-[96px]', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={clsx(inputBase, 'h-10 pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-3 text-sm text-slate-700', className)}>
      <input type="checkbox" className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Field({ label, hint, error, required, children, className }: { label?: ReactNode; hint?: ReactNode; error?: string | null; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-brand-600">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------- Layout bits
export function Card({ title, subtitle, actions, children, className, padded = true }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={clsx('rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded && 'p-5')}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumb && <div className="mb-1 text-xs text-slate-500">{breadcrumb}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const tones: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export function Badge({ tone = 'gray', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  return (
    <Badge tone={statusTone(status)} dot>
      {label ?? statusLabel(status)}
    </Badge>
  );
}

export function Stat({ label, value, sub, tone, icon }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'green' | 'red' | 'amber'; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p
        className={clsx(
          'mt-2 text-2xl font-bold tabular-nums tracking-tight',
          tone === 'green' ? 'text-accent-700' : tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-900',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('size-5 animate-spin text-slate-400', className)} />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-slate-500">
      <Spinner className="size-7" />
      {label}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', title, children, className }: { tone?: 'info' | 'success' | 'warning' | 'error'; title?: ReactNode; children?: ReactNode; className?: string }) {
  const map = {
    info: ['bg-sky-50 text-sky-800 ring-sky-200', <Info key="i" className="size-5 shrink-0" />],
    success: ['bg-emerald-50 text-emerald-800 ring-emerald-200', <CheckCircle2 key="s" className="size-5 shrink-0" />],
    warning: ['bg-amber-50 text-amber-900 ring-amber-200', <AlertTriangle key="w" className="size-5 shrink-0" />],
    error: ['bg-red-50 text-red-800 ring-red-200', <XCircle key="e" className="size-5 shrink-0" />],
  } as const;
  const [cls, icon] = map[tone];
  return (
    <div className={clsx('flex gap-3 rounded-xl p-4 text-sm ring-1 ring-inset', cls, className)}>
      {icon}
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Alert tone="error" title="Something went wrong">
      <p>{(error as Error)?.message ?? 'Please try again.'}</p>
      {retry && (
        <button className="mt-2 font-semibold underline" onClick={retry}>
          Retry
        </button>
      )}
    </Alert>
  );
}

export function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-100"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

export function Progress({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pctVal = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${pctVal}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------- Table
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th className={clsx('whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500', className)}>{children}</th>
);
export const Td = ({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={clsx('px-4 py-3 align-middle text-slate-700', className)}>
    {children}
  </td>
);

export function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return <p className="px-4 py-3 text-xs text-slate-500">{total} result{total === 1 ? '' : 's'}</p>;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
      <span>
        Page {page} of {totalPages} · {total} results
      </span>
      <div className="flex gap-1">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} icon={<ChevronLeft className="size-4" />}>
          Prev
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------- Tabs
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={clsx('rounded-full px-1.5 text-[10px]', value === t.value ? 'bg-slate-100' : 'bg-slate-200')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------- Modal
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className={clsx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', w)} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------- Toasts
interface ToastItem {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: ReactNode;
}
const ToastCtx = createContext<(tone: ToastItem['tone'], message: ReactNode) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((tone: ToastItem['tone'], message: ReactNode) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, tone, message }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg',
              t.tone === 'success' ? 'bg-emerald-600' : t.tone === 'error' ? 'bg-red-600' : 'bg-slate-800',
            )}
          >
            {t.tone === 'success' ? <CheckCircle2 className="size-5 shrink-0" /> : t.tone === 'error' ? <XCircle className="size-5 shrink-0" /> : <Info className="size-5 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastCtx);
  return {
    success: (m: ReactNode) => push('success', m),
    error: (m: ReactNode) => push('error', m),
    info: (m: ReactNode) => push('info', m),
  };
}

/** Wraps an async action with loading state and error toast. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: { success?: ReactNode | ((r: R) => ReactNode) } = {}) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setLoading(true);
      try {
        const r = await fn(...args);
        if (opts.success) toast.success(typeof opts.success === 'function' ? (opts.success as (r: R) => ReactNode)(r) : opts.success);
        return r;
      } catch (e) {
        toast.error((e as Error).message ?? 'Something went wrong');
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn],
  );
  return [run, loading] as const;
}
