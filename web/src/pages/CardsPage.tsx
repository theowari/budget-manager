import { useEffect, useState, type FormEvent } from 'react';
import {
  BankIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  MoneyIcon,
  PencilSimpleIcon,
  PlusIcon,
  ReceiptIcon,
  WarningCircleIcon,
  type Icon,
} from '@phosphor-icons/react';
import { currentMonth, todayISO, type Month } from '../../../shared/dates';
import type { Card as CardT, Invoice } from '../../../shared/types';
import { api } from '../api/client';
import { useAccounts, useApiMutation, useCards, useInvoice } from '../api/hooks';
import { EntryForm } from '../components/EntryForm';
import {
  Amount, Badge, Button, Card, ColorPicker, ConfirmButton, DateTile, Dot, Empty, ErrorBox, Field, FormActions, IconTile,
  inputCls, Loading, Modal, MonthNav, MoneyField, PageHeader, ProgressBar, SectionTitle, Select,
} from '../components/ui';
import { brl, centsToInput, formatDate, parseMoney } from '../lib/format';

const STATUS: Record<Invoice['status'], { label: string; tone: 'green' | 'red' | 'amber' | 'slate'; icon?: Icon }> = {
  paid: { label: 'Paga', tone: 'green', icon: CheckCircleIcon },
  overdue: { label: 'Vencida', tone: 'red', icon: WarningCircleIcon },
  open: { label: 'Em aberto', tone: 'amber', icon: ClockIcon },
  empty: { label: 'Sem compras', tone: 'slate' },
};

export function CardsPage() {
  const cards = useCards();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState<Month>(currentMonth());
  const [cardModal, setCardModal] = useState<CardT | 'new' | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const selected = cards.data?.find((c) => c.id === selectedId) ?? cards.data?.[0] ?? null;

  // ao trocar de cartão, abre na fatura que está recebendo compras hoje
  useEffect(() => {
    if (selected) setInvoiceMonth(selected.current_invoice_month);
  }, [selected?.id]);

  const invoice = useInvoice(selected?.id ?? null, invoiceMonth);
  const removePurchase = useApiMutation((purchaseId: number) => api.delete(`/card-purchases/${purchaseId}`));
  const undoPayment = useApiMutation((paymentId: number) => api.delete(`/cards/payments/${paymentId}`));

  return (
    <>
      <PageHeader
        title="Cartões de crédito"
        subtitle="Faturas por mês, parcelas e limite de cada cartão."
        actions={
          <Button icon={PlusIcon} onClick={() => setCardModal('new')}>
            Novo cartão
          </Button>
        }
      />

      {cards.isLoading ? (
        <Loading />
      ) : !cards.data?.length ? (
        <Empty icon={CreditCardIcon}>Você ainda não cadastrou nenhum cartão. Clique em “Novo cartão” para começar.</Empty>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cards.data.map((c) => {
              const percent = c.limit_cents ? Math.round((c.used_cents / c.limit_cents) * 100) : 0;
              const active = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  aria-pressed={active}
                  className={`card card-pad lift text-left ${active ? '!border-accent shadow-[0_0_0_1px_var(--color-accent)]' : ''}`}
                >
                  <span className="flex items-center gap-3">
                    <IconTile icon={CreditCardIcon} color={c.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{c.name}</span>
                      <span className="block text-xs text-muted">
                        fecha dia {c.closing_day} · vence dia {c.due_day}
                      </span>
                    </span>
                    {active && <CheckCircleIcon aria-hidden size={22} weight="fill" className="shrink-0 text-accent" />}
                  </span>

                  <span className="mt-4 block text-xs text-muted">Disponível</span>
                  <span className="mb-3 flex flex-wrap items-baseline gap-x-2">
                    <span className={`text-2xl leading-8 font-medium tracking-[-0.025em] ${c.available_cents < 0 ? 'text-expense' : 'text-ink'}`}>
                      {brl(c.available_cents)}
                    </span>
                    <span className="tabular text-sm text-muted">de {brl(c.limit_cents)}</span>
                  </span>

                  <ProgressBar percent={percent} color={c.color} over={c.available_cents < 0} label={`Limite usado de ${c.name}`} />
                  <span className="mt-2 flex justify-between gap-2 text-xs text-muted">
                    <span>
                      Usado <span className="tabular font-medium text-ink">{brl(c.used_cents)}</span>
                    </span>
                    <span className="tabular">{percent}% do limite</span>
                  </span>
                </button>
              );
            })}
          </div>

          {selected && (
            <Card>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="flex items-center gap-2 text-lg font-medium tracking-[-0.015em]">
                    <Dot color={selected.color} />
                    Fatura · {selected.name}
                  </h2>
                  {invoice.data && (
                    <Badge tone={STATUS[invoice.data.status].tone} icon={STATUS[invoice.data.status].icon}>
                      {STATUS[invoice.data.status].label}
                    </Badge>
                  )}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <MonthNav month={invoiceMonth} onChange={setInvoiceMonth} />
                  <Button variant="secondary" icon={PencilSimpleIcon} className="grow sm:grow-0" onClick={() => setCardModal(selected)}>
                    Editar cartão
                  </Button>
                </div>
              </div>

              <ErrorBox error={invoice.error ?? removePurchase.error ?? undoPayment.error} />

              {invoice.data && (
                <>
                  <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl bg-surface p-4 sm:grid-cols-4">
                    <Stat label="Fecha em" value={formatDate(invoice.data.closing_date)} />
                    <Stat label="Vence em" value={formatDate(invoice.data.due_date)} />
                    <Stat label="Total da fatura" value={brl(invoice.data.total_cents)} strong />
                    <Stat label="Falta pagar" value={brl(invoice.data.remaining_cents)} strong tone={invoice.data.remaining_cents > 0 ? 'expense' : 'income'} />
                  </dl>

                  <div className="mb-6 flex flex-wrap gap-2 [&>.btn]:grow sm:[&>.btn]:grow-0">
                    <Button icon={PlusIcon} onClick={() => setPurchaseOpen(true)}>
                      Compra no cartão
                    </Button>
                    <Button variant="secondary" icon={MoneyIcon} disabled={invoice.data.remaining_cents === 0} onClick={() => setPayOpen(true)}>
                      Pagar fatura
                    </Button>
                  </div>

                  <SectionTitle>Compras desta fatura</SectionTitle>
                  {invoice.data.items.length ? (
                    <ul className="divide-y divide-line rounded-xl border border-line">
                      {invoice.data.items.map((item) => (
                        <li key={item.charge_id} className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4">
                          <DateTile date={item.purchase_date} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.9375rem] font-medium text-ink">{item.description || item.category_name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                              <span className="inline-flex items-center gap-1.5">
                                <Dot color={item.category_color} />
                                {item.category_name}
                              </span>
                              {item.installments > 1 && (
                                <Badge tone="blue">
                                  parcela {item.installment_no}/{item.installments}
                                </Badge>
                              )}
                              {item.subscription_id !== null && <Badge>assinatura</Badge>}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                            <Amount text={brl(item.amount_cents)} tone="expense" />
                            <ConfirmButton
                              iconOnly
                              label={item.installments > 1 ? 'Excluir compra' : item.subscription_id !== null ? 'Excluir cobrança' : 'Excluir'}
                              onConfirm={() => removePurchase.mutate(item.purchase_id)}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty icon={ReceiptIcon}>Nenhuma compra nesta fatura.</Empty>
                  )}

                  {invoice.data.payments.length > 0 && (
                    <div className="mt-6">
                      <SectionTitle>Pagamentos</SectionTitle>
                      <ul className="divide-y divide-line rounded-xl border border-line">
                        {invoice.data.payments.map((p) => (
                          <li key={p.id} className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4">
                            <DateTile date={p.paid_date} />
                            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-ink-2">
                              <BankIcon aria-hidden size={16} className="shrink-0 text-muted" />
                              <span className="truncate">Pago com {p.account_name}</span>
                            </span>
                            <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                              <Amount text={brl(p.amount_cents)} tone="neutral" />
                              <ConfirmButton label="Desfazer" onConfirm={() => undoPayment.mutate(p.id)} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}

      {cardModal && <CardFormModal card={cardModal === 'new' ? undefined : cardModal} onClose={() => setCardModal(null)} onCreated={setSelectedId} />}
      {purchaseOpen && selected && <EntryForm defaultPayWith={`card:${selected.id}`} onClose={() => setPurchaseOpen(false)} />}
      {payOpen && invoice.data && selected && <PayInvoiceModal cardId={selected.id} invoice={invoice.data} onClose={() => setPayOpen(false)} />}
    </>
  );
}

function Stat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'income' | 'expense' }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 ${strong ? 'text-lg' : 'text-[0.9375rem]'}`}>
        {strong ? <Amount text={value} tone={tone ?? 'neutral'} /> : <span className="tabular text-ink">{value}</span>}
      </dd>
    </div>
  );
}

// ---- cadastro/edição de cartão ---------------------------------------------------

function CardFormModal({ card, onClose, onCreated }: { card?: CardT; onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState(card?.name ?? '');
  const [limit, setLimit] = useState(card ? centsToInput(card.limit_cents) : '');
  const [closingDay, setClosingDay] = useState(String(card?.closing_day ?? 10));
  const [dueDay, setDueDay] = useState(String(card?.due_day ?? 17));
  const [color, setColor] = useState(card?.color ?? '#8b5cf6');
  const [formError, setFormError] = useState('');

  const save = useApiMutation((body: object) => (card ? api.put<CardT>(`/cards/${card.id}`, body) : api.post<CardT>('/cards', body)));
  const remove = useApiMutation(() => api.delete(`/cards/${card!.id}`));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const limit_cents = parseMoney(limit);
    const closing_day = Number(closingDay);
    const due_day = Number(dueDay);
    if (!name.trim()) return setFormError('Informe o nome do cartão.');
    if (limit_cents === null || limit_cents < 0) return setFormError('Informe o limite do cartão.');
    if (![closing_day, due_day].every((d) => Number.isInteger(d) && d >= 1 && d <= 31)) return setFormError('Os dias devem estar entre 1 e 31.');
    save.mutate(
      { name: name.trim(), limit_cents, closing_day, due_day, color },
      {
        onSuccess: (saved) => {
          onCreated(saved.id);
          onClose();
        },
      },
    );
  };

  return (
    <Modal title={card ? 'Editar cartão' : 'Novo cartão'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nome">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Itaú Platinum" autoFocus />
        </Field>
        <MoneyField label="Limite" value={limit} onChange={setLimit} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia de fechamento" hint="Compras até este dia entram na fatura do mês.">
            <input className={inputCls} type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
          </Field>
          <Field label="Dia de vencimento">
            <input className={inputCls} type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
          </Field>
        </div>
        <ColorPicker value={color} onChange={setColor} />
        {card && <p className="mb-3 text-xs text-muted">Mudar fechamento/vencimento vale para as próximas compras; as parcelas já lançadas continuam nas mesmas faturas.</p>}
        <ErrorBox error={formError || save.error || remove.error} />
        <FormActions danger={card && <ConfirmButton small={false} label="Excluir cartão" onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })} />}>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Salvar
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}

// ---- pagar fatura ---------------------------------------------------------------------

function PayInvoiceModal({ cardId, invoice, onClose }: { cardId: number; invoice: Invoice; onClose: () => void }) {
  const accounts = useAccounts();
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState(centsToInput(invoice.remaining_cents));
  const [date, setDate] = useState(todayISO());
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!accountId && accounts.data?.[0]) setAccountId(String(accounts.data[0].id));
  }, [accounts.data, accountId]);

  const pay = useApiMutation((body: object) => api.post(`/cards/${cardId}/invoice/pay`, body));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const amount_cents = parseMoney(amount);
    if (!amount_cents || amount_cents <= 0) return setFormError('Informe o valor a pagar.');
    if (amount_cents > invoice.remaining_cents) return setFormError(`O valor máximo é ${brl(invoice.remaining_cents)}.`);
    pay.mutate({ month: invoice.month, account_id: Number(accountId), amount_cents, date }, { onSuccess: onClose });
  };

  return (
    <Modal title={`Pagar fatura · ${invoice.card_name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="mb-5 rounded-xl bg-surface px-4 py-3 text-sm leading-6">
          Restante da fatura: <Amount text={brl(invoice.remaining_cents)} tone="expense" />. O pagamento sai do saldo da conta escolhida e não conta como um novo gasto
          (as compras já foram contadas nas categorias).
        </p>
        <Field label="Pagar com a conta">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · saldo {brl(a.balance_cents)}
              </option>
            ))}
          </Select>
        </Field>
        <MoneyField label="Valor" value={amount} onChange={setAmount} hint="Pode pagar só uma parte da fatura." autoFocus />
        <Field label="Data do pagamento">
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <ErrorBox error={formError || pay.error} />
        <FormActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pay.isPending}>
            Pagar
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
