import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, type Db } from '../db';
import { dueDateFor, invoiceMonthFor } from '../domain/cards';
import { dateInMonth, type ISODate } from '../../shared/dates';
import { HttpError, idParam, notFound, zCents, zColor, zDate, zDay, zMonth, zRef } from '../http';
import { invoiceTotals } from '../queries';

interface CardRow {
  id: number;
  name: string;
  limit_cents: number;
  closing_day: number;
  due_day: number;
  color: string;
}

const cardBody = z.object({
  name: z.string().trim().min(1, 'informe o nome').max(40),
  limit_cents: z.number().int().min(0),
  closing_day: zDay,
  due_day: zDay,
  color: zColor.default('#7c3aed'),
});

const payBody = z.object({
  month: zMonth,
  account_id: zRef,
  /** Se omitido, paga o que falta da fatura. */
  amount_cents: zCents.optional(),
  date: zDate.optional(),
});

function findCard(db: Db, id: number): CardRow {
  const card = get<CardRow>(db, 'SELECT * FROM cards WHERE id = ?', id);
  if (!card) throw notFound('Cartão');
  return card;
}

export function cardsRouter(db: Db, today: () => ISODate): Router {
  const r = Router();

  /**
   * Cartão com limite usado = soma do que falta pagar em todas as faturas
   * (inclui parcelas futuras) e a fatura que recebe uma compra feita hoje.
   */
  const withUsage = (card: CardRow) => {
    const used = invoiceTotals(db, card.id).reduce((sum, t) => sum + t.remaining_cents, 0);
    return {
      ...card,
      used_cents: used,
      available_cents: card.limit_cents - used,
      current_invoice_month: invoiceMonthFor(today(), card.closing_day),
    };
  };

  r.get('/', (_req, res) => {
    res.json(all<CardRow>(db, 'SELECT * FROM cards ORDER BY id').map(withUsage));
  });

  r.post('/', (req, res) => {
    const b = cardBody.parse(req.body);
    const { id } = run(
      db,
      'INSERT INTO cards (name, limit_cents, closing_day, due_day, color) VALUES (?, ?, ?, ?, ?)',
      b.name, b.limit_cents, b.closing_day, b.due_day, b.color,
    );
    res.status(201).json(withUsage(findCard(db, id)));
  });

  // Mudar fechamento/vencimento só vale para compras novas; as parcelas já geradas não mudam de fatura.
  r.put('/:id', (req, res) => {
    const id = idParam(req.params.id);
    const b = cardBody.parse(req.body);
    const { changes } = run(
      db,
      'UPDATE cards SET name = ?, limit_cents = ?, closing_day = ?, due_day = ?, color = ? WHERE id = ?',
      b.name, b.limit_cents, b.closing_day, b.due_day, b.color, id,
    );
    if (!changes) throw notFound('Cartão');
    res.json(withUsage(findCard(db, id)));
  });

  r.delete('/:id', (req, res) => {
    const id = idParam(req.params.id);
    try {
      const { changes } = run(db, 'DELETE FROM cards WHERE id = ?', id);
      if (!changes) throw notFound('Cartão');
    } catch (err) {
      if (err instanceof Error && /FOREIGN KEY/i.test(err.message)) {
        throw new HttpError(409, 'Este cartão já tem compras ou pagamentos e não pode ser removido.');
      }
      throw err;
    }
    res.status(204).end();
  });

  /** Fatura de um mês: itens, total, pago, restante e status. */
  r.get('/:id/invoice', (req, res) => {
    const card = findCard(db, idParam(req.params.id));
    const month = zMonth.parse(req.query.month);

    const items = all(
      db,
      `SELECT ch.id AS charge_id, p.id AS purchase_id, p.description, p.purchase_date,
              ch.installment_no, p.installments, ch.amount_cents,
              c.id AS category_id, c.name AS category_name, c.color AS category_color
         FROM card_charges ch
         JOIN card_purchases p ON p.id = ch.purchase_id
         JOIN categories c     ON c.id = p.category_id
        WHERE ch.card_id = ? AND ch.invoice_month = ?
        ORDER BY p.purchase_date, p.id`,
      card.id, month,
    );
    const payments = all(
      db,
      `SELECT ip.id, ip.amount_cents, ip.paid_date, ip.account_id, a.name AS account_name
         FROM invoice_payments ip JOIN accounts a ON a.id = ip.account_id
        WHERE ip.card_id = ? AND ip.invoice_month = ?
        ORDER BY ip.paid_date, ip.id`,
      card.id, month,
    );

    const totals = invoiceTotals(db, card.id).find((t) => t.invoice_month === month);
    const total = totals?.charged_cents ?? 0;
    const paid = totals?.paid_cents ?? 0;
    const remaining = totals?.remaining_cents ?? 0;
    const dueDate = dueDateFor(month, card.closing_day, card.due_day);

    let status: 'empty' | 'paid' | 'overdue' | 'open';
    if (total === 0) status = 'empty';
    else if (remaining === 0) status = 'paid';
    else if (dueDate < today()) status = 'overdue';
    else status = 'open';

    res.json({
      card_id: card.id,
      card_name: card.name,
      month,
      closing_date: dateInMonth(month, card.closing_day),
      due_date: dueDate,
      total_cents: total,
      paid_cents: paid,
      remaining_cents: remaining,
      status,
      items,
      payments,
    });
  });

  /** Paga (total ou parcialmente) uma fatura; o valor sai do saldo da conta, sem virar gasto de categoria. */
  r.post('/:id/invoice/pay', (req, res) => {
    const card = findCard(db, idParam(req.params.id));
    const b = payBody.parse(req.body);
    if (!get(db, 'SELECT 1 FROM accounts WHERE id = ?', b.account_id)) throw new HttpError(400, 'Conta não encontrada');

    const totals = invoiceTotals(db, card.id).find((t) => t.invoice_month === b.month);
    const remaining = totals?.remaining_cents ?? 0;
    if (remaining === 0) throw new HttpError(409, 'Esta fatura não tem valor a pagar');

    const amount = b.amount_cents ?? remaining;
    if (amount > remaining) throw new HttpError(400, 'O valor é maior que o restante da fatura');

    const { id } = run(
      db,
      'INSERT INTO invoice_payments (card_id, account_id, invoice_month, amount_cents, paid_date) VALUES (?, ?, ?, ?, ?)',
      card.id, b.account_id, b.month, amount, b.date ?? today(),
    );
    res.status(201).json({ id, amount_cents: amount, remaining_cents: remaining - amount });
  });

  /** Desfaz um pagamento de fatura (o dinheiro volta pra conta). */
  r.delete('/payments/:paymentId', (req, res) => {
    const { changes } = run(db, 'DELETE FROM invoice_payments WHERE id = ?', idParam(req.params.paymentId));
    if (!changes) throw notFound('Pagamento');
    res.status(204).end();
  });

  return r;
}
