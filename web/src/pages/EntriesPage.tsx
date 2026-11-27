import { useState, type ReactNode } from 'react';
import { BankIcon, CreditCardIcon, PencilSimpleIcon, PlusIcon, ReceiptIcon } from '@phosphor-icons/react';
import { currentMonth } from '../../../shared/dates';
import type { Entry, Kind } from '../../../shared/types';
import { api } from '../api/client';
import { useAccounts, useApiMutation, useCards, useCategories, useEntries, type EntryFilters } from '../api/hooks';
import { EntryForm } from '../components/EntryForm';
import {
  Amount, Badge, Button, Card, ConfirmButton, DateTile, Dot, Empty, ErrorBox, IconButton, Loading, MonthNav, PageHeader,
  Segmented, Select,
} from '../components/ui';
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
              icon={PlusIcon}
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              Novo lançamento
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr]">
        <Segmented<Kind | ''>
          label="Filtrar por tipo"
          className="sm:col-span-2 lg:col-span-1"
          value={type}
          onChange={setType}
          options={[
            { value: '', label: 'Tudo' },
            { value: 'expense', label: 'Gastos', tone: 'expense' },
            { value: 'income', label: 'Receitas', tone: 'income' },
          ]}
        />
        <Select aria-label="Filtrar por categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.kind === 'income' ? '(receita)' : ''}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrar por conta ou cartão" value={payWith} onChange={(e) => setPayWith(e.target.value)}>
          <option value="">Todas as contas e cartões</option>
          <optgroup label="Contas">
            {accounts.data?.map((a) => (
              <option key={a.id} value={`account:${a.id}`}>
                {a.name}
              </option>
            ))}
          </optgroup>
          {(cards.data?.length ?? 0) > 0 && (
            <optgroup label="Cartões de crédito">
              {cards.data?.map((c) => (
                <option key={c.id} value={`card:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      </div>

      <ErrorBox error={entries.error ?? remove.error} />

      <Card flush>
        {entries.isLoading ? (
          <Loading />
        ) : entries.data?.length ? (
          <ul className="divide-y divide-line">
            {entries.data.map((e) => {
              const onCard = e.kind === 'card_charge';
              const PayIcon = onCard ? CreditCardIcon : BankIcon;
              return (
                <li key={e.key} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface/60 sm:gap-4 sm:px-5">
                  {/* no celular a data vai para a linha de detalhes, para o texto ter espaço */}
                  <span className="max-sm:hidden">
                    <DateTile date={e.date} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium text-ink">{e.description || e.category_name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="tabular sm:hidden">{formatDay(e.date)}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Dot color={e.category_color} />
                        {e.category_name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <PayIcon aria-hidden size={14} />
                        {onCard ? e.card_name : e.account_name}
                      </span>
                      {onCard && (e.installments ?? 1) > 1 && (
                        <Badge tone="blue">
                          parcela {e.installment_no}/{e.installments}
                        </Badge>
                      )}
                      {onCard && e.invoice_month && <Badge>fatura {monthShort(e.invoice_month)}</Badge>}
                      {e.recurring_id && <Badge>recorrente</Badge>}
                      {e.subscription_id !== null && <Badge>assinatura</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <span className="text-[0.9375rem]">
                      <Amount text={`${e.type === 'income' ? '+' : '−'} ${brl(e.amount_cents)}`} tone={e.type} />
                    </span>
                    <div className="flex min-w-[4.75rem] justify-end gap-1 pointer-coarse:min-w-[5.75rem]">
                      {e.kind === 'transaction' && (
                        <IconButton
                          label="Editar"
                          icon={PencilSimpleIcon}
                          onClick={() => {
                            setEditing(e);
                            setFormOpen(true);
                          }}
                        />
                      )}
                      <ConfirmButton
                        iconOnly
                        label={
                          onCard && (e.installments ?? 1) > 1
                            ? 'Excluir compra'
                            : e.subscription_id !== null
                              ? 'Excluir cobrança'
                              : 'Excluir'
                        }
                        onConfirm={() => remove.mutate(e)}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-5">
            <Empty icon={ReceiptIcon}>Nenhum lançamento neste mês com esses filtros.</Empty>
          </div>
        )}
      </Card>

      {!!entries.data?.length && (
        <Card flush className="mt-4">
          <dl className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Total label="Receitas" value={<Amount text={brl(income)} tone="income" />} />
            <Total label="Gastos" value={<Amount text={brl(expense)} tone="expense" />} />
            <Total label="Saldo do período" value={<Amount text={brl(income - expense)} tone="neutral" />} />
          </dl>
        </Card>
      )}

      {formOpen && <EntryForm editing={editing} onClose={() => setFormOpen(false)} />}
    </>
  );
}

function Total({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 sm:block sm:py-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-lg sm:mt-0.5">{value}</dd>
    </div>
  );
}
