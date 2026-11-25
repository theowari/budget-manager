import express, { type Express } from 'express';
import { join } from 'node:path';
import type { Db } from './db';
import { errorHandler, HttpError } from './http';
import { todayISO, type ISODate } from '../shared/dates';
import { accountsRouter } from './routes/accounts';
import { budgetsRouter } from './routes/budgets';
import { cardsRouter } from './routes/cards';
import { categoriesRouter } from './routes/categories';
import { dashboardRouter } from './routes/dashboard';
import { entriesRouter } from './routes/entries';
import { goalsRouter } from './routes/goals';
import { projectionRouter } from './routes/projection';
import { recurringRouter } from './routes/recurring';

export interface AppOptions {
  /** "Hoje" injetável, pra testes determinísticos. */
  today?: () => ISODate;
  /** Pasta do front compilado; se informada, é servida junto com a API. */
  staticDir?: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function createApp(db: Db, opts: AppOptions = {}): Express {
  const today = opts.today ?? (() => todayISO());
  const app = express();

  // Sem login: só aceita requisições dirigidas a localhost (barra DNS rebinding).
  app.use((req, _res, next) => {
    const hostname = (req.headers.host ?? '').replace(/:\d+$/, '');
    next(LOCAL_HOSTS.has(hostname) ? undefined : new HttpError(403, 'Acesso permitido apenas via localhost'));
  });
  app.use(express.json());

  app.use('/api/accounts', accountsRouter(db));
  app.use('/api/categories', categoriesRouter(db));
  app.use('/api/cards', cardsRouter(db, today));
  app.use('/api/goals', goalsRouter(db, today));
  app.use('/api/budgets', budgetsRouter(db));
  app.use('/api/recurring', recurringRouter(db, today));
  app.use('/api/projection', projectionRouter(db, today));
  app.use('/api/dashboard', dashboardRouter(db, today));
  app.use('/api', entriesRouter(db)); // /entries, /transactions/:id, /card-purchases/:id
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Rota não encontrada')));

  if (opts.staticDir) {
    const dir = opts.staticDir;
    app.use(express.static(dir));
    // SPA: qualquer rota fora de /api devolve o index.html
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(dir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
