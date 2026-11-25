import { Router } from 'express';
import { all, get, type Db } from '../db';
import { zMonth } from '../http';
import { materializeRecurring } from '../materialize';
import { listAccounts, listGoals, pendingInvoices, spentByCategory, totalSavedInGoals } from '../queries';
import { monthOf, type ISODate } from '../../shared/dates';

/** Percentual do orçamento a partir do qual o dashboard avisa. */
const BUDGET_WARN_PERCENT = 80;

export function dashboardRouter(db: Db, today: () => ISODate): Router {
  const r = Router();

  r.get('/', (req, res) => {
    const now = today();
    materializeRecurring(db, now);
    const month = req.query.month ? zMonth.parse(req.query.month) : monthOf(now);

    const accounts = listAccounts(db);
    const accountsTotal = accounts.reduce((sum, a) => sum + a.balance_cents, 0);
    const goalsTotal = totalSavedInGoals(db);

    const income =
      get<{ total: number }>(
        db,
        "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions WHERE type = 'income' AND substr(date, 1, 7) = ?",
        month,
      )?.total ?? 0;
    const spentByCat = spentByCategory(db, month);
    const expense = spentByCat.reduce((sum, c) => sum + c.spent_cents, 0);

    const spentMap = new Map(spentByCat.map((s) => [s.category_id, s.spent_cents]));
    const budgetAlerts = all<{ category_id: number; name: string; color: string; limit_cents: number }>(
      db,
      `SELECT c.id AS category_id, c.name, c.color, b.monthly_limit_cents AS limit_cents
         FROM budgets b JOIN categories c ON c.id = b.category_id`,
    )
      .map((b) => {
        const spent = spentMap.get(b.category_id) ?? 0;
        return { ...b, spent_cents: spent, percent: Math.round((spent / b.limit_cents) * 100) };
      })
      .filter((b) => b.percent >= BUDGET_WARN_PERCENT)
      .sort((a, b) => b.percent - a.percent);

    res.json({
      month,
      net_worth_cents: accountsTotal + goalsTotal,
      accounts_total_cents: accountsTotal,
      goals_total_cents: goalsTotal,
      accounts,
      month_summary: { income_cents: income, expense_cents: expense, result_cents: income - expense },
      spent_by_category: spentByCat,
      pending_invoices: pendingInvoices(db),
      budget_alerts: budgetAlerts,
      goals: listGoals(db, now),
    });
  });

  return r;
}
