import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Db = DatabaseSync;

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url));

/** Abre (ou cria) o banco. Use ':memory:' nos testes. */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  return db;
}

/** Aplica os arquivos NNN_nome.sql ainda não aplicados; a versão fica em PRAGMA user_version. */
function migrate(db: Db): void {
  const current = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const version = Number.parseInt(file.split('_')[0]!, 10);
    if (version <= current) continue;
    const sql = readFileSync(`${MIGRATIONS_DIR}/${file}`, 'utf8');
    transaction(db, () => {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
    });
  }
}

type Param = string | number | bigint | null;

/** SELECT que devolve todas as linhas. */
export function all<T>(db: Db, sql: string, ...params: Param[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

/** SELECT que devolve a primeira linha (ou undefined). */
export function get<T>(db: Db, sql: string, ...params: Param[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

/** INSERT/UPDATE/DELETE. `id` é o rowid do último INSERT. */
export function run(db: Db, sql: string, ...params: Param[]): { changes: number; id: number } {
  const r = db.prepare(sql).run(...params);
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
}

/** Executa fn dentro de uma transação; faz rollback se lançar. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
