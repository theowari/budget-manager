import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, type Db } from '../db';
import { brl } from '../format';
import { HttpError, idParam, notFound, zCents, zColor, zDate, zRef } from '../http';
import { getAccount, listGoals, presentGoal, savedInGoal, type GoalRow } from '../queries';
import type { ISODate } from '../../shared/dates';

const goalBody = z.object({
  name: z.string().trim().min(1, 'informe o nome').max(60),
  target_cents: zCents,
  deadline: zDate.nullable().default(null),
  color: zColor.default('#0ea5e9'),
});

const movementBody = z.object({
  kind: z.enum(['deposit', 'withdraw']),
  account_id: zRef,
  amount_cents: zCents,
  date: zDate.optional(),
  note: z.string().trim().max(200).default(''),
});

export function goalsRouter(db: Db, today: () => ISODate): Router {
  const r = Router();

  const find = (id: number): GoalRow => {
    const g = get<GoalRow>(db, 'SELECT * FROM goals WHERE id = ?', id);
    if (!g) throw notFound('Caixinha');
    return g;
  };

  r.get('/', (_req, res) => {
    res.json(listGoals(db, today()));
  });

  r.post('/', (req, res) => {
    const b = goalBody.parse(req.body);
    const { id } = run(db, 'INSERT INTO goals (name, target_cents, deadline, color) VALUES (?, ?, ?, ?)', b.name, b.target_cents, b.deadline, b.color);
    res.status(201).json(presentGoal(db, find(id), today()));
  });

  r.put('/:id', (req, res) => {
    const id = idParam(req.params.id);
    const b = goalBody.parse(req.body);
    const { changes } = run(db, 'UPDATE goals SET name = ?, target_cents = ?, deadline = ?, color = ? WHERE id = ?', b.name, b.target_cents, b.deadline, b.color, id);
    if (!changes) throw notFound('Caixinha');
    res.json(presentGoal(db, find(id), today()));
  });

  // Excluir apaga os movimentos, então o valor guardado volta pro saldo das contas.
  r.delete('/:id', (req, res) => {
    const { changes } = run(db, 'DELETE FROM goals WHERE id = ?', idParam(req.params.id));
    if (!changes) throw notFound('Caixinha');
    res.status(204).end();
  });

  r.get('/:id/movements', (req, res) => {
    const id = idParam(req.params.id);
    find(id);
    res.json(
      all(
        db,
        `SELECT m.id, m.amount_cents, m.date, m.note, m.account_id, a.name AS account_name
           FROM goal_movements m JOIN accounts a ON a.id = m.account_id
          WHERE m.goal_id = ? ORDER BY m.date DESC, m.id DESC`,
        id,
      ),
    );
  });

  /** Guardar (sai da conta) ou resgatar (volta pra conta) dinheiro de uma caixinha. */
  r.post('/:id/movements', (req, res) => {
    const goal = find(idParam(req.params.id));
    const b = movementBody.parse(req.body);
    const account = getAccount(db, b.account_id);
    if (!account) throw new HttpError(400, 'Conta não encontrada');

    if (b.kind === 'deposit') {
      if (account.balance_cents < b.amount_cents) {
        throw new HttpError(409, `Saldo insuficiente na conta "${account.name}" (${brl(account.balance_cents)})`);
      }
    } else if (savedInGoal(db, goal.id) < b.amount_cents) {
      throw new HttpError(409, 'Você não pode resgatar mais do que está guardado na caixinha');
    }

    const signed = b.kind === 'deposit' ? b.amount_cents : -b.amount_cents;
    const { id } = run(
      db,
      'INSERT INTO goal_movements (goal_id, account_id, amount_cents, date, note) VALUES (?, ?, ?, ?, ?)',
      goal.id, b.account_id, signed, b.date ?? today(), b.note,
    );
    res.status(201).json({ id, goal: presentGoal(db, goal, today()) });
  });

  r.delete('/movements/:movementId', (req, res) => {
    const id = idParam(req.params.movementId);
    const movement = get<{ goal_id: number; amount_cents: number }>(db, 'SELECT goal_id, amount_cents FROM goal_movements WHERE id = ?', id);
    if (!movement) throw notFound('Movimento');
    // desfazer um depósito que já foi (em parte) resgatado deixaria a caixinha negativa
    if (savedInGoal(db, movement.goal_id) - movement.amount_cents < 0) {
      throw new HttpError(409, 'Não dá pra desfazer este depósito: parte dele já foi resgatada');
    }
    run(db, 'DELETE FROM goal_movements WHERE id = ?', id);
    res.status(204).end();
  });

  return r;
}
