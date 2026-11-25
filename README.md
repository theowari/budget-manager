# Financeiro

Sistema pessoal de gestão financeira: gastos e receitas, vários cartões de crédito (com parcelas e faturas), categorias criadas por você, caixinhas de economia com metas, orçamento por categoria e projeção de saldo.

Roda **só na sua máquina**, sem login. Os dados ficam num arquivo SQLite em `data/financeiro.db` (fora do git).

## Como usar

Requer Node 24 ou superior.

```bash
npm install

# desenvolvimento (API na 3001 + front na 5173, com recarga automática)
npm run dev          # abra http://localhost:5173

# uso do dia a dia (tudo na porta 3001)
npm run build
npm start            # abra http://localhost:3001
```

Variáveis opcionais: `PORT` (padrão 3001) e `FINANCEIRO_DB` (caminho do arquivo do banco).

**Backup:** copie o arquivo `data/financeiro.db` (com o app parado).

## Primeiros passos

1. **Cadastros → Contas:** edite a “Conta principal” e informe o saldo inicial.
2. **Cartões:** cadastre cada cartão com limite, dia de fechamento e dia de vencimento.
3. **Lançamentos:** registre gastos e receitas. Em “Pago com” escolha uma conta ou um cartão (e as parcelas).
4. **Cadastros → Recorrências:** salário, aluguel, assinaturas. Alimentam a projeção.
5. **Orçamento** e **Caixinhas:** defina limites por categoria e objetivos de economia.

## Como os números são calculados

- **Saldo da conta** = saldo inicial + receitas − gastos − faturas pagas − dinheiro guardado em caixinhas.
- **Patrimônio** = saldo das contas + valor nas caixinhas.
- **Fatura do cartão:** compra até o dia de fechamento (inclusive) cai na fatura do mês; depois, na seguinte. A parcela *n* cai *n−1* meses depois. Pagar a fatura sai da conta, mas **não** conta como novo gasto: o gasto já foi contado na compra.
- **Gasto por categoria (orçamento e resumo):** cada parcela de cartão conta no mês da própria parcela.
- **Limite usado** = tudo que ainda falta pagar nas faturas, incluindo parcelas futuras.
- **Projeção:** parte do saldo de hoje e soma recorrências e faturas pendentes (no mês do vencimento). Não inclui gastos variáveis ainda não lançados.

## Desenvolvimento

```bash
npm test            # testes de domínio e da API (SQLite em memória)
npm run typecheck
```

- `server/` API Express + SQLite (`node:sqlite`), regras puras em `server/domain/`, migrações em `server/migrations/`.
- `web/` front React + Vite + Tailwind.
- `shared/` tipos e helpers de data usados pelos dois lados.
