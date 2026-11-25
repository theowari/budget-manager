import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { addMonths, type Month } from '../../../shared/dates';
import { capitalize, monthLabel } from '../lib/format';

// ---- estilos de campos -------------------------------------------------------

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100';

// ---- botões --------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({
  variant = 'primary',
  small,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'
      } ${variants[variant]} ${className}`}
    />
  );
}

/** Botão de exclusão em dois cliques (sem diálogo do navegador). */
export function ConfirmButton({
  onConfirm,
  label = 'Excluir',
  small = true,
}: {
  onConfirm: () => void;
  label?: string;
  small?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return armed ? (
    <Button
      variant="danger"
      small={small}
      onClick={() => {
        setArmed(false);
        onConfirm();
      }}
    >
      Confirmar?
    </Button>
  ) : (
    <Button variant="ghost" small={small} className="text-rose-600 hover:bg-rose-50" onClick={() => setArmed(true)}>
      {label}
    </Button>
  );
}

// ---- contêineres -----------------------------------------------------------------

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {aside}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{children}</p>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-label={title} className="my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- formulários ------------------------------------------------------------------

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  hint,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  autoFocus?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        className={`${inputCls} tabular`}
        inputMode="decimal"
        placeholder="0,00"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p>;
}

export const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="mb-3">
      <span className="mb-1 block text-xs font-medium text-slate-600">Cor</span>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Cor ${c}`}
            onClick={() => onChange(c)}
            className={`h-7 w-7 rounded-full border-2 transition ${value === c ? 'border-slate-900 scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

// ---- exibição -----------------------------------------------------------------------

export function ProgressBar({ percent, color = '#6366f1', over = false }: { percent: number; color?: string; over?: boolean }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.min(100, percent)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: over ? '#e11d48' : color }}
      />
    </div>
  );
}

const badgeTones = {
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-700',
  slate: 'bg-slate-100 text-slate-600',
  indigo: 'bg-indigo-100 text-indigo-700',
};

export function Badge({ tone = 'slate', children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>{children}</span>;
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

/** Valor em reais colorido: verde para receita, vermelho para gasto. */
export function Amount({ text, tone }: { text: string; tone?: 'income' | 'expense' | 'neutral' }) {
  const cls = tone === 'income' ? 'text-emerald-600' : tone === 'expense' ? 'text-rose-600' : 'text-slate-900';
  return <span className={`tabular font-semibold ${cls}`}>{text}</span>;
}

export function MonthNav({ month, onChange }: { month: Month; onChange: (m: Month) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-sm">
      <button type="button" aria-label="Mês anterior" className="px-3 py-2 text-slate-500 hover:bg-slate-50" onClick={() => onChange(addMonths(month, -1))}>
        ‹
      </button>
      <span className="min-w-40 text-center text-sm font-medium">{capitalize(monthLabel(month))}</span>
      <button type="button" aria-label="Próximo mês" className="px-3 py-2 text-slate-500 hover:bg-slate-50" onClick={() => onChange(addMonths(month, 1))}>
        ›
      </button>
    </div>
  );
}
