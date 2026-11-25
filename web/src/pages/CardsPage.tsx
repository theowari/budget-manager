import { useEffect, useState, type FormEvent } from 'react';
import { currentMonth, todayISO, type Month } from '../../../shared/dates';
import type { Card as CardT, Invoice } from '../../../shared/types';
import { api } from '../api/client';
import { useAccounts, useApiMutation, useCards, useInvoice } from '../api/hooks';
import { EntryForm } from '../components/EntryForm';
import {
  Amount, Badge, Button, Card, ColorPicker, ConfirmButton, Dot, Empty, ErrorBox, Field, inputCls, Modal, MonthNav,
  MoneyField, PageHeader, ProgressBar, SectionTitle,
} from '../components/ui';
import { brl, centsToInput, formatDate, formatDay, parseMoney } from '../lib/format';

const STATUS: Record<Invoice['status'], { label: string; tone: 'green' | 'red' | 'amber' | 'slate' }> = {
  paid: { label: 'Paga', tone: 'green' },
  overdue: { label: 'Vencida', tone: 'red' },
  open: { label: 'Em aberto', tone: 'amber' },
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
        actions={<Button onClick={() => setCardModal('new')}>+ Novo cartão</Button>}
      />

      {cards.isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : !cards.data?.length ? (
        <Empty>Você ainda não cadastrou nenhum cartão. Clique em “Novo cartão” para começar.</Empty>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {cards.data.map((c) => {
              const percent = c.limit_cents ? Math.round((c.used_cents / c.limit_cents) * 100) : 0;
              const active = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  aria-pressed={active}
                  className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${active ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-slate-900">
                      <Dot color={c.color} />
                      {c.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      fecha dia {c.closing_day} · vence dia {c.due_day}
                    </span>
                  </div>
                  <ProgressBar percent={percent} color={c.color} over={c.available_cents < 0} />
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-slate-500">
                      Usado <span className="tabular font-medium text-slate-800">{brl(c.used_cents)}</span>
                    </span>
                    <span className={c.available_cents < 0 ? 'text-rose-600' : 'text-slate-500'}>
                      Disponível <span className="tabular font-medium">{brl(c.available_cents)}</span> de {brl(c.limit_cents)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">Fatura · {selected.name}</h2>
                  {invoice.data && <Badge tone={STATUS[invoice.data.status].tone}>{STATUS[invoice.data.status].label}</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <MonthNav month={invoiceMonth} onChange={setInvoiceMonth} />
                  <Button variant="secondary" small onClick={() => setCardModal(selected)}>
                    Editar cartão
                  </Button>
                </div>
              </div>

              <ErrorBox error={invoice.error ?? removePurchase.error ?? undoPayment.error} />

              {invoice.data && (
                <>
                  <dl className="mb-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Stat label="Fecha em" value={formatDate(invoice.data.closing_date)} />
                    <Stat label="Vence em" value={formatDate(invoice.data.due_date)} />
                    <Stat label="Total da fatura" value={brl(invoice.data.total_cents)} strong />
                    <Stat label="Falta pagar" value={brl(invoice.data.remaining_cents)} strong tone={invoice.data.remaining_cents > 0 ? 'expense' : 'income'} />
                  </dl>

                  <div className="mb-5 flex flex-wrap gap-2">
                    <Button onClick={() => setPurchaseOpen(true)}>+ Compra no cartão</Button>
                    <Button variant="secondary" disabled={invoice.data.remaining_cents === 0} onClick={() => setPayOpen(true)}>
                      Pagar fatura
                    </Button>
                  </div>

                  <SectionTitle>Compras desta fatura</SectionTitle>
                  {invoice.data.items.length ? (
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {invoice.data.items.map((item) => (
                        <li key={item.charge_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                          <span className="w-12 shrink-0 text-xs text-slate-400 tabular">{formatDay(item.purchase_date)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">{item.description || item.category_name}</p>
                            <p className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Dot color={item.category_color} />
                              {item.category_name}
                              {item.installments > 1 && (
                                <Badge tone="indigo">
                                  parcela {item.installment_no}/{item.installments}
                                </Badge>
                              )}
                            </p>
                          </div>
                          <Amount text={brl(item.amount_cents)} tone="expense" />
                          <ConfirmButton label={item.installments > 1 ? 'Excluir compra' : 'Excluir'} onConfirm={() => removePurchase.mutate(item.purchase_id)} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>Nenhuma compra nesta fatura.</Empty>
                  )}

                  {invoice.data.payments.length > 0 && (
                    <div className="mt-5">
                      <SectionTitle>Pagamentos</SectionTitle>
                      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {invoice.data.payments.map((p) => (
                          <li key={p.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                            <span className="w-12 shrink-0 text-xs text-slate-400 tabular">{formatDay(p.paid_date)}</span>
                            <span className="flex-1 text-slate-600">Pago com {p.account_name}</span>
                            <Amount text={brl(p.amount_cents)} tone="neutral" />
                            <ConfirmButton label="Desfazer" onConfirm={() => undoPayment.mutate(p.id)} />
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
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5">{strong ? <Amount text={value} tone={tone ?? 'neutral'} /> : <span className="tabular text-slate-800">{value}</span>}</dd>
    </div>
  );
}

// ---- cadastro/edição de cartão ---------------------------------------------------

function CardFormModal({ card, onClose, onCreated }: { card?: CardT; onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState(card?.name ?? '');
  const [limit, setLimit] = useState(card ? centsToInput(card.limit_cents) : '');
  const [closingDay, setClosingDay] = useState(String(card?.closing_day ?? 10));
  const [dueDay, setDueDay] = useState(String(card?.due_day ?? 17));
  const [color, setColor] = useState(card?.color ?? '#7c3aed');
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
        {card && <p className="mb-3 text-xs text-slate-400">Mudar fechamento/vencimento vale para as próximas compras; as parcelas já lançadas continuam nas mesmas faturas.</p>}
        <ErrorBox error={formError || save.error || remove.error} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>{card && <ConfirmButton small={false} label="Excluir cartão" onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })} />}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Salvar
            </Button>
          </div>
        </div>
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
        <p className="mb-4 text-sm text-slate-600">
          Restante da fatura: <Amount text={brl(invoice.remaining_cents)} tone="expense" />. O pagamento sai do saldo da conta escolhida e não conta como um novo gasto
          (as compras já foram contadas nas categorias).
        </p>
        <Field label="Pagar com a conta">
          <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · saldo {brl(a.balance_cents)}
              </option>
            ))}
          </select>
        </Field>
        <MoneyField label="Valor" value={amount} onChange={setAmount} hint="Pode pagar só uma parte da fatura." autoFocus />
        <Field label="Data do pagamento">
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <ErrorBox error={formError || pay.error} />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pay.isPending}>
            Pagar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
