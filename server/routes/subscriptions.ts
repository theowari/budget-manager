import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, type Db } from '../db';
import { lastDueMonth, nextChargeDate } from '../domain/subscriptions';
import { HttpError, idParam, notFound, zCents, zDay, zMonth, zRef } from '../http';
import { materializeSubscriptions } from '../materialize';
import { monthOf, monthsBetween, type ISODate } from '../../shared/dates';
import type { Subscription } from '../../shared/types';
import { assertCategory } from './categories';

/** Evita erro de digitação no ano (2002 em vez de 2026) gerar centenas de cobranças atrasadas. */
const MAX_MONTHS_BACK = 36;

const subscriptionBody = z
  .object({
    name: z.string().trim().min(1, 'informe o nome da assinatura').max(60),
    card_id: zRef,
    category_id: zRef,
    amount_cents: zCents,
    day_of_month: zDay,
    start_month: zMonth,
    end_month: zMonth.nullable().default(null),
  })
  .refine((b) => !b.end_month || b.end_month >= b.start_month, {
    message: 'o mês final não pode ser antes do inicial',
    path: ['end_month'],
  });

type SubscriptionRow = Omit<Subscription, 'next_charge_date'>;

const LIST_SQL = `
  SELECT s.id, s.name, s.card_id, cd.name AS card_name, cd.color AS card_color,
         s.category_id, c.name AS category_name, c.color AS category_color,
         s.amount_cents, s.day_of_month, s.start_month, s.end_month
    FROM subscriptions s
    JOIN cards cd     ON cd.id = s.card_id
    JOIN categories c ON c.id = s.category_id`;

export function subscriptionsRouter(db: Db, today: () => ISODate): Router {
  const r = Router();

  /** Linha da lista + data da próxima cobrança (null = encerrada). */
  const present = (row: SubscriptionRow) => ({ ...row, next_charge_date: nextChargeDate(row, today()) });

  const find = (id: number) => {
    const row = get<SubscriptionRow>(db, `${LIST_SQL} WHERE s.id = ?`, id);
    if (!row) throw notFound('Assinatura');
    return row;
  };

  const validate = (b: z.infer<typeof subscriptionBody>) => {
    assertCategory(db, b.category_id, 'expense');
    if (!get(db, 'SELECT 1 FROM cards WHERE id = ?', b.card_id)) throw new HttpError(400, 'Cartão não encontrado');
    if (monthsBetween(b.start_month, monthOf(today())) > MAX_MONTHS_BACK) {
      throw new HttpError(400, `A primeira cobrança não pode ser de mais de ${MAX_MONTHS_BACK} meses atrás`);
    }
  };

  r.get('/', (_req, res) => {
    res.json(all<SubscriptionRow>(db, `${LIST_SQL} ORDER BY s.day_of_month, s.id`).map(present));
  });

  // Criar já lança as cobranças vencidas (ex.: a deste mês, se o dia já passou).
  r.post('/', (req, res) => {
    const b = subscriptionBody.parse(req.body);
    validate(b);
    const { id } = run(
      db,
      `INSERT INTO subscriptions (name, card_id, category_id, amount_cents, day_of_month, start_month, end_month)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      b.name, b.card_id, b.category_id, b.amount_cents, b.day_of_month, b.start_month, b.end_month,
    );
    materializeSubscriptions(db, today());
    res.status(201).json(present(find(id)));
  });

  // Editar vale daqui pra frente (ex.: reajuste do preço); cobranças já lançadas não mudam.
  r.put('/:id', (req, res) => {
    const id = idParam(req.params.id);
    const b = subscriptionBody.parse(req.body);
    validate(b);
    const { changes } = run(
      db,
      `UPDATE subscriptions SET name = ?, card_id = ?, category_id = ?, amount_cents = ?, day_of_month = ?,
              start_month = ?, end_month = ? WHERE id = ?`,
      b.name, b.card_id, b.category_id, b.amount_cents, b.day_of_month, b.start_month, b.end_month, id,
    );
    if (!changes) throw notFound('Assinatura');
    materializeSubscriptions(db, today());
    res.json(present(find(id)));
  });

  // Cancelar = não cobra mais a partir da próxima data; o histórico fica e dá pra reativar.
  r.post('/:id/cancel', (req, res) => {
    const id = idParam(req.params.id);
    find(id);
    materializeSubscriptions(db, today()); // lança o que já venceu antes de encerrar
    const sub = find(id);
    const lastCharged = lastDueMonth(sub.day_of_month, today());
    const endMonth = sub.end_month !== null && sub.end_month < lastCharged ? sub.end_month : lastCharged;
    run(db, 'UPDATE subscriptions SET end_month = ? WHERE id = ?', endMonth, id);
    res.json(present(find(id)));
  });

  // Reativar volta a cobrar da próxima data em diante, sem cobrar os meses em que ficou cancelada.
  r.post('/:id/reactivate', (req, res) => {
    const id = idParam(req.params.id);
    find(id);
    materializeSubscriptions(db, today()); // avança "billed_through" enquanto ainda está encerrada
    run(db, 'UPDATE subscriptions SET end_month = NULL WHERE id = ?', id);
    res.json(present(find(id)));
  });

  // As cobranças já lançadas permanecem na fatura (subscription_id vira NULL).
  r.delete('/:id', (req, res) => {
    const { changes } = run(db, 'DELETE FROM subscriptions WHERE id = ?', idParam(req.params.id));
    if (!changes) throw notFound('Assinatura');
    res.status(204).end();
  });

  return r;
}
