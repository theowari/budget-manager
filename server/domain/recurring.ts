import { dateInMonth, monthOf, monthRange, monthsBetween, type ISODate, type Month } from '../../shared/dates';

/** Agenda de algo que se repete todo mês (recorrência, assinatura). */
export interface Schedule {
  day_of_month: number;
  start_month: Month;
  end_month: Month | null;
}

export interface RecurringRule extends Schedule {
  id: number;
  type: 'income' | 'expense';
  account_id: number;
  category_id: number;
  amount_cents: number;
  description: string;
}

/** A regra vale neste mês? (entre start_month e end_month, inclusive) */
export function isActiveIn(rule: Schedule, month: Month): boolean {
  if (month < rule.start_month) return false;
  if (rule.end_month && month > rule.end_month) return false;
  return true;
}

/** Data da ocorrência da regra no mês (dia 31 em fevereiro vira o último dia). */
export function occurrenceDate(rule: Schedule, month: Month): ISODate {
  return dateInMonth(month, rule.day_of_month);
}

/** Todas as datas de ocorrência da regra desde o início até hoje (inclusive). */
export function occurrencesUpTo(rule: RecurringRule, today: ISODate): ISODate[] {
  const last = monthOf(today);
  if (rule.start_month > last) return [];
  const count = monthsBetween(rule.start_month, last) + 1;
  return monthRange(rule.start_month, count)
    .filter((m) => isActiveIn(rule, m))
    .map((m) => occurrenceDate(rule, m))
    .filter((d) => d <= today);
}
