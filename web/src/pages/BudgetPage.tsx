import { useState, type FormEvent } from 'react';
import { currentMonth } from '../../../shared/dates';
import type { BudgetRow } from '../../../shared/types';
import { api } from '../api/client';
import { useApiMutation, useBudgets } from '../api/hooks';
import { Badge, Button, Card, Dot, Empty, ErrorBox, inputCls, MonthNav, PageHeader, ProgressBar } from '../components/ui';
import { brl, centsToInput, parseMoney } from '../lib/format';

export function BudgetPage() {
  const [month, setMonth] = useState(currentMonth());
  const budgets = useBudgets(month);

  const withLimit = budgets.data?.filter((b) => b.limit_cents !== null) ?? [];
  const totalLimit = withLimit.reduce((s, b) => s + (b.limit_cents ?? 0), 0);
  const totalSpent = withLimit.reduce((s, b) => s + b.spent_cents, 0);

  return (
    <>
      <PageHeader
        title="Orçamento"
        subtitle="Defina quanto quer gastar por mês em cada categoria. Compras no cartão contam no mês em que foram feitas (cada parcela no seu mês)."
        actions={<MonthNav month={month} onChange={setMonth} />}
      />

      <ErrorBox error={budgets.error} />

      {withLimit.length > 0 && (
        <Card className="mb-4">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-700">Total das categorias com limite</span>
            <span className="tabular text-slate-500">
              <strong className="text-slate-900">{brl(totalSpent)}</strong> de {brl(totalLimit)}
            </span>
          </div>
          <ProgressBar percent={totalLimit ? (totalSpent / totalLimit) * 100 : 0} over={totalSpent > totalLimit} />
        </Card>
      )}

      {budgets.isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : !budgets.data?.length ? (
        <Empty>Cadastre categorias de gasto para definir limites.</Empty>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {budgets.data.map((row) => (
              <BudgetItem key={`${row.category_id}-${row.limit_cents}`} row={row} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function BudgetItem({ row }: { row: BudgetRow }) {
  const [value, setValue] = useState(row.limit_cents ? centsToInput(row.limit_cents) : '');
  const [formError, setFormError] = useState('');

  const save = useApiMutation((monthly_limit_cents: number) => api.put(`/budgets/${row.category_id}`, { monthly_limit_cents }));
  const clear = useApiMutation(() => api.delete(`/budgets/${row.category_id}`));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const cents = parseMoney(value);
    if (!cents || cents <= 0) return setFormError('Informe um limite maior que zero.');
    save.mutate(cents);
  };

  const hasLimit = row.limit_cents !== null;
  return (
    <li className="px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-slate-900">
          <Dot color={row.color} />
          {row.name}
          {row.over && <Badge tone="red">estourou</Badge>}
          {!row.over && row.percent !== null && row.percent >= 80 && <Badge tone="amber">quase no limite</Badge>}
        </span>
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            aria-label={`Limite mensal de ${row.name}`}
            className={`${inputCls} w-32 tabular`}
            inputMode="decimal"
            placeholder="Limite R$"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" small variant="secondary" disabled={save.isPending}>
            {hasLimit ? 'Atualizar' : 'Definir'}
          </Button>
          {hasLimit && (
            <Button small variant="ghost" onClick={() => clear.mutate(undefined)}>
              Remover
            </Button>
          )}
        </form>
      </div>

      {hasLimit ? (
        <>
          <ProgressBar percent={row.percent ?? 0} color={row.color} over={row.over} />
          <p className="mt-1.5 flex justify-between text-xs text-slate-500">
            <span>
              Gasto <strong className="tabular text-slate-800">{brl(row.spent_cents)}</strong> de {brl(row.limit_cents!)} ({row.percent}%)
            </span>
            <span className={row.over ? 'font-medium text-rose-600' : ''}>
              {row.over ? `${brl(row.spent_cents - row.limit_cents!)} acima` : `${brl(row.limit_cents! - row.spent_cents)} restantes`}
            </span>
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-400">Sem limite definido{row.spent_cents > 0 ? ` · gasto no mês: ${brl(row.spent_cents)}` : ''}.</p>
      )}
      <ErrorBox error={formError || save.error || clear.error} />
    </li>
  );
}
