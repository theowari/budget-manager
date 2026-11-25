import { all, run, transaction, type Db } from './db';
import { occurrenceDate, occurrencesUpTo, type RecurringRule } from './domain/recurring';
import { billedThroughAfter, monthsToBill, type BillingState } from './domain/subscriptions';
import { insertCardPurchase } from './purchases';
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

interface SubscriptionToBill extends BillingState {
  id: number;
  name: string;
  card_id: number;
  closing_day: number;
  category_id: number;
  amount_cents: number;
}

/**
 * Lança na fatura do cartão a cobrança de cada assinatura cujo dia já chegou.
 * Uma compra à vista por assinatura por mês; idempotente. Se o usuário apagar uma
 * cobrança, ela não volta, porque `billed_through` já passou daquele mês.
 * Assinaturas encerradas também avançam `billed_through`: se forem reativadas,
 * não cobram retroativamente os meses em que estavam canceladas.
 */
export function materializeSubscriptions(db: Db, today: ISODate): number {
  const subs = all<SubscriptionToBill>(
    db,
    `SELECT s.id, s.name, s.card_id, cd.closing_day, s.category_id, s.amount_cents,
            s.day_of_month, s.start_month, s.end_month, s.billed_through
       FROM subscriptions s JOIN cards cd ON cd.id = s.card_id`,
  );

  const work = subs
    .map((sub) => ({ sub, months: monthsToBill(sub, today), through: billedThroughAfter(sub, today) }))
    .filter((w) => w.months.length > 0 || w.through !== w.sub.billed_through);
  if (work.length === 0) return 0; // caminho comum: nada a fazer, sem abrir transação

  let created = 0;
  transaction(db, () => {
    for (const { sub, months, through } of work) {
      for (const month of months) {
        insertCardPurchase(db, {
          card_id: sub.card_id,
          closing_day: sub.closing_day,
          category_id: sub.category_id,
          description: sub.name,
          total_cents: sub.amount_cents,
          installments: 1,
          purchase_date: occurrenceDate(sub, month),
          subscription_id: sub.id,
        });
        created++;
      }
      run(db, 'UPDATE subscriptions SET billed_through = ? WHERE id = ?', through, sub.id);
    }
  });
  return created;
}
