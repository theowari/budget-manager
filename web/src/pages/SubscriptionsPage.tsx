import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { currentMonth } from '../../../shared/dates';
import type { Subscription } from '../../../shared/types';
import { api } from '../api/client';
import { useApiMutation, useCards, useCategories, useSubscriptions } from '../api/hooks';
import { Amount, Badge, Button, Card, ConfirmButton, Dot, Empty, ErrorBox, Field, inputCls, Modal, MoneyField, PageHeader, SectionTitle } from '../components/ui';
import { brl, centsToInput, formatDate, monthLabel, parseMoney } from '../lib/format';

export function SubscriptionsPage() {
  const subs = useSubscriptions();
  const cards = useCards();
  const [editing, setEditing] = useState<Subscription | 'new' | null>(null);

  const cancel = useApiMutation((id: number) => api.post(`/subscriptions/${id}/cancel`));
  const reactivate = useApiMutation((id: number) => api.post(`/subscriptions/${id}/reactivate`));

  // ativa = ainda tem próxima cobrança; as mais próximas primeiro
  const { active, ended } = useMemo(() => {
    const list = subs.data ?? [];
    return {
      active: list.filter((s) => s.next_charge_date).sort((a, b) => a.next_charge_date!.localeCompare(b.next_charge_date!)),
      ended: list.filter((s) => !s.next_charge_date),
    };
  }, [subs.data]);

  const monthly = active.reduce((sum, s) => sum + s.amount_cents, 0);
  const hasCards = (cards.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Assinaturas"
        subtitle="Serviços cobrados todo mês no cartão, sem número de parcelas: Spotify, YouTube Premium, Discord… A cobrança continua até você cancelar."
        actions={
          <Button onClick={() => setEditing('new')} disabled={!hasCards}>
            + Nova assinatura
          </Button>
        }
      />

      <ErrorBox error={subs.error ?? cancel.error ?? reactivate.error} />
      {subs.isLoading && <p className="text-sm text-slate-500">Carregando…</p>}

      {!subs.isLoading && !hasCards && (
        <Empty>
          Assinaturas são cobradas num cartão. <Link to="/cartoes" className="font-medium text-indigo-600 hover:underline">Cadastre um cartão</Link> para começar.
        </Empty>
      )}

      {subs.data && hasCards && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Custo por mês</p>
              <p className="mt-1 text-xl">
                <Amount text={brl(monthly)} tone="expense" />
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Custo em 12 meses</p>
              <p className="mt-1 text-xl">
                <Amount text={brl(monthly * 12)} tone="expense" />
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Assinaturas ativas</p>
              <p className="mt-1 text-xl font-semibold tabular text-slate-900">{active.length}</p>
            </Card>
          </div>

          <SectionTitle>Ativas</SectionTitle>
          {active.length ? (
            <Card className="p-0">
              <ul className="divide-y divide-slate-100">
                {active.map((s) => (
                  <SubscriptionRow
                    key={s.id}
                    sub={s}
                    onEdit={() => setEditing(s)}
                    action={<ConfirmButton label="Cancelar assinatura" onConfirm={() => cancel.mutate(s.id)} />}
                  />
                ))}
              </ul>
            </Card>
          ) : (
            <Empty>Nenhuma assinatura ativa. Adicione seus serviços (Spotify, YouTube Premium, Discord…) para ver quanto eles custam por mês.</Empty>
          )}

          {ended.length > 0 && (
            <div className="mt-6">
              <SectionTitle>Canceladas</SectionTitle>
              <Card className="p-0">
                <ul className="divide-y divide-slate-100">
                  {ended.map((s) => (
                    <SubscriptionRow
                      key={s.id}
                      sub={s}
                      muted
                      onEdit={() => setEditing(s)}
                      action={
                        <Button small variant="secondary" disabled={reactivate.isPending} onClick={() => reactivate.mutate(s.id)}>
                          Reativar
                        </Button>
                      }
                    />
                  ))}
                </ul>
              </Card>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400">
            No dia da cobrança, cada assinatura entra como uma compra à vista na fatura do cartão (e no limite, no orçamento e nos lançamentos). Cancelar mantém o histórico e pode ser
            desfeito; a projeção de saldo já considera as próximas cobranças.
          </p>
        </>
      )}

      {editing && <SubscriptionModal subscription={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SubscriptionRow({ sub, onEdit, action, muted }: { sub: Subscription; onEdit: () => void; action: ReactNode; muted?: boolean }) {
  // numa assinatura cancelada, end_month é o último mês cobrado (se chegou a cobrar)
  const hadCharges = sub.end_month !== null && sub.end_month >= sub.start_month;
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 ${muted ? 'bg-slate-50/60' : ''}`}>
      <span className="w-14 shrink-0 text-xs text-slate-400">dia {sub.day_of_month}</span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${muted ? 'text-slate-500' : 'text-slate-900'}`}>{sub.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Dot color={sub.category_color} />
            {sub.category_name}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Dot color={sub.card_color} />
            {sub.card_name}
          </span>
          {sub.next_charge_date ? (
            <>
              <span>·</span>
              <span>próxima cobrança {formatDate(sub.next_charge_date)}</span>
              {sub.end_month && <Badge>até {monthLabel(sub.end_month)}</Badge>}
            </>
          ) : (
            <>
              <Badge tone="slate">cancelada</Badge>
              {hadCharges && <span>última cobrança em {monthLabel(sub.end_month!)}</span>}
            </>
          )}
        </p>
      </div>
      <div className="text-right">
        <Amount text={brl(sub.amount_cents)} tone={muted ? 'neutral' : 'expense'} />
        <span className="ml-1 text-xs text-slate-400">/mês</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button small variant="ghost" onClick={onEdit}>
          Editar
        </Button>
        {action}
      </div>
    </li>
  );
}

// ---- cadastro/edição ---------------------------------------------------------------

function SubscriptionModal({ subscription, onClose }: { subscription?: Subscription; onClose: () => void }) {
  const cards = useCards();
  const categories = useCategories('expense');
  const [name, setName] = useState(subscription?.name ?? '');
  const [amount, setAmount] = useState(subscription ? centsToInput(subscription.amount_cents) : '');
  const [day, setDay] = useState(String(subscription?.day_of_month ?? 5));
  const [cardId, setCardId] = useState(subscription ? String(subscription.card_id) : '');
  const [categoryId, setCategoryId] = useState(subscription ? String(subscription.category_id) : '');
  const [startMonth, setStartMonth] = useState(subscription?.start_month ?? currentMonth());
  const [endMonth, setEndMonth] = useState(subscription?.end_month ?? '');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!cardId && cards.data?.[0]) setCardId(String(cards.data[0].id));
  }, [cards.data, cardId]);

  const save = useApiMutation((body: object) => (subscription ? api.put(`/subscriptions/${subscription.id}`, body) : api.post('/subscriptions', body)));
  const remove = useApiMutation(() => api.delete(`/subscriptions/${subscription!.id}`));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const amount_cents = parseMoney(amount);
    const day_of_month = Number(day);
    if (!name.trim()) return setFormError('Informe o nome da assinatura.');
    if (!amount_cents || amount_cents <= 0) return setFormError('Informe o valor mensal.');
    if (!Number.isInteger(day_of_month) || day_of_month < 1 || day_of_month > 31) return setFormError('O dia da cobrança deve estar entre 1 e 31.');
    if (!cardId) return setFormError('Escolha o cartão.');
    if (!categoryId) return setFormError('Escolha uma categoria.');
    if (endMonth && endMonth < startMonth) return setFormError('O mês final não pode ser antes do inicial.');
    save.mutate(
      {
        name: name.trim(),
        card_id: Number(cardId),
        category_id: Number(categoryId),
        amount_cents,
        day_of_month,
        start_month: startMonth,
        end_month: endMonth || null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal title={subscription ? 'Editar assinatura' : 'Nova assinatura'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nome">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Spotify, YouTube Premium, Discord Nitro" maxLength={60} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Valor por mês" value={amount} onChange={setAmount} />
          <Field label="Dia da cobrança" hint="31 em mês curto vira o último dia.">
            <input className={inputCls} type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
        </div>
        <Field label="Cobrada no cartão">
          <select className={inputCls} value={cardId} onChange={(e) => setCardId(e.target.value)}>
            {cards.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Categoria">
          <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Selecione…</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primeira cobrança em">
            <input className={inputCls} type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} required />
          </Field>
          <Field label="Última cobrança em (opcional)">
            <input className={inputCls} type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
          </Field>
        </div>
        <p className="-mt-1 mb-3 text-xs text-slate-400">
          {subscription
            ? 'Mudanças valem daqui pra frente: as cobranças já lançadas nas faturas não mudam (ótimo para reajuste de preço). Excluir também mantém as cobranças já lançadas.'
            : 'Deixe a última cobrança em branco: ela continua todo mês até você cancelar. Se o dia da cobrança deste mês já passou, ela é lançada na fatura agora; meses anteriores ao atual também, então comece no mês atual se aquelas faturas já foram pagas.'}
        </p>
        <ErrorBox error={formError || save.error || remove.error} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>{subscription && <ConfirmButton small={false} label="Excluir" onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })} />}</div>
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
