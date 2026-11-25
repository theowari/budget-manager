import { monthOf, monthRange, type ISODate, type Month } from '../../shared/dates';
import { isActiveIn, occurrenceDate, type RecurringRule } from './recurring';

/** Parte ainda não paga de uma fatura, e em que mês ela vence (saída de caixa). */
export interface PendingInvoice {
  due_month: Month;
  unpaid_cents: number;
}

export interface ProjectionInput {
  /** Saldo somado das contas hoje (não inclui caixinhas). */
  startBalanceCents: number;
  today: ISODate;
  /** Quantos meses projetar, contando o mês atual. */
  months: number;
  rules: RecurringRule[];
  invoices: PendingInvoice[];
}

export interface ProjectionMonth {
  month: Month;
  income_cents: number;
  expense_cents: number;
  invoices_cents: number;
  net_cents: number;
  /** Saldo no fim do mês. */
  balance_cents: number;
}

/**
 * Projeta o saldo mês a mês: parte do saldo de hoje, soma as recorrências de
 * renda, subtrai as de gasto e as faturas pendentes (no mês do vencimento).
 *
 * - No mês atual só entram ocorrências recorrentes ainda por vir (dia > hoje);
 *   as anteriores já viraram lançamentos e estão no saldo.
 * - Fatura vencida e não paga é cobrada no mês atual.
 */
export function projectBalance(input: ProjectionInput): ProjectionMonth[] {
  const startMonth = monthOf(input.today);
  let balance = input.startBalanceCents;

  return monthRange(startMonth, input.months).map((month) => {
    let income = 0;
    let expense = 0;
    for (const rule of input.rules) {
      if (!isActiveIn(rule, month)) continue;
      if (month === startMonth && occurrenceDate(rule, month) <= input.today) continue;
      if (rule.type === 'income') income += rule.amount_cents;
      else expense += rule.amount_cents;
    }

    const invoices = input.invoices
      .filter((inv) => (inv.due_month < startMonth ? month === startMonth : inv.due_month === month))
      .reduce((sum, inv) => sum + inv.unpaid_cents, 0);

    const net = income - expense - invoices;
    balance += net;
    return {
      month,
      income_cents: income,
      expense_cents: expense,
      invoices_cents: invoices,
      net_cents: net,
      balance_cents: balance,
    };
  });
}
