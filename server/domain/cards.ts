import { addMonths, dateInMonth, dayOf, monthOf, type ISODate, type Month } from '../../shared/dates';

/**
 * Divide `totalCents` em `n` parcelas inteiras. O resto (centavos que sobram)
 * vai uma a uma para as primeiras parcelas, então a soma sempre fecha o total.
 * Ex.: 10000 em 3x -> [3334, 3333, 3333].
 */
export function splitInstallments(totalCents: number, n: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new RangeError('total inválido');
  if (!Number.isInteger(n) || n < 1) throw new RangeError('número de parcelas inválido');
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Em qual fatura (identificada pelo mês de fechamento) cai uma compra.
 * Compra até o dia de fechamento (inclusive) entra na fatura do próprio mês;
 * depois disso, na do mês seguinte.
 */
export function invoiceMonthFor(purchaseDate: ISODate, closingDay: number): Month {
  const month = monthOf(purchaseDate);
  return dayOf(purchaseDate) <= closingDay ? month : addMonths(month, 1);
}

/**
 * Data de vencimento de uma fatura. Se o dia de vencimento é maior que o de
 * fechamento, vence no mesmo mês do fechamento; senão, no mês seguinte.
 */
export function dueDateFor(invoiceMonth: Month, closingDay: number, dueDay: number): ISODate {
  const dueMonth = dueDay > closingDay ? invoiceMonth : addMonths(invoiceMonth, 1);
  return dateInMonth(dueMonth, dueDay);
}

export interface ChargeDraft {
  installment_no: number;
  amount_cents: number;
  invoice_month: Month;
  competence_month: Month;
}

/**
 * Gera as parcelas de uma compra no cartão. A parcela n cai n-1 meses depois
 * da primeira, tanto na fatura quanto no mês de competência (gasto).
 */
export function buildCharges(
  totalCents: number,
  installments: number,
  purchaseDate: ISODate,
  closingDay: number,
): ChargeDraft[] {
  const firstInvoice = invoiceMonthFor(purchaseDate, closingDay);
  const firstCompetence = monthOf(purchaseDate);
  return splitInstallments(totalCents, installments).map((amount, i) => ({
    installment_no: i + 1,
    amount_cents: amount,
    invoice_month: addMonths(firstInvoice, i),
    competence_month: addMonths(firstCompetence, i),
  }));
}
