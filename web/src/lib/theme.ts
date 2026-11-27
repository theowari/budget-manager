import { useSyncExternalStore, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'light' | 'dark';

/** A mesma chave é lida pelo script do index.html, que aplica o tema antes da primeira pintura. */
const STORAGE_KEY = 'financeiro:tema';

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** O tema em uso é o que está no <html>. */
const currentTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#18181b' : '#ffffff');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // navegador sem armazenamento: o tema vale só até recarregar
  }
  listeners.forEach((listener) => listener());
}

/**
 * Troca o tema com a View Transition API: o tema novo aparece num círculo que
 * cresce a partir de onde se clicou. Sem suporte no navegador, ou com
 * "reduzir movimento" ligado no sistema, a troca é imediata.
 */
function switchTheme(next: Theme, origin: { x: number; y: number }) {
  const root = document.documentElement;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still || typeof document.startViewTransition !== 'function') {
    applyTheme(next);
    return;
  }

  root.classList.add('theme-switching');
  // flushSync: o React precisa redesenhar dentro da transição, antes da "foto" da tela nova
  const transition = document.startViewTransition(() => flushSync(() => applyTheme(next)));

  const radius = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 450, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    // a transição pode ser pulada (aba em segundo plano, clique duplo): o tema já foi aplicado
    .catch(() => {});
  transition.finished.finally(() => root.classList.remove('theme-switching'));
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme);

  const toggle = (event: MouseEvent<HTMLElement>) => {
    // o centro do botão funciona também quando ele é acionado pelo teclado
    const box = event.currentTarget.getBoundingClientRect();
    switchTheme(theme === 'dark' ? 'light' : 'dark', { x: box.left + box.width / 2, y: box.top + box.height / 2 });
  };

  return { dark: theme === 'dark', toggle };
}
