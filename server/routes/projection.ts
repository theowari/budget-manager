import { Router } from 'express';
import { z } from 'zod';
import { all, type Db } from '../db';
import { projectBalance } from '../domain/projection';
import type { RecurringRule } from '../domain/recurring';
import { upcomingInvoiceCharges, type UpcomingSubscription } from '../domain/subscriptions';
import { materializeRecurring } from '../materialize';
import { pendingInvoices, totalBalance } from '../queries';
import type { ISODate } from '../../shared/dates';

export function projectionRouter(db: Db, today: () => ISODate): Router {
  const r = Router();

  r.get('/', (req, res) => {
    const months = z.coerce.number().int().min(1).max(36).default(12).parse(req.query.months);
    const now = today();
    materializeRecurring(db, now);

    const invoices = pendingInvoices(db);
    const rules = all<RecurringRule>(db, 'SELECT * FROM recurring_rules');
    const start = totalBalance(db);
    // cobranças de assinatura que ainda não viraram compra na fatura (data > hoje)
    const subscriptions = all<UpcomingSubscription>(
      db,
      `SELECT s.amount_cents, s.day_of_month, s.start_month, s.end_month, cd.closing_day, cd.due_day
         FROM subscriptions s JOIN cards cd ON cd.id = s.card_id`,
    );

    const rows = projectBalance({
      startBalanceCents: start,
      today: now,
      months,
      rules,
      invoices: [
        ...invoices.map((i) => ({ due_month: i.due_date.slice(0, 7), unpaid_cents: i.remaining_cents })),
        ...upcomingInvoiceCharges(subscriptions, now, months),
      ],
    });

    res.json({
      start_balance_cents: start,
      months: rows,
      lowest_balance_cents: Math.min(start, ...rows.map((m) => m.balance_cents)),
      first_negative_month: rows.find((m) => m.balance_cents < 0)?.month ?? null,
    });
  });

  return r;
}
