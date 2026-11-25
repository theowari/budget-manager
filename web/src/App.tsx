import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { BudgetPage } from './pages/BudgetPage';
import { CardsPage } from './pages/CardsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EntriesPage } from './pages/EntriesPage';
import { GoalsPage } from './pages/GoalsPage';
import { ProjectionPage } from './pages/ProjectionPage';
import { SettingsPage } from './pages/SettingsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';

const NAV = [
  { to: '/', label: 'Resumo', icon: '🏠', end: true },
  { to: '/lancamentos', label: 'Lançamentos', icon: '🧾' },
  { to: '/cartoes', label: 'Cartões', icon: '💳' },
  { to: '/assinaturas', label: 'Assinaturas', icon: '🔁' },
  { to: '/caixinhas', label: 'Caixinhas', icon: '🐷' },
  { to: '/orcamento', label: 'Orçamento', icon: '🎯' },
  { to: '/projecao', label: 'Projeção', icon: '📈' },
  { to: '/cadastros', label: 'Cadastros', icon: '⚙️' },
];

export function App() {
  return (
    <div className="min-h-screen md:flex">
      <nav className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="hidden px-5 py-6 text-lg font-bold text-indigo-700 md:block">💰 Financeiro</div>
        <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:p-3">
          {NAV.map((item) => (
            <li key={item.to} className="shrink-0">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6 lg:p-8">
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
