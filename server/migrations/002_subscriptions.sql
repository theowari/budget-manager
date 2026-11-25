-- Assinaturas: cobrança mensal no cartão, sem número de parcelas. Continua até ser cancelada.
-- Cada mês vira uma compra à vista em card_purchases (com subscription_id), então fatura,
-- limite, orçamento e lançamentos funcionam sem tratamento especial.

CREATE TABLE subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  card_id      INTEGER NOT NULL REFERENCES cards(id)      ON DELETE RESTRICT,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  start_month  TEXT    NOT NULL,
  -- último mês cobrado; NULL = não acaba. Cancelar define este campo.
  end_month    TEXT,
  -- até que mês as cobranças já foram lançadas (mesmo que sem cobrar, por estar encerrada).
  -- Evita recriar uma cobrança que o usuário apagou e cobrar duas vezes no mesmo mês.
  billed_through TEXT
);

-- Excluir a assinatura mantém as cobranças já lançadas na fatura (viram compras comuns).
ALTER TABLE card_purchases
  ADD COLUMN subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;

-- No máximo uma cobrança por assinatura por mês. Compras comuns (NULL) não entram na regra.
CREATE UNIQUE INDEX idx_card_purchases_subscription
  ON card_purchases(subscription_id, substr(purchase_date, 1, 7));
