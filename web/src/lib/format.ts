import type { ISODate, Month } from '../../../shared/dates';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos -> "R$ 1.234,56". */
export function brl(cents: number): string {
  return BRL.format(cents / 100);
}

/** Centavos -> texto editável "1234,56" (para pré-preencher campos). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Texto digitado -> centavos. Aceita "1234,56", "1.234,56", "R$ 12", "12.5".
 * Devolve null se não for um número válido.
 */
export function parseMoney(text: string): number | null {
  let t = text.replace(/[R$\s]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, ''); // 1.234.567
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number.parseFloat(t) * 100);
}

const MONTH_FMT = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const MONTH_SHORT_FMT = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });

function monthDate(month: Month): Date {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1));
}

/** "2026-11" -> "novembro de 2026". */
export function monthLabel(month: Month): string {
  return MONTH_FMT.format(monthDate(month));
}

/** "2026-11" -> "nov. de 26". */
export function monthShort(month: Month): string {
  return MONTH_SHORT_FMT.format(monthDate(month));
}

const MONTH_ABBR_FMT = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

/** "2026-11" -> "nov". */
export function monthAbbr(month: Month): string {
  return MONTH_ABBR_FMT.format(monthDate(month)).replace('.', '');
}

/** "2026-11-24" -> "24/11/2026". */
export function formatDate(date: ISODate): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** "2026-11-24" -> "24/11". */
export function formatDay(date: ISODate): string {
  return formatDate(date).slice(0, 5);
}

/** Primeira letra maiúscula. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
