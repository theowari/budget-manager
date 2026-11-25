import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { openDb } from './db';

const TODAY = '2026-11-24';

let api: ReturnType<typeof request>;

beforeEach(() => {
  const db = openDb(':memory:');
  api = request(createApp(db, { today: () => TODAY }));
});

// ---- helpers ---------------------------------------------------------------

async function categoryId(name: string, kind: 'expense' | 'income' = 'expense'): Promise<number> {
  const { body } = await api.get('/api/categories').query({ kind });
  return body.find((c: { name: string }) => c.name === name).id;
}

async function mainAccountId(): Promise<number> {
  const { body } = await api.get('/api/accounts');
  return body[0].id;
}

async function balance(): Promise<number> {
  const { body } = await api.get('/api/accounts');
  return body[0].balance_cents;
}

async function createCard(over: Record<string, unknown> = {}) {
  const { body } = await api
    .post('/api/cards')
    .send({ name: 'Nubank', limit_cents: 1000_00, closing_day: 15, due_day: 22, ...over })
    .expect(201);
  return body as { id: number };
}

async function setInitialBalance(cents: number) {
  const id = await mainAccountId();
  await api.put(`/api/accounts/${id}`).send({ name: 'Conta principal', initial_balance_cents: cents }).expect(200);
}

async function buyOnCard(cardId: number, over: Record<string, unknown> = {}) {
  return api
    .post('/api/entries')
    .send({
      method: 'card',
      card_id: cardId,
      category_id: await categoryId('Jogos'),
      total_cents: 100_00,
      installments: 3,
      date: '2026-11-10',
      description: 'Jogo na Steam',
      ...over,
    })
    .expect(201);
}

// ---- contas, categorias e lançamentos diretos ---------------------------------

describe('contas e lançamentos diretos', () => {
  it('já vem com a conta principal e categorias padrão', async () => {
    const { body: accounts } = await api.get('/api/accounts').expect(200);
    expect(accounts).toHaveLength(1);
    const { body: expense } = await api.get('/api/categories').query({ kind: 'expense' });
    expect(expense.map((c: { name: string }) => c.name)).toEqual(
      expect.arrayContaining(['Alimentação', 'Jogos', 'Entretenimento']),
    );
  });

  it('o saldo reflete saldo inicial + receitas − gastos', async () => {
    await setInitialBalance(500_00);
    const account_id = await mainAccountId();
    await api.post('/api/entries').send({ method: 'account', type: 'income', account_id, category_id: await categoryId('Salário', 'income'), amount_cents: 3000_00, date: '2026-11-05' }).expect(201);
    await api.post('/api/entries').send({ method: 'account', type: 'expense', account_id, category_id: await categoryId('Alimentação'), amount_cents: 120_50, date: '2026-11-06' }).expect(201);
    expect(await balance()).toBe(500_00 + 3000_00 - 120_50);
  });

  it('o usuário cria categorias próprias e lança gasto nelas', async () => {
    const { body: cat } = await api.post('/api/categories').send({ name: 'Streaming', kind: 'expense', color: '#ff0000' }).expect(201);
    await api.post('/api/entries').send({ method: 'account', type: 'expense', account_id: await mainAccountId(), category_id: cat.id, amount_cents: 39_90, date: '2026-11-02' }).expect(201);
    const { body: list } = await api.get('/api/entries').query({ month: '2026-11' });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ category_name: 'Streaming', amount_cents: 39_90, kind: 'transaction' });
  });

  it('recusa categoria de receita num gasto (400)', async () => {
    const res = await api.post('/api/entries').send({ method: 'account', type: 'expense', account_id: await mainAccountId(), category_id: await categoryId('Salário', 'income'), amount_cents: 10_00, date: '2026-11-02' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/receita/);
  });

  it('recusa valor zero e data inválida (400)', async () => {
    const base = { method: 'account', type: 'expense', account_id: await mainAccountId(), category_id: await categoryId('Jogos') };
    await api.post('/api/entries').send({ ...base, amount_cents: 0, date: '2026-11-02' }).expect(400);
    await api.post('/api/entries').send({ ...base, amount_cents: 10_00, date: '02/11/2026' }).expect(400);
  });

  it('categoria com lançamentos não pode ser excluída (409)', async () => {
    const category_id = await categoryId('Jogos');
    await api.post('/api/entries').send({ method: 'account', type: 'expense', account_id: await mainAccountId(), category_id, amount_cents: 10_00, date: '2026-11-02' });
    await api.delete(`/api/categories/${category_id}`).expect(409);
  });

  it('rejeita requisições com Host que não é localhost (403)', async () => {
    await api.get('/api/accounts').set('Host', 'evil.example.com').expect(403);
  });
});

// ---- cartão de crédito -----------------------------------------------------------

describe('cartão de crédito', () => {
  it('compra de 100,00 em 3x gera 3 parcelas em faturas consecutivas e consome o limite', async () => {
    const card = await createCard();
    const res = await buyOnCard(card.id);
    expect(res.body.installments).toHaveLength(3);

    const invoices = await Promise.all(['2026-11', '2026-12', '2027-01'].map((month) => api.get(`/api/cards/${card.id}/invoice`).query({ month })));
    expect(invoices.map((i) => i.body.total_cents)).toEqual([33_34, 33_33, 33_33]);
    expect(invoices[0]!.body.items[0]).toMatchObject({ installment_no: 1, installments: 3, description: 'Jogo na Steam' });

    const { body: cards } = await api.get('/api/cards');
    expect(cards[0]).toMatchObject({ used_cents: 100_00, available_cents: 900_00 });
  });

  it('compra depois do fechamento cai na fatura seguinte', async () => {
    const card = await createCard();
    await buyOnCard(card.id, { date: '2026-11-16', installments: 1 });
    const nov = await api.get(`/api/cards/${card.id}/invoice`).query({ month: '2026-11' });
    const dec = await api.get(`/api/cards/${card.id}/invoice`).query({ month: '2026-12' });
    expect(nov.body.total_cents).toBe(0);
    expect(nov.body.status).toBe('empty');
    expect(dec.body.total_cents).toBe(100_00);
    expect(dec.body.due_date).toBe('2026-12-22');
  });

  it('vários cartões têm faturas e limites independentes', async () => {
    const a = await createCard({ name: 'Nubank' });
    const b = await createCard({ name: 'Itaú', limit_cents: 500_00, closing_day: 5, due_day: 12 });
    await buyOnCard(a.id, { installments: 1, total_cents: 50_00 });
    await buyOnCard(b.id, { installments: 1, total_cents: 80_00 });
    const { body: cards } = await api.get('/api/cards');
    expect(cards.map((c: { name: string; used_cents: number }) => [c.name, c.used_cents])).toEqual([
      ['Nubank', 50_00],
      ['Itaú', 80_00],
    ]);
  });

  it('pagar a fatura tira da conta, libera o limite e NÃO duplica o gasto da categoria', async () => {
    await setInitialBalance(1000_00);
    const card = await createCard();
    await buyOnCard(card.id); // 3x de 33,34 / 33,33 / 33,33
    const account_id = await mainAccountId();

    // a compra no cartão ainda não mexe no saldo da conta
    expect(await balance()).toBe(1000_00);

    await api.post(`/api/cards/${card.id}/invoice/pay`).send({ month: '2026-11', account_id }).expect(201);
    expect(await balance()).toBe(1000_00 - 33_34);

    const invoice = await api.get(`/api/cards/${card.id}/invoice`).query({ month: '2026-11' });
    expect(invoice.body).toMatchObject({ status: 'paid', paid_cents: 33_34, remaining_cents: 0 });

    const { body: cards } = await api.get('/api/cards');
    expect(cards[0].used_cents).toBe(66_66); // só as parcelas que faltam

    // gasto do mês continua 33,34 (a parcela), não 66,68
    const { body: dash } = await api.get('/api/dashboard').query({ month: '2026-11' });
    expect(dash.month_summary.expense_cents).toBe(33_34);
  });

  it('pagamento parcial deixa o restante em aberto; não deixa pagar mais que o devido', async () => {
    const card = await createCard();
    await buyOnCard(card.id, { installments: 1 });
    const account_id = await mainAccountId();
    await api.post(`/api/cards/${card.id}/invoice/pay`).send({ month: '2026-11', account_id, amount_cents: 30_00 }).expect(201);
    const mid = await api.get(`/api/cards/${card.id}/invoice`).query({ month: '2026-11' });
    expect(mid.body).toMatchObject({ remaining_cents: 70_00, paid_cents: 30_00 });
    await api.post(`/api/cards/${card.id}/invoice/pay`).send({ month: '2026-11', account_id, amount_cents: 80_00 }).expect(400);
  });

  it('fatura vencida e não paga aparece como overdue', async () => {
    const card = await createCard();
    await buyOnCard(card.id, { date: '2026-09-10', installments: 1 }); // vence 22/09, hoje é 24/11
    const res = await api.get(`/api/cards/${card.id}/invoice`).query({ month: '2026-09' });
    expect(res.body.status).toBe('overdue');
  });

  it('não exclui compra cuja fatura já tem pagamento; depois de desfazer o pagamento, exclui', async () => {
    const card = await createCard();
    const { body: purchase } = await buyOnCard(card.id, { installments: 1 });
    const account_id = await mainAccountId();
    const { body: payment } = await api.post(`/api/cards/${card.id}/invoice/pay`).send({ month: '2026-11', account_id }).expect(201);

    await api.delete(`/api/card-purchases/${purchase.id}`).expect(409);
    await api.delete(`/api/cards/payments/${payment.id}`).expect(204);
    await api.delete(`/api/card-purchases/${purchase.id}`).expect(204);

    const { body: cards } = await api.get('/api/cards');
    expect(cards[0].used_cents).toBe(0);
  });

  it('gasto no cartão conta na categoria pelo mês de competência (orçamento)', async () => {
    const card = await createCard();
    await buyOnCard(card.id); // 33,34 em nov, 33,33 em dez, 33,33 em jan
    const jogos = await categoryId('Jogos');
    await api.put(`/api/budgets/${jogos}`).send({ monthly_limit_cents: 30_00 }).expect(200);

    const nov = (await api.get('/api/budgets').query({ month: '2026-11' })).body.find((b: { category_id: number }) => b.category_id === jogos);
    expect(nov).toMatchObject({ spent_cents: 33_34, limit_cents: 30_00, over: true });
    const dez = (await api.get('/api/budgets').query({ month: '2026-12' })).body.find((b: { category_id: number }) => b.category_id === jogos);
    expect(dez).toMatchObject({ spent_cents: 33_33, over: true });
  });

  it('cartão com compras não pode ser excluído (409)', async () => {
    const card = await createCard();
    await buyOnCard(card.id);
    await api.delete(`/api/cards/${card.id}`).expect(409);
  });
});

// ---- caixinhas ------------------------------------------------------------------

describe('caixinhas', () => {
  it('guardar tira da conta, resgatar devolve, e o patrimônio não muda', async () => {
    await setInitialBalance(1000_00);
    const account_id = await mainAccountId();
    const { body: goal } = await api.post('/api/goals').send({ name: 'Viagem', target_cents: 2000_00, deadline: '2027-03-31' }).expect(201);

    await api.post(`/api/goals/${goal.id}/movements`).send({ kind: 'deposit', account_id, amount_cents: 400_00 }).expect(201);
    expect(await balance()).toBe(600_00);

    let dash = (await api.get('/api/dashboard')).body;
    expect(dash).toMatchObject({ accounts_total_cents: 600_00, goals_total_cents: 400_00, net_worth_cents: 1000_00 });

    await api.post(`/api/goals/${goal.id}/movements`).send({ kind: 'withdraw', account_id, amount_cents: 150_00 }).expect(201);
    expect(await balance()).toBe(750_00);
    dash = (await api.get('/api/dashboard')).body;
    expect(dash.goals[0]).toMatchObject({ saved_cents: 250_00, percent: 13 });
  });

  it('calcula quanto guardar por mês até o prazo', async () => {
    const { body: goal } = await api.post('/api/goals').send({ name: 'Reserva', target_cents: 1200_00, deadline: '2027-02-28' }).expect(201);
    // nov, dez, jan, fev = 4 meses para juntar 1200,00
    expect(goal.pace).toMatchObject({ months_left: 4, per_month_cents: 300_00 });
  });

  it('não deixa guardar sem saldo nem resgatar mais do que há', async () => {
    await setInitialBalance(100_00);
    const account_id = await mainAccountId();
    const { body: goal } = await api.post('/api/goals').send({ name: 'Moto', target_cents: 5000_00 }).expect(201);
    const tooMuch = await api.post(`/api/goals/${goal.id}/movements`).send({ kind: 'deposit', account_id, amount_cents: 100_01 });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.error).toMatch(/Saldo insuficiente/);

    await api.post(`/api/goals/${goal.id}/movements`).send({ kind: 'deposit', account_id, amount_cents: 50_00 }).expect(201);
    await api.post(`/api/goals/${goal.id}/movements`).send({ kind: 'withdraw', account_id, amount_cents: 50_01 }).expect(409);
  });

  it('excluir a caixinha devolve o dinheiro pra conta', async () => {
    await setInitialBalance(300_00);
    const account_id = await mainAccountId();
    const { body: goal } = await api.post('/api/goals').send({ name: 'Tmp', target_cents: 1000_00 }).expect(201);
    await api.post(`/api/goals/${goal.id}/movements`).send({ kind: 'deposit', account_id, amount_cents: 200_00 }).expect(201);
    expect(await balance()).toBe(100_00);
    await api.delete(`/api/goals/${goal.id}`).expect(204);
    expect(await balance()).toBe(300_00);
  });

  it('não desfaz um depósito que já foi parcialmente resgatado', async () => {
    await setInitialBalance(300_00);
    const account_id = await mainAccountId();
    const { body: goal } = await api.post('/api/goals').send({ name: 'X', target_cents: 1000_00 }).expect(201);
    const { body: dep } = await api.post(`/api/goals/${goal.id}/movements`).send({ kind: 'deposit', account_id, amount_cents: 200_00 });
    await api.post(`/api/goals/${goal.id}/movements`).send({ kind: 'withdraw', account_id, amount_cents: 50_00 }).expect(201);
    await api.delete(`/api/goals/movements/${dep.id}`).expect(409);
  });
});

// ---- orçamento ------------------------------------------------------------------

describe('orçamento', () => {
  it('mostra gasto vs limite por categoria e dispara alerta no dashboard', async () => {
    const account_id = await mainAccountId();
    const alimentacao = await categoryId('Alimentação');
    await api.put(`/api/budgets/${alimentacao}`).send({ monthly_limit_cents: 500_00 }).expect(200);
    await api.post('/api/entries').send({ method: 'account', type: 'expense', account_id, category_id: alimentacao, amount_cents: 450_00, date: '2026-11-03' }).expect(201);

    const { body } = await api.get('/api/budgets').query({ month: '2026-11' });
    const row = body.find((b: { category_id: number }) => b.category_id === alimentacao);
    expect(row).toMatchObject({ limit_cents: 500_00, spent_cents: 450_00, percent: 90, over: false });

    const { body: dash } = await api.get('/api/dashboard');
    expect(dash.budget_alerts).toHaveLength(1);
    expect(dash.budget_alerts[0]).toMatchObject({ name: 'Alimentação', percent: 90 });
  });

  it('só categorias de gasto aceitam orçamento', async () => {
    await api.put(`/api/budgets/${await categoryId('Salário', 'income')}`).send({ monthly_limit_cents: 100_00 }).expect(400);
  });
});

// ---- recorrências e projeção -----------------------------------------------------

describe('recorrências e projeção', () => {
  const rentBody = async () => ({
    type: 'expense',
    account_id: await mainAccountId(),
    category_id: await categoryId('Moradia'),
    amount_cents: 1500_00,
    description: 'Aluguel',
    day_of_month: 10,
    start_month: '2026-09',
  });

  it('gera os lançamentos vencidos ao criar a regra, uma vez por mês', async () => {
    await api.post('/api/recurring').send(await rentBody()).expect(201);
    const sep = await api.get('/api/entries').query({ month: '2026-09' });
    const nov = await api.get('/api/entries').query({ month: '2026-11' });
    expect(sep.body).toHaveLength(1);
    expect(nov.body).toHaveLength(1);
    expect(nov.body[0]).toMatchObject({ description: 'Aluguel', date: '2026-11-10', amount_cents: 1500_00 });
    expect((await api.get('/api/entries').query({ month: '2026-12' })).body).toHaveLength(0);
  });

  it('é idempotente e não recria um lançamento que o usuário apagou', async () => {
    await api.post('/api/recurring').send(await rentBody()).expect(201);
    const sep = await api.get('/api/entries').query({ month: '2026-09' });
    await api.delete(`/api/transactions/${sep.body[0].ref_id}`).expect(204);

    await api.get('/api/dashboard'); // dispara a geração de novo
    await api.get('/api/projection');
    expect((await api.get('/api/entries').query({ month: '2026-09' })).body).toHaveLength(0);
    expect((await api.get('/api/entries').query({ month: '2026-10' })).body).toHaveLength(1);
  });

  it('a projeção usa o saldo de hoje, recorrências e as parcelas futuras do cartão', async () => {
    await setInitialBalance(5000_00);
    const account_id = await mainAccountId();
    await api.post('/api/recurring').send({
      type: 'income', account_id, category_id: await categoryId('Salário', 'income'),
      amount_cents: 4000_00, description: 'Salário', day_of_month: 5, start_month: '2026-11',
    }).expect(201); // dia 5 já passou: entra no saldo hoje
    const salaryToday = 4000_00;

    const card = await createCard({ closing_day: 15, due_day: 22 });
    await buyOnCard(card.id, { total_cents: 300_00, installments: 3, date: '2026-11-20' });
    // fatura de nov já fechou (20 > 15): parcelas caem em dez, jan, fev — vencem 22/dez, 22/jan, 22/fev

    const { body } = await api.get('/api/projection').query({ months: 4 }).expect(200);
    expect(body.start_balance_cents).toBe(5000_00 + salaryToday);
    expect(body.months.map((m: { month: string }) => m.month)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(body.months.map((m: { invoices_cents: number }) => m.invoices_cents)).toEqual([0, 100_00, 100_00, 100_00]);
    // nov: nada novo (salário do mês já está no saldo); dez em diante: +4000 salário − 100 fatura
    expect(body.months.map((m: { balance_cents: number }) => m.balance_cents)).toEqual([
      9000_00,
      9000_00 + 4000_00 - 100_00,
      9000_00 + 2 * (4000_00 - 100_00),
      9000_00 + 3 * (4000_00 - 100_00),
    ]);
    expect(body.first_negative_month).toBeNull();
  });

  it('avisa o primeiro mês em que o saldo fica negativo', async () => {
    await setInitialBalance(100_00);
    const card = await createCard();
    await buyOnCard(card.id, { total_cents: 400_00, installments: 1, date: '2026-11-10' }); // vence 22/11
    const { body } = await api.get('/api/projection').query({ months: 3 });
    expect(body.first_negative_month).toBe('2026-11');
    expect(body.lowest_balance_cents).toBe(-300_00);
  });
});

// ---- assinaturas -------------------------------------------------------------------

describe('assinaturas', () => {
  // "hoje" mutável: simula a passagem do tempo sem recriar o banco
  let now: string;
  beforeEach(() => {
    now = TODAY; // 2026-11-24
    api = request(createApp(openDb(':memory:'), { today: () => now }));
  });

  type Sub = { id: number; next_charge_date: string | null; end_month: string | null };

  async function subscribe(cardId: number, over: Record<string, unknown> = {}) {
    return api.post('/api/subscriptions').send({
      name: 'Spotify',
      card_id: cardId,
      category_id: await categoryId('Entretenimento'),
      amount_cents: 21_90,
      day_of_month: 10,
      start_month: '2026-11',
      ...over,
    });
  }

  async function subscribed(cardId: number, over: Record<string, unknown> = {}): Promise<Sub> {
    const res = await subscribe(cardId, over);
    expect(res.status).toBe(201);
    return res.body;
  }

  /** Cobranças da assinatura lançadas nos lançamentos do mês. */
  async function chargesIn(month: string, subId: number) {
    const { body } = await api.get('/api/entries').query({ month });
    return (body as { subscription_id: number | null; ref_id: number; date: string }[]).filter((e) => e.subscription_id === subId);
  }

  async function invoice(cardId: number, month: string) {
    return (await api.get(`/api/cards/${cardId}/invoice`).query({ month })).body;
  }

  it('lança a cobrança do mês na fatura, à vista, e consome o limite', async () => {
    const card = await createCard();
    const sub = await subscribed(card.id); // dia 10 já passou; fecha dia 15 -> fatura de novembro

    const nov = await invoice(card.id, '2026-11');
    expect(nov.total_cents).toBe(21_90);
    expect(nov.items).toHaveLength(1);
    expect(nov.items[0]).toMatchObject({ description: 'Spotify', installment_no: 1, installments: 1, subscription_id: sub.id });

    const { body: cards } = await api.get('/api/cards');
    expect(cards[0]).toMatchObject({ used_cents: 21_90, available_cents: 1000_00 - 21_90 });
  });

  it('a cobrança conta no orçamento da categoria e nos lançamentos do mês', async () => {
    const card = await createCard();
    const sub = await subscribed(card.id);
    const entretenimento = await categoryId('Entretenimento');

    const budgets = (await api.get('/api/budgets').query({ month: '2026-11' })).body;
    expect(budgets.find((b: { category_id: number }) => b.category_id === entretenimento).spent_cents).toBe(21_90);

    const [entry] = await chargesIn('2026-11', sub.id);
    expect(entry).toMatchObject({ kind: 'card_charge', date: '2026-11-10', amount_cents: 21_90, card_name: 'Nubank' });
  });

  it('só cobra quando o dia chega, e cai na fatura certa pelo fechamento do cartão', async () => {
    const card = await createCard(); // fecha dia 15
    const sub = await subscribed(card.id, { day_of_month: 28 });
    expect(sub.next_charge_date).toBe('2026-11-28');
    expect(await chargesIn('2026-11', sub.id)).toHaveLength(0);

    now = '2026-11-28';
    expect(await chargesIn('2026-11', sub.id)).toHaveLength(1);
    // dia 28 > fechamento 15: a cobrança vai para a fatura de dezembro
    expect((await invoice(card.id, '2026-11')).total_cents).toBe(0);
    expect((await invoice(card.id, '2026-12')).total_cents).toBe(21_90);
  });

  it('não tem fim: cobra todo mês, sem parcelas, até cancelar', async () => {
    const card = await createCard({ limit_cents: 5000_00 });
    const sub = await subscribed(card.id, { start_month: '2026-09' });
    // setembro, outubro e novembro já venceram
    expect((await invoice(card.id, '2026-09')).total_cents).toBe(21_90);
    expect((await invoice(card.id, '2026-10')).total_cents).toBe(21_90);
    expect((await invoice(card.id, '2026-11')).total_cents).toBe(21_90);
    expect((await invoice(card.id, '2026-12')).total_cents).toBe(0);

    // mais de um ano depois, continua cobrando
    now = '2028-02-10';
    expect((await invoice(card.id, '2027-06')).total_cents).toBe(21_90);
    expect((await invoice(card.id, '2028-02')).total_cents).toBe(21_90);
    const { body: cards } = await api.get('/api/cards');
    expect(cards[0].used_cents).toBe(18 * 21_90); // set/2026 .. fev/2028
    expect(sub.end_month).toBeNull();
  });

  it('lança uma vez só por mês, mesmo com várias requisições', async () => {
    const card = await createCard();
    const sub = await subscribed(card.id);
    for (let i = 0; i < 3; i++) {
      await api.get('/api/dashboard');
      await api.get('/api/cards');
      await api.get('/api/projection');
    }
    expect(await chargesIn('2026-11', sub.id)).toHaveLength(1);
    expect((await invoice(card.id, '2026-11')).total_cents).toBe(21_90);
  });

  it('não recria uma cobrança que o usuário apagou', async () => {
    const card = await createCard();
    const sub = await subscribed(card.id, { start_month: '2026-09' });
    const [sep] = await chargesIn('2026-09', sub.id);
    await api.delete(`/api/card-purchases/${sep!.ref_id}`).expect(204);

    await api.get('/api/dashboard');
    expect(await chargesIn('2026-09', sub.id)).toHaveLength(0);
    expect(await chargesIn('2026-10', sub.id)).toHaveLength(1);
  });

  it('dia 31 cai no último dia dos meses curtos', async () => {
    const card = await createCard();
    const sub = await subscribed(card.id, { day_of_month: 31, start_month: '2026-02' });
    const [feb] = await chargesIn('2026-02', sub.id);
    expect(feb).toMatchObject({ date: '2026-02-28' });
    const [mar] = await chargesIn('2026-03', sub.id);
    expect(mar).toMatchObject({ date: '2026-03-31' });
  });

  it('cancelar não cobra mais, mantém o histórico e mostra como encerrada', async () => {
    const card = await createCard({ limit_cents: 5000_00 });
    const sub = await subscribed(card.id, { start_month: '2026-09' });

    const { body: cancelled } = await api.post(`/api/subscriptions/${sub.id}/cancel`).expect(200);
    expect(cancelled).toMatchObject({ end_month: '2026-11', next_charge_date: null });

    now = '2027-03-10';
    expect(await chargesIn('2026-11', sub.id)).toHaveLength(1); // histórico preservado
    for (const m of ['2026-12', '2027-01', '2027-02', '2027-03']) expect(await chargesIn(m, sub.id)).toHaveLength(0);
    const { body: cards } = await api.get('/api/cards');
    expect(cards[0].used_cents).toBe(3 * 21_90);
  });

  it('cancelar antes do dia da cobrança evita a cobrança deste mês', async () => {
    const card = await createCard();
    const sub = await subscribed(card.id, { day_of_month: 28, start_month: '2026-09' }); // nov/28 ainda não chegou
    const { body: cancelled } = await api.post(`/api/subscriptions/${sub.id}/cancel`).expect(200);
    expect(cancelled).toMatchObject({ end_month: '2026-10', next_charge_date: null });

    now = '2026-11-30';
    expect(await chargesIn('2026-11', sub.id)).toHaveLength(0);
    expect(await chargesIn('2026-10', sub.id)).toHaveLength(1);
  });

  it('reativar volta a cobrar da próxima data, sem cobrar os meses em que ficou cancelada', async () => {
    const card = await createCard({ limit_cents: 5000_00 });
    const sub = await subscribed(card.id, { start_month: '2026-09' });
    await api.post(`/api/subscriptions/${sub.id}/cancel`).expect(200); // última cobrança: nov

    now = '2027-01-20'; // passaram dez e jan (dia 10) com a assinatura cancelada
    const { body: back } = await api.post(`/api/subscriptions/${sub.id}/reactivate`).expect(200);
    expect(back).toMatchObject({ end_month: null, next_charge_date: '2027-02-10' });
    expect(await chargesIn('2026-12', sub.id)).toHaveLength(0);
    expect(await chargesIn('2027-01', sub.id)).toHaveLength(0);

    now = '2027-02-10';
    expect(await chargesIn('2027-02', sub.id)).toHaveLength(1);
  });

  it('editar vale daqui pra frente: reajuste não muda cobranças já lançadas', async () => {
    const card = await createCard();
    const sub = await subscribed(card.id);
    const { body: edited } = await api
      .put(`/api/subscriptions/${sub.id}`)
      .send({ name: 'Spotify', card_id: card.id, category_id: await categoryId('Entretenimento'), amount_cents: 29_90, day_of_month: 10, start_month: '2026-11' })
      .expect(200);
    expect(edited.amount_cents).toBe(29_90);

    expect((await invoice(card.id, '2026-11')).total_cents).toBe(21_90); // novembro continua igual
    now = '2026-12-10';
    expect((await invoice(card.id, '2026-12')).total_cents).toBe(29_90);
  });

  it('mudar o dia da cobrança no meio do mês não cobra duas vezes', async () => {
    const card = await createCard();
    const sub = await subscribed(card.id); // cobrou nov/10
    await api
      .put(`/api/subscriptions/${sub.id}`)
      .send({ name: 'Spotify', card_id: card.id, category_id: await categoryId('Entretenimento'), amount_cents: 21_90, day_of_month: 28, start_month: '2026-11' })
      .expect(200);
    now = '2026-11-28';
    expect(await chargesIn('2026-11', sub.id)).toHaveLength(1);
    now = '2026-12-28';
    expect(await chargesIn('2026-12', sub.id)).toHaveLength(1);
  });

  it('excluir a assinatura para de cobrar e mantém as cobranças já lançadas', async () => {
    const card = await createCard();
    const sub = await subscribed(card.id);
    await api.delete(`/api/subscriptions/${sub.id}`).expect(204);
    expect((await api.get('/api/subscriptions')).body).toHaveLength(0);
    expect((await invoice(card.id, '2026-11')).total_cents).toBe(21_90);

    now = '2026-12-10';
    expect((await invoice(card.id, '2026-12')).total_cents).toBe(0);
    await api.delete(`/api/subscriptions/${sub.id}`).expect(404);
  });

  it('a projeção inclui as cobranças futuras, sem contar duas vezes as já lançadas', async () => {
    await setInitialBalance(1000_00);
    const card = await createCard({ closing_day: 15, due_day: 22 });
    await subscribed(card.id, { day_of_month: 10 }); // nov/10 já lançada: fatura de nov venceu dia 22 e está em aberto
    await subscribed(card.id, { name: 'Discord', day_of_month: 28, amount_cents: 10_00 }); // nov/28 ainda vai acontecer

    const { body } = await api.get('/api/projection').query({ months: 4 }).expect(200);
    // nov: fatura vencida do Spotify (21,90) é cobrada no mês atual
    // dez: Spotify dez/10 (21,90) + Discord nov/28 (10,00, fatura de dez)
    // jan: Spotify jan/10 + Discord dez/28 · fev: idem
    expect(body.months.map((m: { invoices_cents: number }) => m.invoices_cents)).toEqual([21_90, 31_90, 31_90, 31_90]);
    expect(body.months.at(-1).balance_cents).toBe(1000_00 - 21_90 - 3 * 31_90);
  });

  it('a projeção não inclui assinatura cancelada', async () => {
    const card = await createCard();
    const sub = await subscribed(card.id, { day_of_month: 28 });
    await api.post(`/api/subscriptions/${sub.id}/cancel`).expect(200);
    const { body } = await api.get('/api/projection').query({ months: 4 });
    expect(body.months.map((m: { invoices_cents: number }) => m.invoices_cents)).toEqual([0, 0, 0, 0]);
  });

  it('valida os dados', async () => {
    const card = await createCard();
    const base = { name: 'X', card_id: card.id, category_id: await categoryId('Entretenimento'), amount_cents: 10_00, day_of_month: 5, start_month: '2026-11' };
    const post = (over: Record<string, unknown>) => api.post('/api/subscriptions').send({ ...base, ...over });

    expect((await post({ category_id: await categoryId('Salário', 'income') })).status).toBe(400); // categoria de receita
    expect((await post({ card_id: 999 })).status).toBe(400);
    expect((await post({ amount_cents: 0 })).status).toBe(400);
    expect((await post({ day_of_month: 32 })).status).toBe(400);
    expect((await post({ name: '  ' })).status).toBe(400);
    expect((await post({ end_month: '2026-10' })).status).toBe(400); // fim antes do início
    const tooOld = await post({ start_month: '2002-01' });
    expect(tooOld.status).toBe(400);
    expect(tooOld.body.error).toMatch(/36 meses/);
    expect((await api.get('/api/subscriptions')).body).toHaveLength(0);
  });

  it('cartão e categoria com assinatura não podem ser excluídos (409)', async () => {
    const card = await createCard();
    await subscribed(card.id, { start_month: '2027-06' }); // ainda sem nenhuma cobrança lançada
    const res = await api.delete(`/api/cards/${card.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/assinaturas/);
    await api.delete(`/api/categories/${await categoryId('Entretenimento')}`).expect(409);
  });

  it('lista com o próximo vencimento de cada assinatura', async () => {
    const card = await createCard();
    await subscribed(card.id, { name: 'Spotify', day_of_month: 10 });
    await subscribed(card.id, { name: 'Discord', day_of_month: 28 });
    const { body } = await api.get('/api/subscriptions').expect(200);
    expect(body.map((s: { name: string; next_charge_date: string }) => [s.name, s.next_charge_date])).toEqual([
      ['Spotify', '2026-12-10'],
      ['Discord', '2026-11-28'],
    ]);
    expect(body[0]).toMatchObject({ card_name: 'Nubank', category_name: 'Entretenimento', amount_cents: 21_90 });
  });
});
