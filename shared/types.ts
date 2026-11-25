// Formatos das respostas da API, compartilhados entre servidor e front.
// Valores em centavos; datas 'YYYY-MM-DD'; meses 'YYYY-MM'.

import type { ISODate, Month } from './dates';

export interface Account {
  id: number;
  name: string;
  initial_balance_cents: number;
  balance_cents: number;
}

export type Kind = 'expense' | 'income';

export interface Category {
  id: number;
  name: string;
  kind: Kind;
  color: string;
}

/** Linha da lista de lançamentos: gasto/receita na conta ou parcela de cartão. */
export interface Entry {
  key: string;
  kind: 'transaction' | 'card_charge';
  /** id da transação, ou da compra no cartão (para excluir). */
  ref_id: number;
  date: ISODate;
  description: string;
  type: Kind;
  amount_cents: number;
  category_id: number;
  category_name: string;
  category_color: string;
  account_id: number | null;
  account_name: string | null;
  card_id: number | null;
  card_name: string | null;
  installment_no: number | null;
  installments: number | null;
  invoice_month: Month | null;
  month: Month;
  recurring_id: number | null;
}

export interface Card {
  id: number;
  name: string;
  limit_cents: number;
  closing_day: number;
  due_day: number;
  color: string;
  used_cents: number;
  available_cents: number;
  /** Fatura que recebe uma compra feita hoje. */
  current_invoice_month: Month;
}

export interface InvoiceItem {
  charge_id: number;
  purchase_id: number;
  description: string;
  purchase_date: ISODate;
  installment_no: number;
  installments: number;
  amount_cents: number;
  category_id: number;
  category_name: string;
  category_color: string;
}

export interface InvoicePayment {
  id: number;
  amount_cents: number;
  paid_date: ISODate;
  account_id: number;
  account_name: string;
}

export interface Invoice {
  card_id: number;
  card_name: string;
  month: Month;
  closing_date: ISODate;
  due_date: ISODate;
  total_cents: number;
  paid_cents: number;
  remaining_cents: number;
  status: 'empty' | 'paid' | 'overdue' | 'open';
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

export interface PendingInvoice {
  card_id: number;
  card_name: string;
  card_color: string;
  invoice_month: Month;
  due_date: ISODate;
  charged_cents: number;
  paid_cents: number;
  remaining_cents: number;
}

export interface GoalPace {
  remaining_cents: number;
  /** Meses até o prazo, contando o mês atual. null se a meta não tem prazo. */
  months_left: number | null;
  /** Quanto guardar por mês pra bater a meta no prazo. */
  per_month_cents: number | null;
  reached: boolean;
  overdue: boolean;
}

export interface Goal {
  id: number;
  name: string;
  target_cents: number;
  deadline: ISODate | null;
  color: string;
  saved_cents: number;
  percent: number;
  pace: GoalPace;
}

export interface GoalMovement {
  id: number;
  amount_cents: number; // > 0 depósito, < 0 resgate
  date: ISODate;
  note: string;
  account_id: number;
  account_name: string;
}

export interface BudgetRow {
  category_id: number;
  name: string;
  color: string;
  limit_cents: number | null;
  spent_cents: number;
  percent: number | null;
  over: boolean;
}

export interface RecurringRuleRow {
  id: number;
  type: Kind;
  account_id: number;
  account_name: string;
  category_id: number;
  category_name: string;
  category_color: string;
  amount_cents: number;
  description: string;
  day_of_month: number;
  start_month: Month;
  end_month: Month | null;
}

export interface ProjectionMonth {
  month: Month;
  income_cents: number;
  expense_cents: number;
  invoices_cents: number;
  net_cents: number;
  balance_cents: number;
}

export interface Projection {
  start_balance_cents: number;
  months: ProjectionMonth[];
  lowest_balance_cents: number;
  first_negative_month: Month | null;
}

export interface CategorySpend {
  category_id: number;
  name: string;
  color: string;
  spent_cents: number;
}

export interface BudgetAlert {
  category_id: number;
  name: string;
  color: string;
  limit_cents: number;
  spent_cents: number;
  percent: number;
}

export interface Dashboard {
  month: Month;
  net_worth_cents: number;
  accounts_total_cents: number;
  goals_total_cents: number;
  accounts: Account[];
  month_summary: { income_cents: number; expense_cents: number; result_cents: number };
  spent_by_category: CategorySpend[];
  pending_invoices: PendingInvoice[];
  budget_alerts: BudgetAlert[];
  goals: Goal[];
}
