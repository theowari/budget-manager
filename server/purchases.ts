import { run, type Db } from './db';
import { buildCharges, type ChargeDraft } from './domain/cards';
import type { ISODate } from '../shared/dates';

export interface NewCardPurchase {
  card_id: number;
  /** Dia de fechamento do cartão, que decide em que fatura cai cada parcela. */
  closing_day: number;
  category_id: number;
  description: string;
  total_cents: number;
  installments: number;
  purchase_date: ISODate;
  /** Preenchido quando a compra é a cobrança mensal de uma assinatura. */
  subscription_id?: number;
}

/**
 * Grava a compra e suas parcelas. Não abre transação: quem chama decide
 * (precisa ser atômico, senão sobra compra sem parcelas).
 */
export function insertCardPurchase(db: Db, p: NewCardPurchase): { id: number; charges: ChargeDraft[] } {
  const charges = buildCharges(p.total_cents, p.installments, p.purchase_date, p.closing_day);
  const { id } = run(
    db,
    `INSERT INTO card_purchases (card_id, category_id, description, total_cents, installments, purchase_date, subscription_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    p.card_id, p.category_id, p.description, p.total_cents, p.installments, p.purchase_date, p.subscription_id ?? null,
  );
  for (const c of charges) {
    run(
      db,
      'INSERT INTO card_charges (purchase_id, card_id, installment_no, amount_cents, invoice_month, competence_month) VALUES (?, ?, ?, ?, ?, ?)',
      id, p.card_id, c.installment_no, c.amount_cents, c.invoice_month, c.competence_month,
    );
  }
  return { id, charges };
}
