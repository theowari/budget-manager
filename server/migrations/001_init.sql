-- Valores monetários sempre em centavos (INTEGER). Datas 'YYYY-MM-DD', meses 'YYYY-MM'.

CREATE TABLE accounts (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT    NOT NULL,
  initial_balance_cents INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL,
  kind  TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  color TEXT NOT NULL DEFAULT '#64748b',
  UNIQUE (name, kind)
);

CREATE TABLE recurring_rules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  account_id   INTEGER NOT NULL REFERENCES accounts(id)   ON DELETE RESTRICT,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  description  TEXT    NOT NULL,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  start_month  TEXT    NOT NULL,
  end_month    TEXT,
  -- até que data os lançamentos já foram gerados; evita recriar um lançamento que o usuário apagou
  last_materialized TEXT
);

CREATE TABLE transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   INTEGER NOT NULL REFERENCES accounts(id)   ON DELETE RESTRICT,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type         TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  date         TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  recurring_id INTEGER REFERENCES recurring_rules(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  -- impede gerar duas vezes o mesmo lançamento de uma regra recorrente
  UNIQUE (recurring_id, date)
);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_account ON transactions(account_id);

CREATE TABLE cards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  limit_cents   INTEGER NOT NULL CHECK (limit_cents >= 0),
  closing_day   INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day       INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  color         TEXT    NOT NULL DEFAULT '#7c3aed'
);

CREATE TABLE card_purchases (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id       INTEGER NOT NULL REFERENCES cards(id)      ON DELETE RESTRICT,
  category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description   TEXT    NOT NULL DEFAULT '',
  total_cents   INTEGER NOT NULL CHECK (total_cents > 0),
  installments  INTEGER NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 60),
  purchase_date TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE card_charges (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id      INTEGER NOT NULL REFERENCES card_purchases(id) ON DELETE CASCADE,
  card_id          INTEGER NOT NULL REFERENCES cards(id)          ON DELETE RESTRICT,
  installment_no   INTEGER NOT NULL,
  amount_cents     INTEGER NOT NULL CHECK (amount_cents > 0),
  invoice_month    TEXT    NOT NULL, -- fatura em que a parcela cai
  competence_month TEXT    NOT NULL, -- mês de "gasto" (orçamento/relatórios)
  UNIQUE (purchase_id, installment_no)
);
CREATE INDEX idx_card_charges_invoice ON card_charges(card_id, invoice_month);
CREATE INDEX idx_card_charges_competence ON card_charges(competence_month);

CREATE TABLE invoice_payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id       INTEGER NOT NULL REFERENCES cards(id)    ON DELETE RESTRICT,
  account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  invoice_month TEXT    NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_date     TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(card_id, invoice_month);

CREATE TABLE goals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  target_cents INTEGER NOT NULL CHECK (target_cents > 0),
  deadline     TEXT,
  color        TEXT    NOT NULL DEFAULT '#0ea5e9'
);

-- depósito = positivo (sai da conta), resgate = negativo (volta pra conta).
-- Excluir a caixinha apaga os movimentos, então o dinheiro volta ao saldo da conta.
CREATE TABLE goal_movements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id      INTEGER NOT NULL REFERENCES goals(id)    ON DELETE CASCADE,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents <> 0),
  date         TEXT    NOT NULL,
  note         TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_goal_movements_goal ON goal_movements(goal_id);

CREATE TABLE budgets (
  category_id        INTEGER PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  monthly_limit_cents INTEGER NOT NULL CHECK (monthly_limit_cents > 0)
);

-- Dados iniciais
INSERT INTO accounts (name, initial_balance_cents) VALUES ('Conta principal', 0);

INSERT INTO categories (name, kind, color) VALUES
  ('Alimentação',    'expense', '#f97316'),
  ('Jogos',          'expense', '#8b5cf6'),
  ('Entretenimento', 'expense', '#ec4899'),
  ('Transporte',     'expense', '#0ea5e9'),
  ('Moradia',        'expense', '#14b8a6'),
  ('Saúde',          'expense', '#ef4444'),
  ('Outros',         'expense', '#64748b'),
  ('Salário',        'income',  '#22c55e'),
  ('Outros',         'income',  '#84cc16');
