import { useState } from 'react';
import { currentMonth } from '../../../shared/dates';
import type { Entry, Kind } from '../../../shared/types';
import { api } from '../api/client';
import { useAccounts, useApiMutation, useCards, useCategories, useEntries, type EntryFilters } from '../api/hooks';
import { EntryForm } from '../components/EntryForm';
import { Amount, Badge, Button, Card, ConfirmButton, Dot, Empty, ErrorBox, inputCls, MonthNav, PageHeader } from '../components/ui';
import { brl, formatDay, monthShort } from '../lib/format';

export function EntriesPage() {
  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState<Kind | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [payWith, setPayWith] = useState(''); // 'account:1' | 'card:2'
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | undefined>();

  const accounts = useAccounts();
  const cards = useCards();
  const categories = useCategories();

  const [payKind, payId] = payWith.split(':');
  const filters: EntryFilters = {
    month,
    type: type || undefined,
    category_id: categoryId ? Number(categoryId) : undefined,
    account_id: payKind === 'account' ? Number(payId) : undefined,
    card_id: payKind === 'card' ? Number(payId) : undefined,
  };
  const entries = useEntries(filters);

  const remove = useApiMutation((entry: Entry) =>
    entry.kind === 'transaction' ? api.delete(`/transactions/${entry.ref_id}`) : api.delete(`/card-purchases/${entry.ref_id}`),
  );

  const income = entries.data?.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount_cents, 0) ?? 0;
  const expense = entries.data?.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount_cents, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Lançamentos"
        subtitle="Tudo o que você recebeu e gastou, na conta ou no cartão."
        actions={
          <>
            <MonthNav month={month} onChange={setMonth} />
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              + Novo lançamento
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <select className={inputCls} aria-label="Filtrar por tipo" value={type} onChange={(e) => setType(e.target.value as Kind | '')}>
          <option value="">Gastos e receitas</option>
          <option value="expense">Só gastos</option>
          <option value="income">Só receitas</option>
        </select>
        <select className={inputCls} aria-label="Filtrar por categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.kind === 'income' ? '(receita)' : ''}
            </option>
          ))}
        </select>
        <select className={inputCls} aria-label="Filtrar por conta ou cartão" value={payWith} onChange={(e) => setPayWith(e.target.value)}>
          <option value="">Todas as contas e cartões</option>
          {accounts.data?.map((a) => (
            <option key={a.id} value={`account:${a.id}`}>
              {a.name}
            </option>
          ))}
          {cards.data?.map((c) => (
            <option key={c.id} value={`card:${c.id}`}>
              💳 {c.name}
            </option>
          ))}
        </select>
      </div>

      <ErrorBox error={entries.error ?? remove.error} />

      <Card className="p-0">
        {entries.isLoading ? (
          <p className="p-6 text-sm text-slate-500">Carregando…</p>
        ) : entries.data?.length ? (
          <ul className="divide-y divide-slate-100">
            {entries.data.map((e) => (
              <li key={e.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <span className="w-12 shrink-0 text-xs text-slate-400 tabular">{formatDay(e.date)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{e.description || e.category_name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Dot color={e.category_color} />
                      {e.category_name}
                    </span>
                    <span>·</span>
                    <span>{e.kind === 'card_charge' ? `💳 ${e.card_name}` : e.account_name}</span>
                    {e.kind === 'card_charge' && (e.installments ?? 1) > 1 && (
                      <Badge tone="indigo">
                        {e.installment_no}/{e.installments}
                      </Badge>
                    )}
                    {e.kind === 'card_charge' && e.invoice_month && <Badge>fatura {monthShort(e.invoice_month)}</Badge>}
                    {e.recurring_id && <Badge tone="slate">recorrente</Badge>}
                  </p>
                </div>
                <Amount text={`${e.type === 'income' ? '+' : '−'} ${brl(e.amount_cents)}`} tone={e.type} />
                <div className="flex shrink-0 gap-1">
                  {e.kind === 'transaction' && (
                    <Button
                      small
                      variant="ghost"
                      onClick={() => {
                        setEditing(e);
                        setFormOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                  <ConfirmButton
                    label={e.kind === 'card_charge' && (e.installments ?? 1) > 1 ? 'Excluir compra' : 'Excluir'}
                    onConfirm={() => remove.mutate(e)}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <Empty>Nenhum lançamento neste mês com esses filtros.</Empty>
          </div>
        )}
      </Card>

      {!!entries.data?.length && (
        <div className="mt-4 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
          <span className="text-slate-500">
            Receitas: <Amount text={brl(income)} tone="income" />
          </span>
          <span className="text-slate-500">
            Gastos: <Amount text={brl(expense)} tone="expense" />
          </span>
          <span className="text-slate-500">
            Saldo do período: <Amount text={brl(income - expense)} tone="neutral" />
          </span>
        </div>
      )}

      {formOpen && <EntryForm editing={editing} onClose={() => setFormOpen(false)} />}
    </>
  );
}
