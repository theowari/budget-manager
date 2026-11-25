import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, type Db } from '../db';
import { HttpError, idParam, notFound, zColor } from '../http';

export interface CategoryRow {
  id: number;
  name: string;
  kind: 'expense' | 'income';
  color: string;
}

const categoryBody = z.object({
  name: z.string().trim().min(1, 'informe o nome').max(40),
  kind: z.enum(['expense', 'income']),
  color: zColor.default('#64748b'),
});

/** Garante que a categoria existe e é do tipo certo (gasto/receita). */
export function assertCategory(db: Db, id: number, kind: 'expense' | 'income'): CategoryRow {
  const cat = get<CategoryRow>(db, 'SELECT * FROM categories WHERE id = ?', id);
  if (!cat) throw new HttpError(400, 'Categoria não encontrada');
  if (cat.kind !== kind) {
    throw new HttpError(400, `A categoria "${cat.name}" é de ${cat.kind === 'expense' ? 'gasto' : 'receita'}`);
  }
  return cat;
}

export function categoriesRouter(db: Db): Router {
  const r = Router();

  r.get('/', (req, res) => {
    const kind = z.enum(['expense', 'income']).optional().parse(req.query.kind);
    const rows = kind
      ? all<CategoryRow>(db, 'SELECT * FROM categories WHERE kind = ? ORDER BY name', kind)
      : all<CategoryRow>(db, 'SELECT * FROM categories ORDER BY kind, name');
    res.json(rows);
  });

  r.post('/', (req, res) => {
    const b = categoryBody.parse(req.body);
    const { id } = run(db, 'INSERT INTO categories (name, kind, color) VALUES (?, ?, ?)', b.name, b.kind, b.color);
    res.status(201).json(get(db, 'SELECT * FROM categories WHERE id = ?', id));
  });

  r.put('/:id', (req, res) => {
    const id = idParam(req.params.id);
    const b = categoryBody.parse(req.body);
    const current = get<CategoryRow>(db, 'SELECT * FROM categories WHERE id = ?', id);
    if (!current) throw notFound('Categoria');
    if (current.kind !== b.kind) throw new HttpError(400, 'Não é possível trocar o tipo (gasto/receita) de uma categoria');
    run(db, 'UPDATE categories SET name = ?, color = ? WHERE id = ?', b.name, b.color, id);
    res.json(get(db, 'SELECT * FROM categories WHERE id = ?', id));
  });

  r.delete('/:id', (req, res) => {
    const id = idParam(req.params.id);
    try {
      const { changes } = run(db, 'DELETE FROM categories WHERE id = ?', id);
      if (!changes) throw notFound('Categoria');
    } catch (err) {
      if (err instanceof Error && /FOREIGN KEY/i.test(err.message)) {
        throw new HttpError(409, 'Esta categoria já tem lançamentos e não pode ser removida.');
      }
      throw err;
    }
    res.status(204).end();
  });

  return r;
}
