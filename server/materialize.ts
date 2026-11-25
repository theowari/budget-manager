import { all, run, transaction, type Db } from './db';
import { occurrencesUpTo, type RecurringRule } from './domain/recurring';
import type { ISODate } from '../shared/dates';

type RuleRow = RecurringRule & { last_materialized: ISODate | null };

/**
 * Gera os lançamentos das regras recorrentes que já venceram até `today`.
 * Idempotente: guarda em `last_materialized` até onde já gerou, então um
 * lançamento que o usuário apagou não é recriado.
 */
export function materializeRecurring(db: Db, today: ISODate): number {
  const rules = all<RuleRow>(db, 'SELECT * FROM recurring_rules');
  let created = 0;
  transaction(db, () => {
    for (const rule of rules) {
      const dates = occurrencesUpTo(rule, today).filter(
        (d) => !rule.last_materialized || d > rule.last_materialized,
      );
      for (const date of dates) {
        const r = run(
          db,
          `INSERT OR IGNORE INTO transactions (account_id, category_id, type, amount_cents, date, description, recurring_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          rule.account_id,
          rule.category_id,
          rule.type,
          rule.amount_cents,
          date,
          rule.description,
          rule.id,
        );
        created += r.changes;
      }
      run(db, 'UPDATE recurring_rules SET last_materialized = ? WHERE id = ?', today, rule.id);
    }
  });
  return created;
}
