import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarCheckIcon,
  ClockCounterClockwiseIcon,
  ConfettiIcon,
  PencilSimpleIcon,
  PiggyBankIcon,
  PlusIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { todayISO } from '../../../shared/dates';
import type { Goal } from '../../../shared/types';
import { api } from '../api/client';
import { useAccounts, useApiMutation, useGoalMovements, useGoals } from '../api/hooks';
import {
  Amount, Badge, Button, Callout, Card, ColorPicker, ConfirmButton, Empty, ErrorBox, Field, FormActions, IconButton,
  IconTile, inputCls, Loading, Modal, MoneyField, PageHeader, ProgressBar, Select,
} from '../components/ui';
import { brl, centsToInput, formatDate, formatDay, parseMoney } from '../lib/format';

type Action = { kind: 'deposit' | 'withdraw'; goal: Goal } | { kind: 'edit'; goal?: Goal };

export function GoalsPage() {
  const goals = useGoals();
  const [action, setAction] = useState<Action | null>(null);
  const [historyOf, setHistoryOf] = useState<number | null>(null);

  const total = goals.data?.reduce((sum, g) => sum + g.saved_cents, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Caixinhas"
        subtitle={goals.data?.length ? `Você tem ${brl(total)} guardado em ${goals.data.length} caixinha(s).` : 'Separe dinheiro para seus objetivos.'}
        actions={
          <Button icon={PlusIcon} onClick={() => setAction({ kind: 'edit' })}>
            Nova caixinha
          </Button>
        }
      />

      <ErrorBox error={goals.error} />

      {goals.isLoading ? (
        <Loading />
      ) : !goals.data?.length ? (
        <Empty icon={PiggyBankIcon}>Nenhuma caixinha ainda. Crie uma para sua viagem, reserva de emergência, um PC novo…</Empty>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {goals.data.map((g) => (
            <Card key={g.id}>
              <div className="flex items-start gap-3">
                <IconTile icon={PiggyBankIcon} color={g.color} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-medium">{g.name}</h2>
                  <p className="text-xs text-muted">{g.deadline ? `Meta para ${formatDate(g.deadline)}` : 'Sem prazo definido'}</p>
                </div>
                <IconButton label="Editar" icon={PencilSimpleIcon} onClick={() => setAction({ kind: 'edit', goal: g })} />
              </div>

              <div className="mt-4 mb-3 flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl leading-8 font-medium tracking-[-0.025em] text-ink">{brl(g.saved_cents)}</span>
                <span className="tabular text-sm text-muted">de {brl(g.target_cents)}</span>
                <span className="tabular ml-auto text-sm font-medium text-ink">{g.percent}%</span>
              </div>
              <ProgressBar percent={g.percent} color={g.color} label={`Caixinha ${g.name}`} />

              {(g.pace.reached || g.pace.overdue) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {g.pace.reached && (
                    <Badge tone="green" icon={ConfettiIcon}>
                      Meta atingida
                    </Badge>
                  )}
                  {g.pace.overdue && (
                    <Badge tone="red" icon={WarningCircleIcon}>
                      Prazo vencido
                    </Badge>
                  )}
                </div>
              )}

              {!g.pace.reached && g.pace.per_month_cents !== null && (
                <Callout tone={g.pace.overdue ? 'danger' : 'info'} icon={g.pace.overdue ? undefined : CalendarCheckIcon} className="mt-4">
                  {g.pace.overdue
                    ? `Faltam ${brl(g.pace.remaining_cents)} e o prazo já passou.`
                    : `Guarde ${brl(g.pace.per_month_cents)} por mês (${g.pace.months_left} ${g.pace.months_left === 1 ? 'mês' : 'meses'}) para chegar lá.`}
                </Callout>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button small variant="tonal" icon={ArrowDownIcon} onClick={() => setAction({ kind: 'deposit', goal: g })}>
                  Guardar
                </Button>
                <Button small variant="secondary" icon={ArrowUpIcon} disabled={g.saved_cents === 0} onClick={() => setAction({ kind: 'withdraw', goal: g })}>
                  Resgatar
                </Button>
                <Button
                  small
                  variant="ghost"
                  icon={ClockCounterClockwiseIcon}
                  className="ml-auto"
                  aria-expanded={historyOf === g.id}
                  onClick={() => setHistoryOf(historyOf === g.id ? null : g.id)}
                >
                  {historyOf === g.id ? 'Ocultar histórico' : 'Histórico'}
                </Button>
              </div>

              {historyOf === g.id && <History goalId={g.id} />}
            </Card>
          ))}
        </div>
      )}

      {action?.kind === 'edit' && <GoalFormModal goal={action.goal} onClose={() => setAction(null)} />}
      {(action?.kind === 'deposit' || action?.kind === 'withdraw') && (
        <MovementModal kind={action.kind} goal={action.goal} onClose={() => setAction(null)} />
      )}
    </>
  );
}

function History({ goalId }: { goalId: number }) {
  const movements = useGoalMovements(goalId, true);
  const undo = useApiMutation((id: number) => api.delete(`/goals/movements/${id}`));

  return (
    <div className="mt-4 rounded-xl bg-surface px-3 py-2">
      <ErrorBox error={movements.error ?? undo.error} />
      {!movements.data?.length ? (
        <p className="py-2 text-sm text-muted">Nenhuma movimentação ainda.</p>
      ) : (
        <ul className="divide-y divide-line">
          {movements.data.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className="tabular w-11 shrink-0 text-xs text-muted">{formatDay(m.date)}</span>
              <span className="min-w-40 flex-1 text-ink-2">
                {m.amount_cents > 0 ? 'Guardado de' : 'Resgatado para'} {m.account_name}
                {m.note && <span className="block text-xs text-muted">{m.note}</span>}
              </span>
              <span className="ml-auto">
                <Amount text={`${m.amount_cents > 0 ? '+' : '−'} ${brl(Math.abs(m.amount_cents))}`} tone={m.amount_cents > 0 ? 'income' : 'expense'} />
              </span>
              <ConfirmButton label="Desfazer" onConfirm={() => undo.mutate(m.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GoalFormModal({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? centsToInput(goal.target_cents) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [color, setColor] = useState(goal?.color ?? '#0ea5e9');
  const [formError, setFormError] = useState('');

  const save = useApiMutation((body: object) => (goal ? api.put(`/goals/${goal.id}`, body) : api.post('/goals', body)));
  const remove = useApiMutation(() => api.delete(`/goals/${goal!.id}`));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const target_cents = parseMoney(target);
    if (!name.trim()) return setFormError('Dê um nome à caixinha.');
    if (!target_cents || target_cents <= 0) return setFormError('Informe o valor da meta.');
    save.mutate({ name: name.trim(), target_cents, deadline: deadline || null, color }, { onSuccess: onClose });
  };

  return (
    <Modal title={goal ? 'Editar caixinha' : 'Nova caixinha'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Objetivo">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Viagem, Reserva de emergência" autoFocus />
        </Field>
        <MoneyField label="Quanto quer juntar" value={target} onChange={setTarget} />
        <Field label="Prazo (opcional)" hint="Com prazo, mostramos quanto guardar por mês.">
          <input className={inputCls} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <ColorPicker value={color} onChange={setColor} />
        {goal && <p className="mb-3 text-xs text-muted">Excluir a caixinha devolve o valor guardado para as contas.</p>}
        <ErrorBox error={formError || save.error || remove.error} />
        <FormActions danger={goal && <ConfirmButton small={false} label="Excluir caixinha" onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })} />}>
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

function MovementModal({ kind, goal, onClose }: { kind: 'deposit' | 'withdraw'; goal: Goal; onClose: () => void }) {
  const accounts = useAccounts();
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState(kind === 'deposit' && goal.pace.per_month_cents ? centsToInput(goal.pace.per_month_cents) : '');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!accountId && accounts.data?.[0]) setAccountId(String(accounts.data[0].id));
  }, [accounts.data, accountId]);

  const move = useApiMutation((body: object) => api.post(`/goals/${goal.id}/movements`, body));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const amount_cents = parseMoney(amount);
    if (!amount_cents || amount_cents <= 0) return setFormError('Informe um valor maior que zero.');
    move.mutate({ kind, account_id: Number(accountId), amount_cents, date, note }, { onSuccess: onClose });
  };

  const deposit = kind === 'deposit';
  return (
    <Modal title={`${deposit ? 'Guardar em' : 'Resgatar de'} ${goal.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label={deposit ? 'Tirar da conta' : 'Devolver para a conta'}>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · saldo {brl(a.balance_cents)}
              </option>
            ))}
          </Select>
        </Field>
        <MoneyField
          large
          label="Valor"
          value={amount}
          onChange={setAmount}
          autoFocus
          hint={deposit ? undefined : `Guardado agora: ${brl(goal.saved_cents)}`}
        />
        <Field label="Data">
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Observação (opcional)">
          <input className={inputCls} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <ErrorBox error={formError || move.error} />
        <FormActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={move.isPending}>
            {deposit ? 'Guardar' : 'Resgatar'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
