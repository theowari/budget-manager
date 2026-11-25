import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, transaction, type Db } from '../db';
import { HttpError, idParam, notFound, zCents, zDate, zMonth, zRef } from '../http';
import { insertCardPurchase } from '../purchases';
import { assertCategory } from './categories';

const description = z.string().trim().max(200).default('');

const accountEntry = z.object({
  method: z.literal('account'),
  type: z.enum(['income', 'expense']),
  account_id: zRef,
  category_id: zRef,
  amount_cents: zCents,
  date: zDate,
  description,
});

const cardEntry = z.object({
  method: z.literal('card'),
  card_id: zRef,
  category_id: zRef,
  total_cents: zCents,
  installments: z.number().int().min(1).max(60).default(1),
  date: zDate,
  description,
});

const createBody = z.discriminatedUnion('method', [accountEntry, cardEntry]);
const updateTransactionBody = accountEntry.omit({ method: true });

const listQuery = z.object({
  month: zMonth,
  type: z.enum(['income', 'expense']).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  account_id: z.coerce.number().int().positive().optional(),
  card_id: z.coerce.number().int().positive().optional(),
});

/** Linha unificada da lista de lançamentos: gasto/receita na conta ou parcela de cartão. */
const ENTRIES_SQL = `
  SELECT 't-' || t.id AS key, 'transaction' AS kind, t.id AS ref_id, t.date, t.description, t.type,
         t.amount_cents, t.category_id, c.name AS category_name, c.color AS category_color,
         t.account_id, a.name AS account_name,
         NULL AS card_id, NULL AS card_name,
         NULL AS installment_no, NULL AS installments, NULL AS invoice_month,
         substr(t.date, 1, 7) AS month, t.recurring_id, NULL AS subscription_id
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    JOIN accounts a   ON a.id = t.account_id
  UNION ALL
  SELECT 'c-' || ch.id, 'card_charge', p.id, p.purchase_date, p.description, 'expense',
         ch.amount_cents, p.category_id, c.name, c.color,
         NULL, NULL,
         p.card_id, cd.name,
         ch.installment_no, p.installments, ch.invoice_month,
         ch.competence_month, NULL, p.subscription_id
    FROM card_charges ch
    JOIN card_purchases p ON p.id = ch.purchase_id
    JOIN categories c     ON c.id = p.category_id
    JOIN cards cd         ON cd.id = p.card_id`;

export function entriesRouter(db: Db): Router {
  const r = Router();

  r.get('/entries', (req, res) => {
    const q = listQuery.parse(req.query);
    const where = ['month = ?'];
    const params: (string | number)[] = [q.month];
    // nomes de coluna vêm só das chaves fixas abaixo, nunca da requisição
    const filters = { type: q.type, category_id: q.category_id, account_id: q.account_id, card_id: q.card_id };
    for (const [column, value] of Object.entries(filters)) {
      if (value === undefined) continue;
      where.push(`${column} = ?`);
      params.push(value);
    }
    res.json(
      all(
        db,
        `SELECT * FROM (${ENTRIES_SQL}) WHERE ${where.join(' AND ')} ORDER BY date DESC, ref_id DESC, key DESC`,
        ...params,
      ),
    );
  });

  r.post('/entries', (req, res) => {
    const b = createBody.parse(req.body);

    if (b.method === 'account') {
      assertCategory(db, b.category_id, b.type);
      if (!get(db, 'SELECT 1 FROM accounts WHERE id = ?', b.account_id)) throw new HttpError(400, 'Conta não encontrada');
      const { id } = run(
        db,
        'INSERT INTO transactions (account_id, category_id, type, amount_cents, date, description) VALUES (?, ?, ?, ?, ?, ?)',
        b.account_id, b.category_id, b.type, b.amount_cents, b.date, b.description,
      );
      res.status(201).json({ kind: 'transaction', id });
      return;
    }

    // compra no cartão (sempre gasto), parcelada ou à vista
    assertCategory(db, b.category_id, 'expense');
    const card = get<{ id: number; closing_day: number }>(db, 'SELECT id, closing_day FROM cards WHERE id = ?', b.card_id);
    if (!card) throw new HttpError(400, 'Cartão não encontrado');

    const purchase = transaction(db, () =>
      insertCardPurchase(db, {
        card_id: b.card_id,
        closing_day: card.closing_day,
        category_id: b.category_id,
        description: b.description,
        total_cents: b.total_cents,
        installments: b.installments,
        purchase_date: b.date,
      }),
    );
    res.status(201).json({ kind: 'card_purchase', id: purchase.id, installments: purchase.charges });
  });

  r.put('/transactions/:id', (req, res) => {
    const id = idParam(req.params.id);
    const b = updateTransactionBody.parse(req.body);
    assertCategory(db, b.category_id, b.type);
    const { changes } = run(
      db,
      'UPDATE transactions SET account_id = ?, category_id = ?, type = ?, amount_cents = ?, date = ?, description = ? WHERE id = ?',
      b.account_id, b.category_id, b.type, b.amount_cents, b.date, b.description, id,
    );
    if (!changes) throw notFound('Lançamento');
    res.json(get(db, 'SELECT * FROM transactions WHERE id = ?', id));
  });

  r.delete('/transactions/:id', (req, res) => {
    const { changes } = run(db, 'DELETE FROM transactions WHERE id = ?', idParam(req.params.id));
    if (!changes) throw notFound('Lançamento');
    res.status(204).end();
  });

  // Editar compra no cartão = excluir e recriar. Parcelas saem em cascata.
  r.delete('/card-purchases/:id', (req, res) => {
    const id = idParam(req.params.id);
    const paid = get(
      db,
      `SELECT 1 FROM card_charges ch
         JOIN invoice_payments ip ON ip.card_id = ch.card_id AND ip.invoice_month = ch.invoice_month
        WHERE ch.purchase_id = ? LIMIT 1`,
      id,
    );
    if (paid) {
      throw new HttpError(409, 'Uma fatura desta compra já tem pagamento. Desfaça o pagamento antes de excluir.');
    }
    const { changes } = run(db, 'DELETE FROM card_purchases WHERE id = ?', id);
    if (!changes) throw notFound('Compra');
    res.status(204).end();
  });

  return r;
}
