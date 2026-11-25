import { describe, expect, it } from 'vitest';
import { goalPace } from './goals';
import { projectBalance } from './projection';
import { occurrencesUpTo, type RecurringRule } from './recurring';

const rule = (over: Partial<RecurringRule>): RecurringRule => ({
  id: 1,
  type: 'expense',
  account_id: 1,
  category_id: 1,
  amount_cents: 100_00,
  description: 'regra',
  day_of_month: 5,
  start_month: '2026-01',
  end_month: null,
  ...over,
});

describe('occurrencesUpTo', () => {
  it('gera uma ocorrência por mês até hoje, sem passar do dia atual', () => {
    expect(occurrencesUpTo(rule({ day_of_month: 5, start_month: '2026-09' }), '2026-11-24')).toEqual([
      '2026-09-05',
      '2026-10-05',
      '2026-11-05',
    ]);
    // o dia 28 de novembro ainda não chegou
    expect(occurrencesUpTo(rule({ day_of_month: 28, start_month: '2026-10' }), '2026-11-24')).toEqual([
      '2026-10-28',
    ]);
  });

  it('respeita end_month e start_month no futuro', () => {
    expect(occurrencesUpTo(rule({ start_month: '2026-08', end_month: '2026-09' }), '2026-11-24')).toEqual([
      '2026-08-05',
      '2026-09-05',
    ]);
    expect(occurrencesUpTo(rule({ start_month: '2027-01' }), '2026-11-24')).toEqual([]);
  });

  it('dia 31 em mês curto usa o último dia', () => {
    expect(occurrencesUpTo(rule({ day_of_month: 31, start_month: '2026-02', end_month: '2026-02' }), '2026-12-31')).toEqual([
      '2026-02-28',
    ]);
  });
});

describe('projectBalance', () => {
  const salary = rule({ id: 1, type: 'income', amount_cents: 5000_00, day_of_month: 5 });
  const rent = rule({ id: 2, type: 'expense', amount_cents: 1500_00, day_of_month: 10 });

  it('no mês atual só conta recorrências que ainda vão acontecer', () => {
    // hoje = dia 8: o salário (dia 5) já entrou no saldo; o aluguel (dia 10) ainda não saiu
    const [current] = projectBalance({
      startBalanceCents: 4000_00,
      today: '2026-11-08',
      months: 1,
      rules: [salary, rent],
      invoices: [],
    });
    expect(current).toMatchObject({ month: '2026-11', income_cents: 0, expense_cents: 1500_00, balance_cents: 2500_00 });
  });

  it('meses futuros acumulam renda − gastos', () => {
    const result = projectBalance({
      startBalanceCents: 1000_00,
      today: '2026-11-24',
      months: 3,
      rules: [salary, rent],
      invoices: [],
    });
    expect(result.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(result.map((m) => m.balance_cents)).toEqual([1000_00, 1000_00 + 3500_00, 1000_00 + 7000_00]);
  });

  it('fatura entra no mês do vencimento; parcelas futuras em meses seguintes', () => {
    const result = projectBalance({
      startBalanceCents: 1000_00,
      today: '2026-11-24',
      months: 3,
      rules: [],
      invoices: [
        { due_month: '2026-12', unpaid_cents: 300_00 },
        { due_month: '2027-01', unpaid_cents: 200_00 },
      ],
    });
    expect(result.map((m) => m.invoices_cents)).toEqual([0, 300_00, 200_00]);
    expect(result.map((m) => m.balance_cents)).toEqual([1000_00, 700_00, 500_00]);
  });

  it('fatura vencida e não paga é cobrada no mês atual', () => {
    const [current] = projectBalance({
      startBalanceCents: 500_00,
      today: '2026-11-24',
      months: 1,
      rules: [],
      invoices: [{ due_month: '2026-10', unpaid_cents: 120_00 }],
    });
    expect(current).toMatchObject({ invoices_cents: 120_00, balance_cents: 380_00 });
  });

  it('pode ficar negativo', () => {
    const result = projectBalance({
      startBalanceCents: 100_00,
      today: '2026-11-24',
      months: 2,
      rules: [],
      invoices: [{ due_month: '2026-12', unpaid_cents: 400_00 }],
    });
    expect(result[1]!.balance_cents).toBe(-300_00);
  });

  it('ignora regras que terminaram', () => {
    const ended = rule({ type: 'expense', end_month: '2026-12' });
    const result = projectBalance({ startBalanceCents: 0, today: '2026-11-01', months: 3, rules: [ended], invoices: [] });
    expect(result.map((m) => m.expense_cents)).toEqual([100_00, 100_00, 0]);
  });
});

describe('goalPace', () => {
  it('quanto guardar por mês contando o mês atual', () => {
    // hoje nov/2026, prazo dez/2026 => 2 meses (nov e dez); faltam 1000,00 => 500,00/mês
    expect(goalPace(2000_00, 1000_00, '2026-12-31', '2026-11-24')).toMatchObject({
      remaining_cents: 1000_00,
      months_left: 2,
      per_month_cents: 500_00,
      reached: false,
      overdue: false,
    });
  });

  it('arredonda pra cima pra não ficar curto', () => {
    expect(goalPace(1000_01, 0, '2027-01-31', '2026-11-24').per_month_cents).toBe(333_34);
  });

  it('meta sem prazo não tem ritmo', () => {
    expect(goalPace(2000_00, 500_00, null, '2026-11-24')).toMatchObject({
      remaining_cents: 1500_00,
      months_left: null,
      per_month_cents: null,
    });
  });

  it('meta atingida', () => {
    expect(goalPace(1000_00, 1200_00, '2027-01-31', '2026-11-24')).toMatchObject({
      remaining_cents: 0,
      reached: true,
      per_month_cents: null,
    });
  });

  it('prazo vencido e meta não atingida', () => {
    const pace = goalPace(1000_00, 200_00, '2026-09-30', '2026-11-24');
    expect(pace.overdue).toBe(true);
    expect(pace.months_left).toBe(0);
    expect(pace.per_month_cents).toBe(800_00);
  });
});
