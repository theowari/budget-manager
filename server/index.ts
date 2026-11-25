import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { openDb } from './db';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const dbPath = process.env.FINANCEIRO_DB ?? `${ROOT}data/financeiro.db`;
const port = Number(process.env.PORT ?? 3001);

const db = openDb(dbPath);

const webDir = `${ROOT}dist/web`;
const serveWeb = process.env.NODE_ENV === 'production';
if (serveWeb && !existsSync(`${webDir}/index.html`)) {
  console.error('dist/web não existe. Rode "npm run build" antes de "npm start".');
  process.exit(1);
}

const app = createApp(db, serveWeb ? { staticDir: webDir } : {});

// Só na máquina local: o sistema não tem login.
app.listen(port, '127.0.0.1', () => {
  console.log(`Financeiro rodando em http://localhost:${port}`);
  console.log(`Banco de dados: ${dbPath}`);
});
