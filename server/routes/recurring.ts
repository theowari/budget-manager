import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, type Db } from '../db';
import { HttpError, idParam, notFound, zCents, zDay, zMonth, zRef } from '../http';
import { materializeRecurring } from '../materialize';
import type { ISODate } from '../../shared/dates';
import { assertCategory } from './categories';

const ruleBody = z
  .object({
    type: z.enum(['income', 'expense']),
    account_id: zRef,
    category_id: zRef,
    amount_cents: zCents,
    description: z.string().trim().min(1, 'informe uma descrição').max(100),
    day_of_month: zDay,
    start_month: zMonth,
    end_month: zMonth.nullable().default(null),
  })
  .refine((b) => !b.end_month || b.end_month >= b.start_month, {
    message: 'o mês final não pode ser antes do inicial',
    path: ['end_month'],
  });

const LIST_SQL = `
  SELECT r.id, r.type, r.account_id, a.name AS account_name, r.category_id, c.name AS category_name,
         c.color AS category_color, r.amount_cents, r.description, r.day_of_month, r.start_month, r.end_month
    FROM recurring_rules r
    JOIN accounts a   ON a.id = r.account_id
    JOIN categories c ON c.id = r.category_id`;

export function recurringRouter(db: Db, today: () => ISODate): Router {
  const r = Router();

  const validate = (b: z.infer<typeof ruleBody>) => {
    assertCategory(db, b.category_id, b.type);
    if (!get(db, 'SELECT 1 FROM accounts WHERE id = ?', b.account_id)) throw new HttpError(400, 'Conta não encontrada');
  };

  r.get('/', (_req, res) => {
    res.json(all(db, `${LIST_SQL} ORDER BY r.type DESC, r.day_of_month, r.id`));
  });

  // Criar já gera os lançamentos que venceram (ex.: aluguel desde janeiro).
  r.post('/', (req, res) => {
    const b = ruleBody.parse(req.body);
    validate(b);
    const { id } = run(
      db,
      `INSERT INTO recurring_rules (type, account_id, category_id, amount_cents, description, day_of_month, start_month, end_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      b.type, b.account_id, b.category_id, b.amount_cents, b.description, b.day_of_month, b.start_month, b.end_month,
    );
    materializeRecurring(db, today());
    res.status(201).json(get(db, `${LIST_SQL} WHERE r.id = ?`, id));
  });

  // Editar vale daqui pra frente; lançamentos já gerados ficam como estão.
  r.put('/:id', (req, res) => {
    const id = idParam(req.params.id);
    const b = ruleBody.parse(req.body);
    validate(b);
    const { changes } = run(
      db,
      `UPDATE recurring_rules SET type = ?, account_id = ?, category_id = ?, amount_cents = ?, description = ?,
              day_of_month = ?, start_month = ?, end_month = ? WHERE id = ?`,
      b.type, b.account_id, b.category_id, b.amount_cents, b.description, b.day_of_month, b.start_month, b.end_month, id,
    );
    if (!changes) throw notFound('Recorrência');
    materializeRecurring(db, today());
    res.json(get(db, `${LIST_SQL} WHERE r.id = ?`, id));
  });

  // Os lançamentos já gerados permanecem (recurring_id vira NULL).
  r.delete('/:id', (req, res) => {
    const { changes } = run(db, 'DELETE FROM recurring_rules WHERE id = ?', idParam(req.params.id));
    if (!changes) throw notFound('Recorrência');
    res.status(204).end();
  });

  return r;
}
