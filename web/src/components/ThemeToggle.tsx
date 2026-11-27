import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import { useTheme } from '../lib/theme';

/** Interruptor de tema na base do menu lateral. */
export function ThemeSwitch() {
  const { dark, toggle } = useTheme();
  const ThemeIcon = dark ? MoonIcon : SunIcon;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
    >
      <ThemeIcon aria-hidden size={20} weight={dark ? 'fill' : 'regular'} />
      <span className="flex-1 text-left">Modo escuro</span>
      <span aria-hidden className={`flex h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${dark ? 'bg-action' : 'bg-line-hover'}`}>
        <span className={`size-4 rounded-full bg-white shadow-sm transition-transform ${dark ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

/** Versão compacta para o topo no celular, onde não há menu lateral. */
export function ThemeButton() {
  const { dark, toggle } = useTheme();
  const ThemeIcon = dark ? SunIcon : MoonIcon;
  const label = dark ? 'Mudar para o modo claro' : 'Mudar para o modo escuro';

  return (
    <button type="button" aria-label={label} title={label} onClick={toggle} className="icon-btn">
      <ThemeIcon aria-hidden size={20} />
    </button>
  );
}
