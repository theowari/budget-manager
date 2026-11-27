import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowCounterClockwiseIcon,
  ArrowsClockwiseIcon,
  CalendarBlankIcon,
  CalendarDotsIcon,
  CreditCardIcon,
  PencilSimpleIcon,
  PlusIcon,
} from '@phosphor-icons/react';
import { currentMonth } from '../../../shared/dates';
import type { Subscription } from '../../../shared/types';
import { api } from '../api/client';
import { useApiMutation, useCards, useCategories, useSubscriptions } from '../api/hooks';
import {
  Amount, Badge, BigAmount, Button, Card, ConfirmButton, DateTile, Dot, Empty, ErrorBox, Field, FormActions, IconButton,
  inputCls, Loading, Modal, MoneyField, Note, PageHeader, SectionTitle, Select, StatCard,
} from '../components/ui';
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
          <Button icon={PlusIcon} onClick={() => setEditing('new')} disabled={!hasCards}>
            Nova assinatura
          </Button>
        }
      />

      <ErrorBox error={subs.error ?? cancel.error ?? reactivate.error} />
      {subs.isLoading && <Loading />}

      {!subs.isLoading && !hasCards && (
        <Empty icon={CreditCardIcon}>
          Assinaturas são cobradas num cartão.{' '}
          <Link to="/cartoes" className="text-link">
            Cadastre um cartão
          </Link>{' '}
          para começar.
        </Empty>
      )}

      {subs.data && hasCards && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Custo por mês" icon={CalendarBlankIcon} tone="expense">
              <BigAmount text={brl(monthly)} tone="expense" />
            </StatCard>
            <StatCard label="Custo em 12 meses" icon={CalendarDotsIcon} tone="expense">
              <BigAmount text={brl(monthly * 12)} tone="expense" />
            </StatCard>
            <StatCard label="Assinaturas ativas" icon={ArrowsClockwiseIcon} tone="accent">
              <BigAmount text={String(active.length)} />
            </StatCard>
          </div>

          <SectionTitle>Ativas</SectionTitle>
          {active.length ? (
            <Card flush>
              <ul className="divide-y divide-line">
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
            <Empty icon={ArrowsClockwiseIcon}>
              Nenhuma assinatura ativa. Adicione seus serviços (Spotify, YouTube Premium, Discord…) para ver quanto eles custam por mês.
            </Empty>
          )}

          {ended.length > 0 && (
            <div className="mt-8">
              <SectionTitle>Canceladas</SectionTitle>
              <Card flush>
                <ul className="divide-y divide-line">
                  {ended.map((s) => (
                    <SubscriptionRow
                      key={s.id}
                      sub={s}
                      muted
                      onEdit={() => setEditing(s)}
                      action={
                        <Button
                          small
                          variant="secondary"
                          icon={ArrowCounterClockwiseIcon}
                          disabled={reactivate.isPending}
                          onClick={() => reactivate.mutate(s.id)}
                        >
                          Reativar
                        </Button>
                      }
                    />
                  ))}
                </ul>
              </Card>
            </div>
          )}

          <Note>
            No dia da cobrança, cada assinatura entra como uma compra à vista na fatura do cartão (e no limite, no orçamento e nos lançamentos). Cancelar mantém o histórico e pode ser
            desfeito; a projeção de saldo já considera as próximas cobranças.
          </Note>
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
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
      <DateTile day={sub.day_of_month} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[0.9375rem] font-medium ${muted ? 'text-muted' : 'text-ink'}`}>{sub.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Dot color={sub.category_color} />
            {sub.category_name}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CreditCardIcon aria-hidden size={14} />
            {sub.card_name}
          </span>
          {sub.next_charge_date ? (
            <>
              <span>próxima cobrança {formatDate(sub.next_charge_date)}</span>
              {sub.end_month && <Badge>até {monthLabel(sub.end_month)}</Badge>}
            </>
          ) : (
            <>
              <Badge>cancelada</Badge>
              {hadCharges && <span>última cobrança em {monthLabel(sub.end_month!)}</span>}
            </>
          )}
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <span className="text-[0.9375rem]">
          <Amount text={brl(sub.amount_cents)} tone={muted ? 'neutral' : 'expense'} />
        </span>
        <span className="ml-1 text-xs text-muted">/mês</span>
      </div>
      {/* no celular os botões vão para a linha de baixo */}
      <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto sm:min-w-[13rem]">
        <IconButton label="Editar" icon={PencilSimpleIcon} onClick={onEdit} />
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
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
            {cards.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoria">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Selecione…</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid items-end gap-x-3 sm:grid-cols-2">
          <Field label="Primeira cobrança em">
            <input className={inputCls} type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} required />
          </Field>
          <Field label="Última cobrança em (opcional)">
            <input className={inputCls} type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
          </Field>
        </div>
        <p className="mb-3 text-xs leading-5 text-muted">
          {subscription
            ? 'Mudanças valem daqui pra frente: as cobranças já lançadas nas faturas não mudam (ótimo para reajuste de preço). Excluir também mantém as cobranças já lançadas.'
            : 'Deixe a última cobrança em branco: ela continua todo mês até você cancelar. Se o dia da cobrança deste mês já passou, ela é lançada na fatura agora; meses anteriores ao atual também, então comece no mês atual se aquelas faturas já foram pagas.'}
        </p>
        <ErrorBox error={formError || save.error || remove.error} />
        <FormActions danger={subscription && <ConfirmButton small={false} label="Excluir" onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })} />}>
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
