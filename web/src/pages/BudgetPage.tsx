import { useState, type FormEvent } from 'react';
import { TagIcon } from '@phosphor-icons/react';
import { currentMonth } from '../../../shared/dates';
import type { BudgetRow } from '../../../shared/types';
import { api } from '../api/client';
import { useApiMutation, useBudgets } from '../api/hooks';
import { Badge, Button, Card, Dot, Empty, ErrorBox, Loading, MoneyInput, MonthNav, PageHeader, ProgressBar } from '../components/ui';
import { brl, centsToInput, parseMoney } from '../lib/format';

export function BudgetPage() {
  const [month, setMonth] = useState(currentMonth());
  const budgets = useBudgets(month);

  const withLimit = budgets.data?.filter((b) => b.limit_cents !== null) ?? [];
  const totalLimit = withLimit.reduce((s, b) => s + (b.limit_cents ?? 0), 0);
  const totalSpent = withLimit.reduce((s, b) => s + b.spent_cents, 0);
  const totalOver = totalSpent > totalLimit;

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
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <p className="text-sm text-muted">Total das categorias com limite</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[2rem] leading-10 font-medium tracking-[-0.03em] text-ink">{brl(totalSpent)}</span>
                <span className="tabular text-sm text-muted">de {brl(totalLimit)}</span>
              </p>
            </div>
            <p className={`tabular pb-1 text-sm font-medium ${totalOver ? 'text-expense' : 'text-income'}`}>
              {totalOver ? `${brl(totalSpent - totalLimit)} acima` : `${brl(totalLimit - totalSpent)} restantes`}
            </p>
          </div>
          <ProgressBar percent={totalLimit ? (totalSpent / totalLimit) * 100 : 0} over={totalOver} label="Orçamento total" />
        </Card>
      )}

      {budgets.isLoading ? (
        <Loading />
      ) : !budgets.data?.length ? (
        <Empty icon={TagIcon}>Cadastre categorias de gasto para definir limites.</Empty>
      ) : (
        <Card flush>
          <ul className="divide-y divide-line">
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
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-medium text-ink">
            <Dot color={row.color} />
            {row.name}
            {row.over && <Badge tone="red">estourou</Badge>}
            {!row.over && row.percent !== null && row.percent >= 80 && <Badge tone="amber">quase no limite</Badge>}
          </span>
          {!hasLimit && (
            <p className="mt-0.5 text-xs text-muted">Sem limite definido{row.spent_cents > 0 ? ` · gasto no mês: ${brl(row.spent_cents)}` : ''}.</p>
          )}
        </div>
        <form onSubmit={submit} className="flex w-full items-center gap-2 sm:w-auto">
          <span className="min-w-0 flex-1 sm:w-36 sm:flex-none">
            <MoneyInput aria-label={`Limite mensal de ${row.name}`} placeholder="Limite" value={value} onChange={(e) => setValue(e.target.value)} />
          </span>
          <Button type="submit" variant="secondary" className="min-w-24" disabled={save.isPending}>
            {hasLimit ? 'Atualizar' : 'Definir'}
          </Button>
          {/* o espaço fica reservado para os campos alinharem entre as linhas */}
          <span className={`shrink-0 sm:w-24 ${hasLimit ? '' : 'hidden sm:block'}`}>
            {hasLimit && (
              <Button variant="ghost" className="w-full" onClick={() => clear.mutate(undefined)}>
                Remover
              </Button>
            )}
          </span>
        </form>
      </div>

      {hasLimit && (
        <div className="mt-3">
          <ProgressBar percent={row.percent ?? 0} color={row.color} over={row.over} label={`Orçamento de ${row.name}`} />
          <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted">
            <span>
              Gasto <strong className="tabular font-medium text-ink">{brl(row.spent_cents)}</strong> de {brl(row.limit_cents!)} ({row.percent}%)
            </span>
            <span className={`tabular ${row.over ? 'font-medium text-expense' : ''}`}>
              {row.over ? `${brl(row.spent_cents - row.limit_cents!)} acima` : `${brl(row.limit_cents! - row.spent_cents)} restantes`}
            </span>
          </p>
        </div>
      )}
      <ErrorBox error={formError || save.error || clear.error} />
    </li>
  );
}
