import { all, get, type Db } from './db';
import { dueDateFor } from './domain/cards';
import { goalPace } from './domain/goals';
import type { Month, ISODate } from '../shared/dates';

/**
 * Saldo da conta = inicial + receitas − gastos − pagamentos de fatura − dinheiro
 * guardado em caixinhas (depósito > 0 tira da conta, resgate < 0 devolve).
 */
export const ACCOUNT_SELECT = `
  SELECT
    a.id,
    a.name,
    a.initial_balance_cents,
    a.initial_balance_cents
      + COALESCE((SELECT SUM(CASE t.type WHEN 'income' THEN t.amount_cents ELSE -t.amount_cents END)
                    FROM transactions t WHERE t.account_id = a.id), 0)
      - COALESCE((SELECT SUM(p.amount_cents) FROM invoice_payments p WHERE p.account_id = a.id), 0)
      - COALESCE((SELECT SUM(g.amount_cents) FROM goal_movements g WHERE g.account_id = a.id), 0)
      AS balance_cents
  FROM accounts a`;

export interface AccountRow {
  id: number;
  name: string;
  initial_balance_cents: number;
  balance_cents: number;
}

export function listAccounts(db: Db): AccountRow[] {
  return all<AccountRow>(db, `${ACCOUNT_SELECT} ORDER BY a.id`);
}

export function getAccount(db: Db, id: number): AccountRow | undefined {
  return get<AccountRow>(db, `${ACCOUNT_SELECT} WHERE a.id = ?`, id);
}

export function totalBalance(db: Db): number {
  return listAccounts(db).reduce((sum, a) => sum + a.balance_cents, 0);
}

export function totalSavedInGoals(db: Db): number {
  const row = get<{ total: number }>(db, 'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM goal_movements');
  return row?.total ?? 0;
}

// ---- caixinhas ---------------------------------------------------------------

export interface GoalRow {
  id: number;
  name: string;
  target_cents: number;
  deadline: ISODate | null;
  color: string;
}

export function savedInGoal(db: Db, goalId: number): number {
  return (
    get<{ total: number }>(db, 'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM goal_movements WHERE goal_id = ?', goalId)
      ?.total ?? 0
  );
}

/** Caixinha com valor guardado, percentual e ritmo mensal pra bater a meta. */
export function presentGoal(db: Db, goal: GoalRow, today: ISODate) {
  const saved = savedInGoal(db, goal.id);
  return {
    ...goal,
    saved_cents: saved,
    percent: Math.min(100, Math.round((saved / goal.target_cents) * 100)),
    pace: goalPace(goal.target_cents, saved, goal.deadline, today),
  };
}

export function listGoals(db: Db, today: ISODate) {
  return all<GoalRow>(db, 'SELECT * FROM goals ORDER BY id').map((g) => presentGoal(db, g, today));
}

// ---- faturas ---------------------------------------------------------------

export interface InvoiceTotals {
  card_id: number;
  invoice_month: Month;
  charged_cents: number;
  paid_cents: number;
  remaining_cents: number;
}

/** Total cobrado/pago/restante por (cartão, fatura). Opcionalmente de um cartão só. */
export function invoiceTotals(db: Db, cardId?: number): InvoiceTotals[] {
  const filter = cardId === undefined ? '' : 'WHERE card_id = ?';
  const params = cardId === undefined ? [] : [cardId];
  const charged = all<{ card_id: number; invoice_month: Month; total: number }>(
    db,
    `SELECT card_id, invoice_month, SUM(amount_cents) AS total FROM card_charges ${filter} GROUP BY card_id, invoice_month`,
    ...params,
  );
  const paid = all<{ card_id: number; invoice_month: Month; total: number }>(
    db,
    `SELECT card_id, invoice_month, SUM(amount_cents) AS total FROM invoice_payments ${filter} GROUP BY card_id, invoice_month`,
    ...params,
  );

  const byKey = new Map<string, InvoiceTotals>();
  const entry = (card_id: number, invoice_month: Month) => {
    const key = `${card_id}|${invoice_month}`;
    let e = byKey.get(key);
    if (!e) {
      e = { card_id, invoice_month, charged_cents: 0, paid_cents: 0, remaining_cents: 0 };
      byKey.set(key, e);
    }
    return e;
  };
  for (const c of charged) entry(c.card_id, c.invoice_month).charged_cents = c.total;
  for (const p of paid) entry(p.card_id, p.invoice_month).paid_cents = p.total;
  for (const e of byKey.values()) e.remaining_cents = Math.max(0, e.charged_cents - e.paid_cents);
  return [...byKey.values()].sort((a, b) => a.invoice_month.localeCompare(b.invoice_month));
}

export interface PendingInvoiceRow extends InvoiceTotals {
  card_name: string;
  card_color: string;
  due_date: ISODate;
}

/** Faturas com valor ainda por pagar (inclui as futuras, de parcelas já lançadas). */
export function pendingInvoices(db: Db): PendingInvoiceRow[] {
  const cards = new Map(
    all<{ id: number; name: string; color: string; closing_day: number; due_day: number }>(
      db,
      'SELECT id, name, color, closing_day, due_day FROM cards',
    ).map((c) => [c.id, c]),
  );
  return invoiceTotals(db)
    .filter((t) => t.remaining_cents > 0)
    .flatMap((t) => {
      const card = cards.get(t.card_id);
      if (!card) return [];
      return [
        {
          ...t,
          card_name: card.name,
          card_color: card.color,
          due_date: dueDateFor(t.invoice_month, card.closing_day, card.due_day),
        },
      ];
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

// ---- gasto por categoria ----------------------------------------------------

export interface CategorySpend {
  category_id: number;
  name: string;
  color: string;
  spent_cents: number;
}

/**
 * Gasto do mês por categoria = gastos diretos na conta (data no mês) + parcelas
 * de cartão cuja competência é o mês. Pagar fatura NÃO entra (já contou na compra).
 */
export function spentByCategory(db: Db, month: Month): CategorySpend[] {
  return all<CategorySpend>(
    db,
    `SELECT c.id AS category_id, c.name, c.color, SUM(x.amount_cents) AS spent_cents
       FROM (
         SELECT category_id, amount_cents FROM transactions
          WHERE type = 'expense' AND substr(date, 1, 7) = ?
         UNION ALL
         SELECT p.category_id, ch.amount_cents
           FROM card_charges ch JOIN card_purchases p ON p.id = ch.purchase_id
          WHERE ch.competence_month = ?
       ) x
       JOIN categories c ON c.id = x.category_id
      GROUP BY c.id
      ORDER BY spent_cents DESC`,
    month,
    month,
  );
}
