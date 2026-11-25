import { Router } from 'express';
import { z } from 'zod';
import { run, type Db } from '../db';
import { idParam, notFound } from '../http';
import { getAccount, listAccounts } from '../queries';

const accountBody = z.object({
  name: z.string().trim().min(1, 'informe o nome').max(60),
  initial_balance_cents: z.number().int().default(0),
});

export function accountsRouter(db: Db): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    res.json(listAccounts(db));
  });

  r.post('/', (req, res) => {
    const body = accountBody.parse(req.body);
    const { id } = run(db, 'INSERT INTO accounts (name, initial_balance_cents) VALUES (?, ?)', body.name, body.initial_balance_cents);
    res.status(201).json(getAccount(db, id));
  });

  r.put('/:id', (req, res) => {
    const id = idParam(req.params.id);
    const body = accountBody.parse(req.body);
    const { changes } = run(db, 'UPDATE accounts SET name = ?, initial_balance_cents = ? WHERE id = ?', body.name, body.initial_balance_cents, id);
    if (!changes) throw notFound('Conta');
    res.json(getAccount(db, id));
  });

  // Conta com lançamentos/pagamentos/caixinhas não pode ser removida (FK → 409).
  r.delete('/:id', (req, res) => {
    const { changes } = run(db, 'DELETE FROM accounts WHERE id = ?', idParam(req.params.id));
    if (!changes) throw notFound('Conta');
    res.status(204).end();
  });

  return r;
}
