import { useEffect, useRef } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  ArrowsClockwiseIcon,
  ChartLineUpIcon,
  CreditCardIcon,
  GearSixIcon,
  HouseIcon,
  PiggyBankIcon,
  ReceiptIcon,
  TargetIcon,
  WalletIcon,
} from '@phosphor-icons/react';
import { ThemeButton, ThemeSwitch } from './components/ThemeToggle';
import { BudgetPage } from './pages/BudgetPage';
import { CardsPage } from './pages/CardsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EntriesPage } from './pages/EntriesPage';
import { GoalsPage } from './pages/GoalsPage';
import { ProjectionPage } from './pages/ProjectionPage';
import { SettingsPage } from './pages/SettingsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';

const NAV = [
  { to: '/', label: 'Resumo', icon: HouseIcon, end: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: ReceiptIcon },
  { to: '/cartoes', label: 'Cartões', icon: CreditCardIcon },
  { to: '/assinaturas', label: 'Assinaturas', icon: ArrowsClockwiseIcon },
  { to: '/caixinhas', label: 'Caixinhas', icon: PiggyBankIcon },
  { to: '/orcamento', label: 'Orçamento', icon: TargetIcon },
  { to: '/projecao', label: 'Projeção', icon: ChartLineUpIcon },
  { to: '/cadastros', label: 'Cadastros', icon: GearSixIcon },
];

function Brand({ className }: { className: string }) {
  return (
    <div className={`items-center gap-2.5 ${className}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-action text-white">
        <WalletIcon aria-hidden size={20} weight="fill" />
      </span>
      <span className="text-lg font-medium tracking-[-0.025em] text-ink">Financeiro</span>
    </div>
  );
}

export function App() {
  const { pathname } = useLocation();
  const listRef = useRef<HTMLUListElement>(null);

  // cada tela começa do topo; no celular, o item atual fica visível no menu
  useEffect(() => {
    window.scrollTo(0, 0);
    const centerCurrent = () => {
      const list = listRef.current;
      const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
      if (list && current) list.scrollLeft = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2;
    };
    centerCurrent();
    // a fonte pode chegar depois e mudar a largura dos itens
    void document.fonts.ready.then(centerCurrent);
  }, [pathname]);

  return (
    <div className="min-h-dvh md:flex">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>

      {/* no celular não há menu lateral: o tema fica no topo */}
      <div className="flex items-center justify-between gap-3 bg-panel px-4 pt-3 pb-1 md:hidden">
        <Brand className="flex" />
        <ThemeButton />
      </div>

      <nav
        aria-label="Principal"
        className="sticky top-0 z-30 border-b border-line bg-panel md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 lg:w-60"
      >
        <Brand className="hidden px-5 pt-6 pb-5 md:flex" />
        <ul ref={listRef} className="relative flex gap-1 overflow-x-auto px-3 py-1.5 [scrollbar-width:none] md:py-2 md:flex-1 md:flex-col md:overflow-visible md:pt-1">
          {NAV.map((item) => (
            // "Cadastros" é configuração: no menu lateral fica no rodapé
            <li key={item.to} className="shrink-0 md:last:mt-auto">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-11 items-center rounded-lg font-medium transition-colors max-md:min-w-[4.75rem] max-md:flex-col max-md:justify-center max-md:gap-0.5 max-md:px-2.5 max-md:py-1.5 max-md:text-xs md:gap-3 md:px-3 md:text-sm ${
                    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon aria-hidden size={20} weight={isActive ? 'fill' : 'regular'} />
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="hidden shrink-0 border-t border-line p-3 md:block">
          <ThemeSwitch />
        </div>
      </nav>

      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-10">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/lancamentos" element={<EntriesPage />} />
          <Route path="/cartoes" element={<CardsPage />} />
          <Route path="/assinaturas" element={<SubscriptionsPage />} />
          <Route path="/caixinhas" element={<GoalsPage />} />
          <Route path="/orcamento" element={<BudgetPage />} />
          <Route path="/projecao" element={<ProjectionPage />} />
          <Route path="/cadastros" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
