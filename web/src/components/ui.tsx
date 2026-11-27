import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  InfoIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react';
import { addMonths, type ISODate, type Month } from '../../../shared/dates';
import { capitalize, monthAbbr, monthLabel } from '../lib/format';

// ---- botões --------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'tonal' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  tonal: 'btn-tonal',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

export function Button({
  variant = 'primary',
  small,
  icon: ButtonIcon,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean; icon?: Icon }) {
  return (
    <button type="button" {...props} className={`btn ${small ? 'btn-sm' : ''} ${variants[variant]} ${className}`}>
      {ButtonIcon && <ButtonIcon aria-hidden size={small ? 16 : 18} weight="bold" />}
      {children}
    </button>
  );
}

/** Botão só com ícone; `label` vira o nome acessível e a dica ao passar o mouse. */
export function IconButton({
  label,
  icon: ButtonIcon,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: Icon }) {
  return (
    <button type="button" aria-label={label} title={label} {...props} className={`icon-btn ${className}`}>
      <ButtonIcon aria-hidden size={18} />
    </button>
  );
}

/**
 * Botão de exclusão em dois cliques (sem diálogo do navegador).
 * Com `iconOnly` começa como uma lixeira e, no primeiro clique, escreve o que vai ser excluído.
 */
export function ConfirmButton({
  onConfirm,
  label = 'Excluir',
  small = true,
  iconOnly = false,
}: {
  onConfirm: () => void;
  label?: string;
  small?: boolean;
  iconOnly?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  const compact = iconOnly && !armed;
  const size = small ? 'btn-sm' : '';

  // é sempre o mesmo <button>, então o foco do teclado não se perde ao confirmar
  return (
    <button
      type="button"
      className={compact ? 'icon-btn icon-btn-danger' : `btn ${size} ${armed ? 'btn-danger' : 'btn-ghost-danger'}`}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {compact ? <TrashIcon aria-hidden size={18} /> : armed ? (iconOnly ? `${label}?` : 'Confirmar?') : label}
    </button>
  );
}

// ---- contêineres -----------------------------------------------------------------

/** `flush` tira o espaçamento interno, para listas e tabelas que vão até a borda. */
export function Card({ children, className = '', flush = false }: { children: ReactNode; className?: string; flush?: boolean }) {
  return <div className={`card ${flush ? 'overflow-hidden' : 'card-pad'} ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-8">
      <div className="max-w-xl">
        <h1 className="text-[1.75rem] leading-9 font-medium tracking-[-0.03em] sm:text-[2rem] sm:leading-10">{title}</h1>
        {subtitle && <p className="mt-1 text-[0.9375rem] leading-6 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>.btn]:grow sm:[&>.btn]:grow-0">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex min-h-9 items-center justify-between gap-3">
      <h2 className="text-base font-medium tracking-[-0.01em]">{children}</h2>
      {aside}
    </div>
  );
}

export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="more-link">
      {children}
      <ArrowRightIcon aria-hidden size={14} weight="bold" />
    </Link>
  );
}

export function Empty({ children, icon: EmptyIcon }: { children: ReactNode; icon?: Icon }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center">
      {EmptyIcon && (
        <span className="grid size-11 place-items-center rounded-full bg-surface text-muted">
          <EmptyIcon aria-hidden size={22} />
        </span>
      )}
      <p className="max-w-md text-sm leading-6 text-muted">{children}</p>
    </div>
  );
}

export function Loading() {
  return (
    <p role="status" className="flex items-center gap-2 p-5 text-sm text-muted">
      <CircleNotchIcon aria-hidden size={18} weight="bold" className="animate-spin" />
      Carregando…
    </p>
  );
}

const calloutTones = {
  success: { box: 'bg-income-soft text-on-income-soft', icon: CheckCircleIcon },
  danger: { box: 'bg-expense-soft text-on-expense-soft', icon: WarningCircleIcon },
  info: { box: 'bg-accent-soft text-on-accent-soft', icon: InfoIcon },
};

export function Callout({
  tone = 'info',
  icon,
  role,
  className = '',
  children,
}: {
  tone?: keyof typeof calloutTones;
  icon?: Icon;
  role?: 'alert' | 'status';
  className?: string;
  children: ReactNode;
}) {
  const CalloutIcon = icon ?? calloutTones[tone].icon;
  return (
    <div role={role} className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm leading-6 ${calloutTones[tone].box} ${className}`}>
      <CalloutIcon aria-hidden size={20} weight="fill" className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

/** Explicação de rodapé de uma tela ("como isso é calculado"). */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex max-w-2xl items-start gap-2 text-xs leading-5 text-muted">
      <InfoIcon aria-hidden size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

const tileTones = {
  neutral: 'bg-surface text-ink-2',
  accent: 'bg-accent-soft text-accent',
  income: 'bg-income-soft text-income',
  expense: 'bg-expense-soft text-expense',
  warning: 'bg-warning-soft text-warning',
};

/** Quadradinho com ícone. Use `color` para as cores escolhidas pelo usuário. */
export function IconTile({
  icon: TileIcon,
  tone = 'neutral',
  color,
  small,
}: {
  icon: Icon;
  tone?: keyof typeof tileTones;
  color?: string;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center ${small ? 'size-8 rounded-lg' : 'size-10 rounded-xl'} ${color ? '' : tileTones[tone]}`}
      style={
        color
          ? {
              backgroundColor: `color-mix(in srgb, ${color} var(--tile-mix), var(--color-panel))`,
              color: `color-mix(in srgb, ${color} 68%, var(--color-ink))`,
            }
          : undefined
      }
    >
      <TileIcon size={small ? 16 : 20} weight="fill" />
    </span>
  );
}

/** Bloco de data das listas: "23 nov" para uma data, "dia 8" para o que se repete todo mês. */
export function DateTile(props: { date: ISODate } | { day: number }) {
  const big = 'date' in props ? props.date.slice(8) : String(props.day);
  const small = 'date' in props ? monthAbbr(props.date.slice(0, 7)) : 'dia';
  const smallEl = <span className="text-xs leading-4 text-muted">{small}</span>;
  return (
    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface">
      {'day' in props && smallEl}
      <span className="tabular text-base leading-5 font-medium text-ink">{big}</span>
      {'date' in props && smallEl}
    </span>
  );
}

/** Número de destaque com rótulo e ícone. */
export function StatCard({
  label,
  icon,
  tone,
  children,
}: {
  label: string;
  icon: Icon;
  tone?: keyof typeof tileTones;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2.5">
        <IconTile icon={icon} tone={tone} small />
        <p className="text-sm text-muted">{label}</p>
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

/** Valor grande de um StatCard. */
export function BigAmount({ text, tone }: { text: string; tone?: 'income' | 'expense' | 'neutral' }) {
  const cls = tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-ink';
  return <p className={`text-2xl leading-8 font-medium tracking-[-0.025em] ${cls}`}>{text}</p>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // a página atrás não rola enquanto a janela está aberta
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* no celular a janela sobe de baixo; no computador fica no centro */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-panel flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-panel shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line py-3 pr-3 pl-5 sm:pl-6">
          <h2 className="text-lg font-medium tracking-[-0.015em]">{title}</h2>
          <IconButton label="Fechar" icon={XIcon} onClick={onClose} />
        </div>
        <div className="overflow-y-auto px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">{children}</div>
      </div>
    </div>
  );
}

/** Rodapé de um formulário: excluir à esquerda (se houver), cancelar e salvar à direita. */
export function FormActions({ danger, children }: { danger?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
      <div>{danger}</div>
      <div className="ml-auto flex gap-2">{children}</div>
    </div>
  );
}

// ---- formulários ------------------------------------------------------------------

export const inputCls = 'field-control';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** <select> com a mesma cara dos outros campos. `wrapperClassName` controla a largura. */
export function Select({ wrapperClassName = '', className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <span className={`relative block ${wrapperClassName}`}>
      <select {...props} className={`${inputCls} ${className}`} />
      <CaretDownIcon aria-hidden size={16} weight="bold" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </span>
  );
}

/** Campo de texto com o "R$" na frente. */
export function MoneyInput({ className = '', large, ...props }: InputHTMLAttributes<HTMLInputElement> & { large?: boolean }) {
  return (
    <span className="relative block">
      <span aria-hidden className={`pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted ${large ? 'text-lg' : 'text-sm'}`}>
        R$
      </span>
      <input
        inputMode="decimal"
        {...props}
        className={`${inputCls} tabular ${large ? '!h-14 !pl-12 !text-2xl font-medium' : '!pl-10'} ${className}`}
      />
    </span>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  hint,
  autoFocus,
  large,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  autoFocus?: boolean;
  large?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <MoneyInput large={large} placeholder="0,00" value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Callout tone="danger" role="alert" className="my-3">
      {message}
    </Callout>
  );
}

const segmentTones = {
  neutral: 'text-ink',
  income: 'text-income',
  expense: 'text-expense',
};

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: Icon;
  tone?: keyof typeof segmentTones;
}

/** Escolha de uma entre poucas opções: abas, tipo do lançamento, filtro. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  tabs = false,
  className = '',
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  tabs?: boolean;
  className?: string;
}) {
  return (
    <div role={tabs ? 'tablist' : 'group'} aria-label={label} className={`flex gap-1 rounded-xl bg-segment p-1 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role={tabs ? 'tab' : undefined}
            aria-selected={tabs ? active : undefined}
            aria-pressed={tabs ? undefined : active}
            onClick={() => onChange(o.value)}
            className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors pointer-coarse:min-h-11 sm:px-4 ${
              active ? `bg-segment-active shadow-sm ${segmentTones[o.tone ?? 'neutral']}` : 'text-muted hover:text-ink'
            }`}
          >
            {o.icon && <o.icon aria-hidden size={16} weight={active ? 'fill' : 'regular'} className="max-[420px]:hidden" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];

const COLOR_NAMES: Record<string, string> = {
  '#ef4444': 'Vermelho',
  '#f97316': 'Laranja',
  '#eab308': 'Amarelo',
  '#22c55e': 'Verde',
  '#14b8a6': 'Turquesa',
  '#0ea5e9': 'Azul-claro',
  '#6366f1': 'Anil',
  '#8b5cf6': 'Roxo',
  '#ec4899': 'Rosa',
  '#64748b': 'Cinza',
};

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="mb-4" role="group" aria-label="Cor">
      <span className="mb-1.5 block text-sm font-medium text-ink">Cor</span>
      <div className="flex flex-wrap gap-2.5">
        {COLORS.map((c) => {
          const active = value === c;
          return (
            <button
              key={c}
              type="button"
              aria-label={COLOR_NAMES[c]}
              title={COLOR_NAMES[c]}
              aria-pressed={active}
              onClick={() => onChange(c)}
              className={`grid size-8 place-items-center rounded-full text-white transition-shadow pointer-coarse:size-11 ${
                active ? 'shadow-[0_0_0_2px_var(--color-panel),0_0_0_4px_var(--color-ink)]' : ''
              }`}
              style={{ backgroundColor: c }}
            >
              {active && <CheckIcon aria-hidden size={16} weight="bold" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- exibição -----------------------------------------------------------------------

export function ProgressBar({
  percent,
  color = 'var(--color-action)',
  over = false,
  label,
}: {
  percent: number;
  color?: string;
  over?: boolean;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-ui"
        style={{ width: `${clamped}%`, backgroundColor: over ? 'var(--color-expense)' : color }}
      />
    </div>
  );
}

const badgeTones = {
  green: 'bg-income-soft text-income',
  red: 'bg-expense-soft text-expense',
  amber: 'bg-warning-soft text-warning',
  slate: 'bg-surface text-ink-2',
  blue: 'bg-accent-soft text-accent',
};

export function Badge({ tone = 'slate', icon: BadgeIcon, children }: { tone?: keyof typeof badgeTones; icon?: Icon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${badgeTones[tone]}`}>
      {BadgeIcon && <BadgeIcon aria-hidden size={13} weight="fill" />}
      {children}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

/** Valor em reais colorido: verde para receita, vermelho para gasto. */
export function Amount({ text, tone }: { text: string; tone?: 'income' | 'expense' | 'neutral' }) {
  const cls = tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-ink';
  return <span className={`tabular font-medium whitespace-nowrap ${cls}`}>{text}</span>;
}

export function MonthNav({ month, onChange }: { month: Month; onChange: (m: Month) => void }) {
  return (
    <div className="flex h-11 grow items-center justify-between rounded-lg border border-line-strong bg-panel px-1 pointer-coarse:h-[2.875rem] pointer-coarse:px-0 sm:grow-0">
      <IconButton label="Mês anterior" icon={CaretLeftIcon} onClick={() => onChange(addMonths(month, -1))} />
      <span aria-live="polite" className="min-w-40 text-center text-sm font-medium text-ink">
        {capitalize(monthLabel(month))}
      </span>
      <IconButton label="Próximo mês" icon={CaretRightIcon} onClick={() => onChange(addMonths(month, 1))} />
    </div>
  );
}
