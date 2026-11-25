import { monthsBetween, monthOf, type ISODate } from '../../shared/dates';
import type { GoalPace } from '../../shared/types';

export type { GoalPace };

/** Ritmo de economia de uma caixinha: quanto falta e quanto guardar por mês. */
export function goalPace(
  targetCents: number,
  savedCents: number,
  deadline: ISODate | null,
  today: ISODate,
): GoalPace {
  const remaining = Math.max(0, targetCents - savedCents);
  const reached = remaining === 0;
  if (!deadline) {
    return { remaining_cents: remaining, months_left: null, per_month_cents: null, reached, overdue: false };
  }
  // Conta o mês atual: prazo em 2026-12 e hoje 2026-11 => 2 meses (nov e dez).
  const monthsLeft = monthsBetween(monthOf(today), monthOf(deadline)) + 1;
  const overdue = !reached && monthsLeft < 1;
  return {
    remaining_cents: remaining,
    months_left: Math.max(0, monthsLeft),
    per_month_cents: reached ? null : Math.ceil(remaining / Math.max(1, monthsLeft)),
    reached,
    overdue,
  };
}
