import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { DATE_RE, MONTH_RE } from '../shared/dates';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} não encontrado(a)`);

// ---- schemas reutilizáveis -------------------------------------------------

export const zMonth = z.string().regex(MONTH_RE, 'mês inválido (use AAAA-MM)');
export const zDate = z.string().regex(DATE_RE, 'data inválida (use AAAA-MM-DD)');
export const zCents = z.number().int().positive('o valor deve ser maior que zero');
export const zId = z.coerce.number().int().positive();
/** Referência (id) vinda no corpo JSON, sem coerção. */
export const zRef = z.number().int().positive();
export const zColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'cor inválida (use #RRGGBB)');
export const zDay = z.number().int().min(1).max(31);

/** Lê o :id da rota. */
export function idParam(raw: unknown): number {
  return zId.parse(raw);
}

// ---- tratamento de erros ---------------------------------------------------

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof z.ZodError) {
    const message = err.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
    res.status(400).json({ error: message });
    return;
  }
  // node:sqlite lança Error com errcode; FOREIGN KEY e UNIQUE viram 409 amigável
  const msg = err instanceof Error ? err.message : '';
  if (/FOREIGN KEY constraint failed/i.test(msg)) {
    res.status(409).json({ error: 'Este item está em uso por outros registros e não pode ser removido.' });
    return;
  }
  if (/UNIQUE constraint failed/i.test(msg)) {
    res.status(409).json({ error: 'Já existe um registro com esses dados.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
};
