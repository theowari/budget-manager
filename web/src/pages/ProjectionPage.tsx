import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BankIcon, CalendarCheckIcon, TrendDownIcon } from '@phosphor-icons/react';
import { useProjection } from '../api/hooks';
import { BigAmount, Callout, Card, ErrorBox, Loading, Note, PageHeader, SectionTitle, Select, StatCard } from '../components/ui';
import { brl, capitalize, monthAbbr, monthLabel, monthShort } from '../lib/format';

/** Rótulos curtos do eixo: "R$ 15 mil". */
const AXIS_FMT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

const AXIS_TICK = { fontSize: 13, fill: 'var(--color-muted)' };

export function ProjectionPage() {
  const [months, setMonths] = useState(12);
  const projection = useProjection(months);
  const data = projection.data;
  const last = data?.months.at(-1);
  // com muitos meses os pontos se amontoam: fica só a linha (o ponto aparece ao passar o mouse)
  const showDots = (data?.months.length ?? 0) <= 12;

  return (
    <>
      <PageHeader
        title="Projeção de saldo"
        subtitle="Estimativa do saldo das suas contas mês a mês, com base no que já está cadastrado: recorrências (salário, aluguel…), faturas de cartão, incluindo parcelas futuras, e as próximas cobranças das assinaturas."
        actions={
          <Select
            wrapperClassName="w-full sm:w-52"
            aria-label="Período da projeção"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            {[6, 12, 24, 36].map((m) => (
              <option key={m} value={m}>
                Próximos {m} meses
              </option>
            ))}
          </Select>
        }
      />

      <ErrorBox error={projection.error} />
      {projection.isLoading && <Loading />}

      {data && last && (
        <>
          {data.first_negative_month ? (
            <Callout tone="danger" role="alert" className="mb-4">
              Pelo que está cadastrado, seu saldo fica <strong className="font-medium">negativo em {monthLabel(data.first_negative_month)}</strong> (mínimo de{' '}
              {brl(data.lowest_balance_cents)}). Revise gastos ou adie compras parceladas.
            </Callout>
          ) : (
            <Callout tone="success" className="mb-4">
              Seu saldo se mantém positivo em todo o período. O menor saldo projetado é {brl(data.lowest_balance_cents)}.
            </Callout>
          )}

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Saldo hoje (contas)" icon={BankIcon} tone="accent">
              <BigAmount text={brl(data.start_balance_cents)} />
            </StatCard>
            <StatCard label={`Saldo em ${monthShort(last.month)}`} icon={CalendarCheckIcon} tone={last.balance_cents < 0 ? 'expense' : 'income'}>
              <BigAmount text={brl(last.balance_cents)} tone={last.balance_cents < 0 ? 'expense' : 'income'} />
            </StatCard>
            <StatCard label="Menor saldo no período" icon={TrendDownIcon} tone={data.lowest_balance_cents < 0 ? 'expense' : 'neutral'}>
              <BigAmount text={brl(data.lowest_balance_cents)} tone={data.lowest_balance_cents < 0 ? 'expense' : 'neutral'} />
            </StatCard>
          </div>

          <Card className="mb-4">
            <SectionTitle>Saldo mês a mês</SectionTitle>
            <div className="h-72 w-full" role="img" aria-label="Gráfico do saldo projetado; os mesmos valores estão na tabela abaixo">
              <ResponsiveContainer>
                <AreaChart data={data.months.map((m) => ({ label: `${monthAbbr(m.month)}/${m.month.slice(2, 4)}`, value: m.balance_cents / 100 }))} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-track)" />
                  <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--color-line-strong)' }} minTickGap={16} tickMargin={8} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={76} tickFormatter={(v: number) => AXIS_FMT.format(v)} />
                  <Tooltip
                    formatter={(v) => [brl(Math.round(Number(v) * 100)), 'Saldo']}
                    cursor={{ stroke: 'var(--color-line-strong)' }}
                    contentStyle={{ borderRadius: 8, background: 'var(--color-panel)', border: '1px solid var(--color-line-strong)', fontSize: 13 }}
                    labelStyle={{ color: 'var(--color-ink)', fontWeight: 500 }}
                    itemStyle={{ color: 'var(--color-ink-2)' }}
                  />
                  <ReferenceLine y={0} stroke="var(--color-expense)" strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    fill="var(--color-accent)"
                    fillOpacity={0.1}
                    dot={showDots ? { r: 4, fill: 'var(--color-accent)', fillOpacity: 1, stroke: 'var(--color-panel)', strokeWidth: 2 } : false}
                    activeDot={{ r: 6, fill: 'var(--color-accent)', stroke: 'var(--color-panel)', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card flush>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela da projeção">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface text-left text-xs text-muted">
                    <th className="sticky left-0 bg-surface px-4 py-3 font-medium sm:px-5">Mês</th>
                    <th className="px-3 py-3 text-right font-medium">Receitas fixas</th>
                    <th className="px-3 py-3 text-right font-medium">Gastos fixos</th>
                    <th className="px-3 py-3 text-right font-medium">Faturas</th>
                    <th className="px-3 py-3 text-right font-medium">Variação</th>
                    <th className="px-4 py-3 text-right font-medium sm:px-5">Saldo final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.months.map((m) => {
                    const negative = m.balance_cents < 0;
                    return (
                      <tr key={m.month} className={negative ? 'bg-expense-soft' : ''}>
                        <th
                          scope="row"
                          className={`sticky left-0 px-4 py-3 text-left font-medium whitespace-nowrap text-ink sm:px-5 ${negative ? 'bg-expense-soft' : 'bg-panel'}`}
                        >
                          {capitalize(monthLabel(m.month))}
                        </th>
                        <td className="tabular px-3 py-3 text-right text-income">{m.income_cents ? brl(m.income_cents) : '—'}</td>
                        <td className="tabular px-3 py-3 text-right text-expense">{m.expense_cents ? brl(m.expense_cents) : '—'}</td>
                        <td className="tabular px-3 py-3 text-right text-expense">{m.invoices_cents ? brl(m.invoices_cents) : '—'}</td>
                        <td className={`tabular px-3 py-3 text-right ${m.net_cents < 0 ? 'text-expense' : 'text-ink-2'}`}>{brl(m.net_cents)}</td>
                        <td className={`tabular px-4 py-3 text-right font-medium sm:px-5 ${negative ? 'text-expense' : 'text-ink'}`}>{brl(m.balance_cents)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Note>
            A projeção não inclui gastos variáveis do dia a dia (mercado, lazer…) que ainda não foram lançados. Cadastre recorrências em “Cadastros” para deixá-la mais fiel.
          </Note>
        </>
      )}
    </>
  );
}
