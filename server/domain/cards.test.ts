import { describe, expect, it } from 'vitest';
import { buildCharges, dueDateFor, invoiceMonthFor, splitInstallments } from './cards';

describe('splitInstallments', () => {
  it('100,00 em 3x = 33,34 + 33,33 + 33,33 (resto vai pras primeiras)', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
  });

  it('divisão exata não deixa resto', () => {
    expect(splitInstallments(9000, 3)).toEqual([3000, 3000, 3000]);
  });

  it('1x devolve o total inteiro', () => {
    expect(splitInstallments(12345, 1)).toEqual([12345]);
  });

  it('a soma sempre fecha o total', () => {
    for (const [total, n] of [[1, 1], [7, 3], [99999, 12], [100001, 7]] as const) {
      const parts = splitInstallments(total, n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      expect(parts).toHaveLength(n);
    }
  });

  it('recusa total ou parcelas inválidos', () => {
    expect(() => splitInstallments(0, 3)).toThrow();
    expect(() => splitInstallments(100, 0)).toThrow();
    expect(() => splitInstallments(10.5, 2)).toThrow();
  });
});

describe('invoiceMonthFor', () => {
  it('compra antes do fechamento cai na fatura do mês', () => {
    expect(invoiceMonthFor('2026-03-10', 15)).toBe('2026-03');
  });

  it('compra no dia do fechamento ainda cai na fatura do mês', () => {
    expect(invoiceMonthFor('2026-03-15', 15)).toBe('2026-03');
  });

  it('compra no dia seguinte ao fechamento cai na fatura seguinte', () => {
    expect(invoiceMonthFor('2026-03-16', 15)).toBe('2026-04');
  });

  it('vira o ano: compra depois do fechamento em dezembro cai em janeiro', () => {
    expect(invoiceMonthFor('2026-12-20', 15)).toBe('2027-01');
  });
});

describe('dueDateFor', () => {
  it('vencimento depois do fechamento é no mesmo mês', () => {
    expect(dueDateFor('2026-03', 15, 22)).toBe('2026-03-22');
  });

  it('vencimento antes do fechamento é no mês seguinte', () => {
    expect(dueDateFor('2026-03', 25, 5)).toBe('2026-04-05');
  });

  it('vira o ano', () => {
    expect(dueDateFor('2026-12', 25, 5)).toBe('2027-01-05');
  });

  it('dia 31 em mês curto usa o último dia', () => {
    expect(dueDateFor('2026-01', 10, 31)).toBe('2026-01-31');
    expect(dueDateFor('2026-01', 20, 5)).toBe('2026-02-05');
    expect(dueDateFor('2026-01', 1, 30)).toBe('2026-01-30');
    expect(dueDateFor('2026-02', 1, 30)).toBe('2026-02-28');
  });
});

describe('buildCharges', () => {
  it('compra de 100,00 em 3x em 10/03 (fecha dia 15): faturas e competência consecutivas', () => {
    expect(buildCharges(10000, 3, '2026-03-10', 15)).toEqual([
      { installment_no: 1, amount_cents: 3334, invoice_month: '2026-03', competence_month: '2026-03' },
      { installment_no: 2, amount_cents: 3333, invoice_month: '2026-04', competence_month: '2026-04' },
      { installment_no: 3, amount_cents: 3333, invoice_month: '2026-05', competence_month: '2026-05' },
    ]);
  });

  it('compra depois do fechamento: fatura anda um mês, mas a competência continua no mês da compra', () => {
    const [first, second] = buildCharges(5000, 2, '2026-03-20', 15);
    expect(first).toMatchObject({ invoice_month: '2026-04', competence_month: '2026-03' });
    expect(second).toMatchObject({ invoice_month: '2026-05', competence_month: '2026-04' });
  });

  it('atravessa a virada de ano', () => {
    const charges = buildCharges(3000, 3, '2026-11-30', 10);
    expect(charges.map((c) => c.invoice_month)).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(charges.map((c) => c.competence_month)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});
