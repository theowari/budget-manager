import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { currentMonth } from '../../../shared/dates';
import { useDashboard } from '../api/hooks';
import { EntryForm } from '../components/EntryForm';
import { Amount, Badge, Button, Card, Dot, Empty, ErrorBox, MonthNav, PageHeader, ProgressBar, SectionTitle } from '../components/ui';
import { brl, formatDate, monthShort } from '../lib/format';

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [formOpen, setFormOpen] = useState(false);
  const dash = useDashboard(month);
  const d = dash.data;

  const totalSpent = d?.spent_by_category.reduce((s, c) => s + c.spent_cents, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Resumo"
        subtitle="Como está o seu dinheiro."
        actions={
          <>
            <MonthNav month={month} onChange={setMonth} />
            <Button onClick={() => setFormOpen(true)}>+ Novo lançamento</Button>
          </>
        }
      />

      <ErrorBox error={dash.error} />
      {dash.isLoading && <p className="text-sm text-slate-500">Carregando…</p>}

      {d && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="lg:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Patrimônio total</p>
              <p className="mt-1 text-3xl font-bold tabular text-slate-900">{brl(d.net_worth_cents)}</p>
              <p className="mt-2 text-xs text-slate-500">
                Contas <strong className="tabular text-slate-700">{brl(d.accounts_total_cents)}</strong> · Caixinhas{' '}
                <strong className="tabular text-slate-700">{brl(d.goals_total_cents)}</strong>
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Receitas do mês</p>
              <p className="mt-1 text-xl"><Amount text={brl(d.month_summary.income_cents)} tone="income" /></p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gastos do mês</p>
              <p className="mt-1 text-xl"><Amount text={brl(d.month_summary.expense_cents)} tone="expense" /></p>
              <p className="mt-1 text-xs text-slate-500">
                Resultado:{' '}
                <span className={`tabular font-medium ${d.month_summary.result_cents < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{brl(d.month_summary.result_cents)}</span>
              </p>
            </Card>
          </div>

          {d.budget_alerts.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <SectionTitle aside={<Link to="/orcamento" className="text-xs font-medium text-indigo-600 hover:underline">Ver orçamento</Link>}>Atenção ao orçamento</SectionTitle>
              <ul className="space-y-3">
                {d.budget_alerts.map((a) => (
                  <li key={a.category_id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium text-slate-800">
                        <Dot color={a.color} />
                        {a.name}
                        {a.percent > 100 ? <Badge tone="red">estourou</Badge> : <Badge tone="amber">{a.percent}%</Badge>}
                      </span>
                      <span className="tabular text-xs text-slate-500">
                        {brl(a.spent_cents)} / {brl(a.limit_cents)}
                      </span>
                    </div>
                    <ProgressBar percent={a.percent} color={a.color} over={a.percent > 100} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle>Gastos por categoria</SectionTitle>
              {d.spent_by_category.length ? (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-44 w-44 shrink-0" aria-label="Gráfico de gastos por categoria">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={d.spent_by_category} dataKey="spent_cents" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="none">
                          {d.spent_by_category.map((c) => (
                            <Cell key={c.category_id} fill={c.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => brl(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="w-full flex-1 space-y-2">
                    {d.spent_by_category.map((c) => (
                      <li key={c.category_id} className="flex items-center gap-2 text-sm">
                        <Dot color={c.color} />
                        <span className="flex-1 truncate text-slate-700">{c.name}</span>
                        <span className="text-xs text-slate-400">{Math.round((c.spent_cents / totalSpent) * 100)}%</span>
                        <span className="tabular w-24 text-right font-medium text-slate-900">{brl(c.spent_cents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Empty>Nenhum gasto neste mês ainda.</Empty>
              )}
            </Card>

            <Card>
              <SectionTitle aside={<Link to="/cartoes" className="text-xs font-medium text-indigo-600 hover:underline">Ver cartões</Link>}>Faturas a pagar</SectionTitle>
              {d.pending_invoices.length ? (
                <ul className="space-y-2.5">
                  {d.pending_invoices.slice(0, 6).map((inv) => (
                    <li key={`${inv.card_id}-${inv.invoice_month}`} className="flex items-center gap-3 text-sm">
                      <Dot color={inv.card_color} />
                      <span className="flex-1">
                        <span className="font-medium text-slate-800">{inv.card_name}</span>
                        <span className="text-slate-400"> · fatura {monthShort(inv.invoice_month)}</span>
                        <span className="block text-xs text-slate-500">vence {formatDate(inv.due_date)}</span>
                      </span>
                      <Amount text={brl(inv.remaining_cents)} tone="expense" />
                    </li>
                  ))}
                  {d.pending_invoices.length > 6 && <li className="text-xs text-slate-400">e mais {d.pending_invoices.length - 6} fatura(s) futuras…</li>}
                </ul>
              ) : (
                <Empty>Nenhuma fatura em aberto. 🎉</Empty>
              )}
            </Card>
          </div>

          <Card>
            <SectionTitle aside={<Link to="/caixinhas" className="text-xs font-medium text-indigo-600 hover:underline">Ver caixinhas</Link>}>Caixinhas</SectionTitle>
            {d.goals.length ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {d.goals.map((g) => (
                  <li key={g.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-800">{g.name}</span>
                      <span className="tabular text-xs text-slate-500">
                        {brl(g.saved_cents)} / {brl(g.target_cents)}
                      </span>
                    </div>
                    <ProgressBar percent={g.percent} color={g.color} />
                    {g.pace.per_month_cents !== null && !g.pace.reached && (
                      <p className="mt-1 text-xs text-slate-500">Guarde {brl(g.pace.per_month_cents)}/mês para chegar no prazo.</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                Crie uma caixinha para um objetivo: <Link to="/caixinhas" className="font-medium text-indigo-600 hover:underline">nova caixinha</Link>.
              </Empty>
            )}
          </Card>
        </div>
      )}

      {formOpen && <EntryForm onClose={() => setFormOpen(false)} />}
    </>
  );
}
