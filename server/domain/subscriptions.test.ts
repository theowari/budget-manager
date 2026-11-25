import { describe, expect, it } from 'vitest';
import {
  billedThroughAfter,
  lastDueMonth,
  monthsToBill,
  nextChargeDate,
  upcomingInvoiceCharges,
  type BillingState,
} from './subscriptions';

const sub = (over: Partial<BillingState> = {}): BillingState => ({
  day_of_month: 10,
  start_month: '2026-09',
  end_month: null,
  billed_through: null,
  ...over,
});

describe('lastDueMonth', () => {
  it('é o mês atual se o dia da cobrança já chegou (inclusive hoje)', () => {
    expect(lastDueMonth(10, '2026-11-24')).toBe('2026-11');
    expect(lastDueMonth(24, '2026-11-24')).toBe('2026-11');
  });

  it('é o mês anterior se o dia ainda não chegou', () => {
    expect(lastDueMonth(28, '2026-11-24')).toBe('2026-10');
    expect(lastDueMonth(5, '2026-01-03')).toBe('2025-12'); // vira o ano
  });

  it('dia 31 em mês curto vence no último dia', () => {
    expect(lastDueMonth(31, '2026-02-27')).toBe('2026-01');
    expect(lastDueMonth(31, '2026-02-28')).toBe('2026-02');
  });
});

describe('monthsToBill', () => {
  it('lança do início até o último mês vencido', () => {
    expect(monthsToBill(sub(), '2026-11-24')).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('não lança o mês cujo dia ainda não chegou', () => {
    expect(monthsToBill(sub({ day_of_month: 28 }), '2026-11-24')).toEqual(['2026-09', '2026-10']);
  });

  it('continua de onde parou, sem repetir meses já lançados', () => {
    expect(monthsToBill(sub({ billed_through: '2026-10' }), '2026-12-15')).toEqual(['2026-11', '2026-12']);
    expect(monthsToBill(sub({ billed_through: '2026-11' }), '2026-11-24')).toEqual([]);
  });

  it('assinatura que começa no futuro não lança nada ainda', () => {
    expect(monthsToBill(sub({ start_month: '2027-01' }), '2026-11-24')).toEqual([]);
  });

  it('para no mês final (o último mês cobrado)', () => {
    expect(monthsToBill(sub({ end_month: '2026-10' }), '2026-12-24')).toEqual(['2026-09', '2026-10']);
  });

  it('cancelada e reativada não cobra retroativamente os meses parados', () => {
    // cancelada em out; o app seguiu processando (billed_through avançou) até nov; reativada em dez
    const reactivated = sub({ end_month: null, billed_through: '2026-11' });
    expect(monthsToBill(reactivated, '2026-12-15')).toEqual(['2026-12']);
  });
});

describe('billedThroughAfter', () => {
  it('avança até o último mês vencido, mesmo se a assinatura estiver encerrada', () => {
    expect(billedThroughAfter(sub({ end_month: '2026-09' }), '2026-11-24')).toBe('2026-11');
  });

  it('nunca recua, mesmo se o dia da cobrança for editado para mais tarde no mês', () => {
    // já lançou novembro (dia 10); depois muda para o dia 28 e hoje é 24 -> "último vencido" seria outubro
    expect(billedThroughAfter(sub({ day_of_month: 28, billed_through: '2026-11' }), '2026-11-24')).toBe('2026-11');
  });
});

describe('nextChargeDate', () => {
  it('é a próxima data depois de hoje', () => {
    expect(nextChargeDate(sub({ day_of_month: 28 }), '2026-11-24')).toBe('2026-11-28');
    expect(nextChargeDate(sub({ day_of_month: 10 }), '2026-11-24')).toBe('2026-12-10');
  });

  it('a cobrança de hoje já foi lançada, então a próxima é a do mês seguinte', () => {
    expect(nextChargeDate(sub({ day_of_month: 24 }), '2026-11-24')).toBe('2026-12-24');
  });

  it('assinatura que começa no futuro tem como próxima a primeira cobrança', () => {
    expect(nextChargeDate(sub({ start_month: '2027-02' }), '2026-11-24')).toBe('2027-02-10');
  });

  it('null quando está encerrada', () => {
    expect(nextChargeDate(sub({ end_month: '2026-11' }), '2026-11-24')).toBeNull();
    expect(nextChargeDate(sub({ end_month: '2026-10' }), '2026-11-24')).toBeNull();
  });

  it('ainda tem cobrança futura se o mês final é o atual e o dia não chegou', () => {
    expect(nextChargeDate(sub({ end_month: '2026-11', day_of_month: 28 }), '2026-11-24')).toBe('2026-11-28');
  });

  it('dia 31 em mês curto cai no último dia', () => {
    expect(nextChargeDate(sub({ day_of_month: 31, start_month: '2026-01' }), '2026-02-10')).toBe('2026-02-28');
  });
});

describe('upcomingInvoiceCharges', () => {
  const card = { closing_day: 15, due_day: 22 };
  const spotify = { ...card, amount_cents: 21_90, day_of_month: 28, start_month: '2026-09', end_month: null };

  it('converte cada cobrança futura em valor a pagar no mês de vencimento da fatura', () => {
    // dia 28 depois do fechamento (15): nov/28 -> fatura de dez, vence 22/dez; dez/28 -> jan; jan/28 -> fev
    const charges = upcomingInvoiceCharges([spotify], '2026-11-24', 3);
    expect(charges).toEqual([
      { due_month: '2026-12', unpaid_cents: 21_90 },
      { due_month: '2027-01', unpaid_cents: 21_90 },
      { due_month: '2027-02', unpaid_cents: 21_90 },
    ]);
  });

  it('cobrança antes do fechamento vence no mesmo mês', () => {
    // dia 10 (<= fechamento 15): dez/10 -> fatura de dez, vence 22/dez. A de nov/10 já foi lançada.
    const charges = upcomingInvoiceCharges([{ ...spotify, day_of_month: 10 }], '2026-11-24', 2);
    expect(charges).toEqual([{ due_month: '2026-12', unpaid_cents: 21_90 }]);
  });

  it('não inclui meses depois do mês final nem cobranças que já aconteceram', () => {
    const charges = upcomingInvoiceCharges([{ ...spotify, end_month: '2026-12' }], '2026-11-24', 6);
    expect(charges).toHaveLength(2); // nov/28 e dez/28
  });

  it('não inclui assinatura encerrada', () => {
    expect(upcomingInvoiceCharges([{ ...spotify, end_month: '2026-10' }], '2026-11-24', 6)).toEqual([]);
  });

  it('vencimento em mês seguinte ao do fechamento (vence dia 5, fecha dia 25)', () => {
    const early = { closing_day: 25, due_day: 5, amount_cents: 10_00, day_of_month: 28, start_month: '2026-01', end_month: null };
    // dez/28 > 25 -> fatura de jan, vence 05/fev
    expect(upcomingInvoiceCharges([early], '2026-12-01', 1)).toEqual([{ due_month: '2027-02', unpaid_cents: 10_00 }]);
  });
});
