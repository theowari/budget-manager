import { addMonths, dateInMonth, monthOf, monthRange, monthsBetween, type ISODate, type Month } from '../../shared/dates';
import { dueDateFor, invoiceMonthFor } from './cards';
import type { PendingInvoice } from './projection';
import { isActiveIn, occurrenceDate, type Schedule } from './recurring';

/** Assinatura mais o ponto até onde as cobranças já foram lançadas. */
export interface BillingState extends Schedule {
  billed_through: Month | null;
}

/** O mais recente de dois meses 'YYYY-MM' (null conta como "nenhum"). */
export function laterMonth(a: Month | null, b: Month): Month {
  return a !== null && a > b ? a : b;
}

/**
 * Último mês cuja data de cobrança já chegou (data <= hoje).
 * Dia 28, hoje 24/11 -> outubro (a de novembro ainda não chegou).
 */
export function lastDueMonth(dayOfMonth: number, today: ISODate): Month {
  const month = monthOf(today);
  return dateInMonth(month, dayOfMonth) <= today ? month : addMonths(month, -1);
}

/**
 * Meses em que a assinatura já deveria ter sido cobrada e ainda não foi lançada:
 * depois do último mês processado (`billed_through`), a partir do início, até o
 * último mês vencido, só os meses em que ela estava ativa.
 */
export function monthsToBill(sub: BillingState, today: ISODate): Month[] {
  const last = lastDueMonth(sub.day_of_month, today);
  const from = laterMonth(sub.billed_through ? addMonths(sub.billed_through, 1) : null, sub.start_month);
  if (from > last) return [];
  return monthRange(from, monthsBetween(from, last) + 1).filter((m) => isActiveIn(sub, m));
}

/** Até que mês as cobranças passam a estar processadas depois de lançar o que venceu. */
export function billedThroughAfter(sub: BillingState, today: ISODate): Month {
  return laterMonth(sub.billed_through, lastDueMonth(sub.day_of_month, today));
}

/**
 * Data da próxima cobrança (estritamente depois de hoje; a de hoje já foi lançada).
 * null quando a assinatura está encerrada.
 */
export function nextChargeDate(sub: Schedule, today: ISODate): ISODate | null {
  let month = laterMonth(monthOf(today), sub.start_month);
  if (occurrenceDate(sub, month) <= today) month = addMonths(month, 1);
  return isActiveIn(sub, month) ? occurrenceDate(sub, month) : null;
}

export interface UpcomingSubscription extends Schedule {
  amount_cents: number;
  closing_day: number;
  due_day: number;
}

/**
 * Cobranças das assinaturas que ainda vão acontecer (data > hoje) nos próximos
 * `months` meses, já convertidas em valor a pagar no mês de vencimento da fatura.
 * As de hoje para trás já viraram compra na fatura e entram pelas faturas pendentes.
 */
export function upcomingInvoiceCharges(subs: UpcomingSubscription[], today: ISODate, months: number): PendingInvoice[] {
  const charges: PendingInvoice[] = [];
  for (const sub of subs) {
    for (const month of monthRange(monthOf(today), months)) {
      if (!isActiveIn(sub, month)) continue;
      const date = occurrenceDate(sub, month);
      if (date <= today) continue;
      const invoice = invoiceMonthFor(date, sub.closing_day);
      charges.push({
        due_month: monthOf(dueDateFor(invoice, sub.closing_day, sub.due_day)),
        unpaid_cents: sub.amount_cents,
      });
    }
  }
  return charges;
}
