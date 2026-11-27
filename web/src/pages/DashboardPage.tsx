import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BankIcon,
  ChartDonutIcon,
  CheckCircleIcon,
  CreditCardIcon,
  PiggyBankIcon,
  PlusIcon,
  WarningCircleIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { currentMonth, todayISO } from '../../../shared/dates';
import type { PendingInvoice } from '../../../shared/types';
import { useDashboard } from '../api/hooks';
import { EntryForm } from '../components/EntryForm';
import {
  Amount, Badge, BigAmount, Button, Card, Dot, Empty, ErrorBox, IconTile, Loading, MonthNav, MoreLink, PageHeader,
  ProgressBar, SectionTitle, StatCard,
} from '../components/ui';
import { brl, formatDate, monthShort } from '../lib/format';

/** Mesma regra da tela de Cartões: vencida a partir do dia seguinte ao vencimento. */
const isOverdue = (invoice: PendingInvoice) => invoice.due_date < todayISO();

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [formOpen, setFormOpen] = useState(false);
  const dash = useDashboard(month);
  const d = dash.data;

  const totalSpent = d?.spent_by_category.reduce((s, c) => s + c.spent_cents, 0) ?? 0;
  const share = (cents: number) => {
    const percent = Math.round((cents / totalSpent) * 100);
    return percent === 0 ? '<1%' : `${percent}%`;
  };

  return (
    <>
      <PageHeader
        title="Resumo"
        subtitle="Como está o seu dinheiro."
        actions={
          <>
            <MonthNav month={month} onChange={setMonth} />
            <Button icon={PlusIcon} onClick={() => setFormOpen(true)}>
              Novo lançamento
            </Button>
          </>
        }
      />

      <ErrorBox error={dash.error} />
      {dash.isLoading && <Loading />}

      {d && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <section aria-label="Patrimônio" className="flex flex-col justify-between gap-5 rounded-2xl bg-hero p-5 text-white sm:col-span-2 sm:p-6">
              <div>
                <p className="text-sm text-white/70">Patrimônio total</p>
                <p className="mt-1 text-[2.5rem] leading-[1.15] font-medium tracking-[-0.035em]">{brl(d.net_worth_cents)}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <NetWorthPart icon={BankIcon} label="Contas" value={brl(d.accounts_total_cents)} />
                <NetWorthPart icon={PiggyBankIcon} label="Caixinhas" value={brl(d.goals_total_cents)} />
              </dl>
            </section>

            <StatCard label="Receitas do mês" icon={ArrowDownLeftIcon} tone="income">
              <BigAmount text={brl(d.month_summary.income_cents)} tone="income" />
            </StatCard>

            <StatCard label="Gastos do mês" icon={ArrowUpRightIcon} tone="expense">
              <BigAmount text={brl(d.month_summary.expense_cents)} tone="expense" />
              <p className="mt-3 flex flex-wrap justify-between gap-x-2 border-t border-line pt-3 text-sm text-muted">
                Resultado
                <Amount text={brl(d.month_summary.result_cents)} tone={d.month_summary.result_cents < 0 ? 'expense' : 'income'} />
              </p>
            </StatCard>
          </div>

          {d.budget_alerts.length > 0 && (
            <Card>
              <SectionTitle aside={<MoreLink to="/orcamento">Ver orçamento</MoreLink>}>
                <span className="flex items-center gap-2.5">
                  <IconTile icon={WarningIcon} tone="warning" small />
                  Atenção ao orçamento
                </span>
              </SectionTitle>
              <ul className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
                {d.budget_alerts.map((a) => {
                  // mesma regra da tela de Orçamento: estourou quando o gasto passa do limite
                  const over = a.spent_cents > a.limit_cents;
                  return (
                    <li key={a.category_id}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <Dot color={a.color} />
                          {a.name}
                          {over ? <Badge tone="red">estourou</Badge> : <Badge tone="amber">{a.percent}%</Badge>}
                        </span>
                        <span className="tabular text-xs text-muted">
                          {brl(a.spent_cents)} de {brl(a.limit_cents)}
                        </span>
                      </div>
                      <ProgressBar percent={a.percent} color={a.color} over={over} label={`Orçamento de ${a.name}`} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle>Gastos por categoria</SectionTitle>
              {d.spent_by_category.length ? (
                <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
                  <div className="relative size-44 shrink-0" role="img" aria-label="Gráfico de gastos por categoria">
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted">Total</span>
                      <span className="text-base font-medium tracking-[-0.02em] text-ink">{brl(totalSpent)}</span>
                    </div>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={d.spent_by_category}
                          dataKey="spent_cents"
                          nameKey="name"
                          innerRadius={62}
                          outerRadius={86}
                          startAngle={90}
                          endAngle={-270}
                          stroke="var(--color-panel)"
                          strokeWidth={2}
                        >
                          {d.spent_by_category.map((c) => (
                            <Cell key={c.category_id} fill={c.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => brl(Number(v))}
                          wrapperStyle={{ zIndex: 10, outline: 'none' }}
                          contentStyle={{ borderRadius: 8, background: 'var(--color-panel)', border: '1px solid var(--color-line-strong)', fontSize: 13 }}
                          itemStyle={{ color: 'var(--color-ink)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="w-full min-w-0 flex-1 space-y-2.5">
                    {d.spent_by_category.map((c) => (
                      <li key={c.category_id} className="flex items-center gap-2 text-sm">
                        <Dot color={c.color} />
                        <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
                        <span className="tabular w-9 text-right text-xs text-muted">{share(c.spent_cents)}</span>
                        <span className="tabular min-w-[5.25rem] text-right font-medium text-ink">{brl(c.spent_cents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Empty icon={ChartDonutIcon}>Nenhum gasto neste mês ainda.</Empty>
              )}
            </Card>

            <Card>
              <SectionTitle aside={<MoreLink to="/cartoes">Ver cartões</MoreLink>}>Faturas a pagar</SectionTitle>
              {d.pending_invoices.length ? (
                <>
                  <ul className="divide-y divide-line">
                    {d.pending_invoices.slice(0, 6).map((inv) => {
                      const overdue = isOverdue(inv);
                      return (
                        <li key={`${inv.card_id}-${inv.invoice_month}`} className="flex items-center gap-3 py-2.5 first:pt-0">
                          <IconTile icon={CreditCardIcon} color={inv.card_color} />
                          <span className="min-w-0 flex-1">
                            {/* em tela estreita o selo desce de linha, para o nome do cartão não ser cortado */}
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="max-w-full truncate text-sm font-medium text-ink">{inv.card_name}</span>
                              {overdue && (
                                <Badge tone="red" icon={WarningCircleIcon}>
                                  Vencida
                                </Badge>
                              )}
                            </span>
                            <span className="block text-xs text-muted">
                              Fatura {monthShort(inv.invoice_month)} · {overdue ? 'venceu' : 'vence'} {formatDate(inv.due_date)}
                            </span>
                          </span>
                          <span className="text-sm">
                            <Amount text={brl(inv.remaining_cents)} tone="expense" />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {d.pending_invoices.length > 6 && (
                    <p className="mt-2 text-xs text-muted">
                      E mais {d.pending_invoices.length - 6} fatura(s)
                      {d.pending_invoices.slice(6).some(isOverdue) ? ', incluindo vencidas.' : ' futuras.'}
                    </p>
                  )}
                </>
              ) : (
                <Empty icon={CheckCircleIcon}>Nenhuma fatura em aberto.</Empty>
              )}
            </Card>
          </div>

          <Card>
            <SectionTitle aside={<MoreLink to="/caixinhas">Ver caixinhas</MoreLink>}>Caixinhas</SectionTitle>
            {d.goals.length ? (
              <ul className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                {d.goals.map((g) => (
                  <li key={g.id} className="flex items-start gap-3">
                    <IconTile icon={PiggyBankIcon} color={g.color} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-ink">{g.name}</span>
                        <span className="tabular text-xs text-muted">{g.percent}%</span>
                      </div>
                      <p className="tabular mb-2 text-xs text-muted">
                        {brl(g.saved_cents)} de {brl(g.target_cents)}
                      </p>
                      <ProgressBar percent={g.percent} color={g.color} label={`Caixinha ${g.name}`} />
                      {g.pace.per_month_cents !== null && !g.pace.reached && (
                        <p className="mt-1.5 text-xs text-muted">Guarde {brl(g.pace.per_month_cents)}/mês para chegar no prazo.</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={PiggyBankIcon}>
                Crie uma caixinha para um objetivo:{' '}
                <Link to="/caixinhas" className="text-link">
                  nova caixinha
                </Link>
                .
              </Empty>
            )}
          </Card>
        </div>
      )}

      {formOpen && <EntryForm onClose={() => setFormOpen(false)} />}
    </>
  );
}

function NetWorthPart({ icon: PartIcon, label, value }: { icon: typeof BankIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/8 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-white/70">
        <PartIcon aria-hidden size={15} />
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-[0.9375rem] font-medium">{value}</dd>
    </div>
  );
}
