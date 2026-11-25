import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useProjection } from '../api/hooks';
import { Amount, Card, ErrorBox, inputCls, PageHeader } from '../components/ui';
import { brl, capitalize, monthLabel, monthShort } from '../lib/format';

export function ProjectionPage() {
  const [months, setMonths] = useState(12);
  const projection = useProjection(months);
  const data = projection.data;

  return (
    <>
      <PageHeader
        title="Projeção de saldo"
        subtitle="Estimativa do saldo das suas contas mês a mês, com base no que já está cadastrado: recorrências (salário, aluguel…), faturas de cartão, incluindo parcelas futuras, e as próximas cobranças das assinaturas."
        actions={
          <select className={`${inputCls} w-auto`} aria-label="Período da projeção" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[6, 12, 24, 36].map((m) => (
              <option key={m} value={m}>
                Próximos {m} meses
              </option>
            ))}
          </select>
        }
      />

      <ErrorBox error={projection.error} />
      {projection.isLoading && <p className="text-sm text-slate-500">Carregando…</p>}

      {data && (
        <>
          {data.first_negative_month ? (
            <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              ⚠️ Pelo que está cadastrado, seu saldo fica <strong>negativo em {monthLabel(data.first_negative_month)}</strong> (mínimo de {brl(data.lowest_balance_cents)}). Revise gastos ou
              adie compras parceladas.
            </p>
          ) : (
            <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              ✅ Seu saldo se mantém positivo em todo o período. O menor saldo projetado é {brl(data.lowest_balance_cents)}.
            </p>
          )}

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-slate-500">Saldo hoje (contas)</p>
              <Amount text={brl(data.start_balance_cents)} tone="neutral" />
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Saldo em {monthShort(data.months.at(-1)!.month)}</p>
              <Amount text={brl(data.months.at(-1)!.balance_cents)} tone={data.months.at(-1)!.balance_cents < 0 ? 'expense' : 'income'} />
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Menor saldo no período</p>
              <Amount text={brl(data.lowest_balance_cents)} tone={data.lowest_balance_cents < 0 ? 'expense' : 'neutral'} />
            </Card>
          </div>

          <Card className="mb-4">
            <div className="h-72 w-full" aria-label="Gráfico do saldo projetado">
              <ResponsiveContainer>
                <LineChart data={data.months.map((m) => ({ ...m, label: monthShort(m.month), value: m.balance_cents / 100 }))} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={72} tickFormatter={(v: number) => brl(v * 100).replace(',00', '')} />
                  <Tooltip formatter={(v) => [brl(Number(v) * 100), 'Saldo']} labelClassName="font-medium" />
                  <ReferenceLine y={0} stroke="#e11d48" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Mês</th>
                  <th className="px-3 py-3 text-right font-medium">Receitas fixas</th>
                  <th className="px-3 py-3 text-right font-medium">Gastos fixos</th>
                  <th className="px-3 py-3 text-right font-medium">Faturas</th>
                  <th className="px-3 py-3 text-right font-medium">Variação</th>
                  <th className="px-5 py-3 text-right font-medium">Saldo final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.months.map((m) => (
                  <tr key={m.month} className={m.balance_cents < 0 ? 'bg-rose-50/60' : ''}>
                    <td className="px-5 py-2.5 font-medium text-slate-800">{capitalize(monthLabel(m.month))}</td>
                    <td className="px-3 py-2.5 text-right tabular text-emerald-600">{m.income_cents ? brl(m.income_cents) : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular text-rose-600">{m.expense_cents ? brl(m.expense_cents) : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular text-rose-600">{m.invoices_cents ? brl(m.invoices_cents) : '—'}</td>
                    <td className={`px-3 py-2.5 text-right tabular ${m.net_cents < 0 ? 'text-rose-600' : 'text-slate-600'}`}>{brl(m.net_cents)}</td>
                    <td className={`px-5 py-2.5 text-right tabular font-semibold ${m.balance_cents < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{brl(m.balance_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs text-slate-400">
            A projeção não inclui gastos variáveis do dia a dia (mercado, lazer…) que ainda não foram lançados. Cadastre recorrências em “Cadastros” para deixá-la mais fiel.
          </p>
        </>
      )}
    </>
  );
}
