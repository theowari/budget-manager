import { useEffect, useState, type FormEvent } from 'react';
import { todayISO } from '../../../shared/dates';
import type { Goal } from '../../../shared/types';
import { api } from '../api/client';
import { useAccounts, useApiMutation, useGoalMovements, useGoals } from '../api/hooks';
import {
  Amount, Badge, Button, Card, ColorPicker, ConfirmButton, Empty, ErrorBox, Field, inputCls, Modal, MoneyField,
  PageHeader, ProgressBar,
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
        actions={<Button onClick={() => setAction({ kind: 'edit' })}>+ Nova caixinha</Button>}
      />

      <ErrorBox error={goals.error} />

      {goals.isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : !goals.data?.length ? (
        <Empty>Nenhuma caixinha ainda. Crie uma para sua viagem, reserva de emergência, um PC novo…</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.data.map((g) => (
            <Card key={g.id}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-900">{g.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {g.deadline ? `Meta para ${formatDate(g.deadline)}` : 'Sem prazo definido'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {g.pace.reached && <Badge tone="green">Meta atingida 🎉</Badge>}
                  {g.pace.overdue && <Badge tone="red">Prazo vencido</Badge>}
                  <Button small variant="ghost" onClick={() => setAction({ kind: 'edit', goal: g })}>
                    Editar
                  </Button>
                </div>
              </div>

              <ProgressBar percent={g.percent} color={g.color} />
              <div className="mt-2 flex justify-between text-sm">
                <Amount text={brl(g.saved_cents)} tone="neutral" />
                <span className="text-slate-500">
                  de <span className="tabular">{brl(g.target_cents)}</span> · {g.percent}%
                </span>
              </div>

              {!g.pace.reached && g.pace.per_month_cents !== null && (
                <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                  {g.pace.overdue
                    ? `Faltam ${brl(g.pace.remaining_cents)} e o prazo já passou.`
                    : `Guarde ${brl(g.pace.per_month_cents)} por mês (${g.pace.months_left} ${g.pace.months_left === 1 ? 'mês' : 'meses'}) para chegar lá.`}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button small onClick={() => setAction({ kind: 'deposit', goal: g })}>
                  Guardar
                </Button>
                <Button small variant="secondary" disabled={g.saved_cents === 0} onClick={() => setAction({ kind: 'withdraw', goal: g })}>
                  Resgatar
                </Button>
                <Button small variant="ghost" onClick={() => setHistoryOf(historyOf === g.id ? null : g.id)}>
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
    <div className="mt-4 border-t border-slate-100 pt-3">
      <ErrorBox error={movements.error ?? undo.error} />
      {!movements.data?.length ? (
        <p className="text-xs text-slate-500">Nenhuma movimentação ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {movements.data.map((m) => (
            <li key={m.id} className="flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 text-xs text-slate-400 tabular">{formatDay(m.date)}</span>
              <span className="flex-1 truncate text-slate-600">
                {m.amount_cents > 0 ? 'Guardado de' : 'Resgatado para'} {m.account_name}
                {m.note && <span className="text-slate-400"> · {m.note}</span>}
              </span>
              <Amount text={`${m.amount_cents > 0 ? '+' : '−'} ${brl(Math.abs(m.amount_cents))}`} tone={m.amount_cents > 0 ? 'income' : 'expense'} />
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
        {goal && <p className="mb-3 text-xs text-slate-400">Excluir a caixinha devolve o valor guardado para as contas.</p>}
        <ErrorBox error={formError || save.error || remove.error} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>{goal && <ConfirmButton small={false} label="Excluir caixinha" onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })} />}</div>
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
          <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · saldo {brl(a.balance_cents)}
              </option>
            ))}
          </select>
        </Field>
        <MoneyField
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
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={move.isPending}>
            {deposit ? 'Guardar' : 'Resgatar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
