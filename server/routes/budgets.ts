import { Router } from 'express';
import { z } from 'zod';
import { all, run, type Db } from '../db';
import { HttpError, idParam, notFound, zCents, zMonth } from '../http';
import { spentByCategory } from '../queries';

interface BudgetRow {
  category_id: number;
  name: string;
  color: string;
  limit_cents: number | null;
}

export function budgetsRouter(db: Db): Router {
  const r = Router();

  /** Todas as categorias de gasto com o limite (se houver) e o gasto do mês. */
  r.get('/', (req, res) => {
    const month = zMonth.parse(req.query.month);
    const spent = new Map(spentByCategory(db, month).map((s) => [s.category_id, s.spent_cents]));
    const rows = all<BudgetRow>(
      db,
      `SELECT c.id AS category_id, c.name, c.color, b.monthly_limit_cents AS limit_cents
         FROM categories c LEFT JOIN budgets b ON b.category_id = c.id
        WHERE c.kind = 'expense' ORDER BY c.name`,
    );
    res.json(
      rows.map((row) => {
        const spent_cents = spent.get(row.category_id) ?? 0;
        const percent = row.limit_cents ? Math.round((spent_cents / row.limit_cents) * 100) : null;
        return { ...row, spent_cents, percent, over: row.limit_cents !== null && spent_cents > row.limit_cents };
      }),
    );
  });

  r.put('/:categoryId', (req, res) => {
    const categoryId = idParam(req.params.categoryId);
    const { monthly_limit_cents } = z.object({ monthly_limit_cents: zCents }).parse(req.body);
    const isExpense = all(db, "SELECT 1 FROM categories WHERE id = ? AND kind = 'expense'", categoryId).length > 0;
    if (!isExpense) throw new HttpError(400, 'Só categorias de gasto têm orçamento');
    run(
      db,
      `INSERT INTO budgets (category_id, monthly_limit_cents) VALUES (?, ?)
       ON CONFLICT(category_id) DO UPDATE SET monthly_limit_cents = excluded.monthly_limit_cents`,
      categoryId, monthly_limit_cents,
    );
    res.json({ category_id: categoryId, monthly_limit_cents });
  });

  r.delete('/:categoryId', (req, res) => {
    const { changes } = run(db, 'DELETE FROM budgets WHERE category_id = ?', idParam(req.params.categoryId));
    if (!changes) throw notFound('Orçamento');
    res.status(204).end();
  });

  return r;
}
