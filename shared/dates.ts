// Helpers de data/mês baseados só em strings 'YYYY-MM-DD' / 'YYYY-MM'.
// Evitam Date + fuso horário, que costuma deslocar o dia em 1.

export type Month = string; // 'YYYY-MM'
export type ISODate = string; // 'YYYY-MM-DD'

export function monthOf(date: ISODate): Month {
  return date.slice(0, 7);
}

/** Soma (ou subtrai, com n negativo) n meses a um mês 'YYYY-MM'. */
export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const mon = (total % 12) + 1;
  return `${year}-${String(mon).padStart(2, '0')}`;
}

export function daysInMonth(month: Month): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Dia `day` dentro do mês; se o mês for menor (ex.: 31 em fevereiro), usa o último dia. */
export function dateInMonth(month: Month, day: number): ISODate {
  const d = Math.min(day, daysInMonth(month));
  return `${month}-${String(d).padStart(2, '0')}`;
}

export function dayOf(date: ISODate): number {
  return Number(date.slice(8, 10));
}

/** Data de hoje no fuso local da máquina. */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonth(now: Date = new Date()): Month {
  return monthOf(todayISO(now));
}

/** Lista `count` meses consecutivos começando em `from`. */
export function monthRange(from: Month, count: number): Month[] {
  return Array.from({ length: count }, (_, i) => addMonths(from, i));
}

/** Diferença em meses (to - from). */
export function monthsBetween(from: Month, to: Month): number {
  const [y1, m1] = from.split('-').map(Number) as [number, number];
  const [y2, m2] = to.split('-').map(Number) as [number, number];
  return (y2 - y1) * 12 + (m2 - m1);
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
