import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownLeftIcon, ArrowUpRightIcon, PlusIcon } from '@phosphor-icons/react';
import { todayISO } from '../../../shared/dates';
import type { Category, Entry, Kind } from '../../../shared/types';
import { api } from '../api/client';
import { useAccounts, useApiMutation, useCards, useCategories } from '../api/hooks';
import { brl, centsToInput, parseMoney } from '../lib/format';
import { Button, ColorPicker, ErrorBox, Field, FormActions, inputCls, Modal, MoneyField, Segmented, Select } from './ui';

interface Props {
  /** Se informado, edita este lançamento (só lançamentos diretos na conta). */
  editing?: Entry;
  /** Valor inicial de "pago com": 'account:ID' ou 'card:ID'. */
  defaultPayWith?: string;
  onClose: () => void;
}

export function EntryForm({ editing, defaultPayWith, onClose }: Props) {
  const accounts = useAccounts();
  const cards = useCards();

  const [type, setType] = useState<Kind>(editing?.type ?? 'expense');
  const [payWith, setPayWith] = useState<string>(
    editing?.account_id ? `account:${editing.account_id}` : (defaultPayWith ?? ''),
  );
  const [amount, setAmount] = useState(editing ? centsToInput(editing.amount_cents) : '');
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [categoryId, setCategoryId] = useState<number | ''>(editing?.category_id ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [installments, setInstallments] = useState('1');
  const [formError, setFormError] = useState('');

  // categoria nova (criação rápida)
  const categories = useCategories(type);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');

  // pré-seleciona a primeira conta quando carregar
  useEffect(() => {
    if (!payWith && accounts.data?.[0]) setPayWith(`account:${accounts.data[0].id}`);
  }, [accounts.data, payWith]);

  // trocar o tipo invalida a categoria escolhida e, para receita, o cartão
  const changeType = (next: Kind) => {
    setType(next);
    setCategoryId('');
    if (next === 'income' && payWith.startsWith('card:') && accounts.data?.[0]) {
      setPayWith(`account:${accounts.data[0].id}`);
    }
  };

  const isCard = payWith.startsWith('card:');
  const installmentCount = Math.max(1, Number.parseInt(installments, 10) || 1);
  const amountCents = parseMoney(amount);

  const perInstallment =
    isCard && amountCents && installmentCount > 1 ? brl(Math.ceil(amountCents / installmentCount)) : null;

  const createCategory = useApiMutation((vars: { name: string; kind: Kind; color: string }) =>
    api.post<Category>('/categories', vars),
  );

  const save = useApiMutation(async () => {
    const [kind, idText] = payWith.split(':');
    const id = Number(idText);
    const base = { category_id: categoryId as number, date, description };
    if (editing) {
      return api.put(`/transactions/${editing.ref_id}`, { ...base, type, account_id: id, amount_cents: amountCents });
    }
    if (kind === 'card') {
      return api.post('/entries', { method: 'card', card_id: id, total_cents: amountCents, installments: installmentCount, ...base });
    }
    return api.post('/entries', { method: 'account', type, account_id: id, amount_cents: amountCents, ...base });
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!amountCents || amountCents <= 0) return setFormError('Informe um valor maior que zero.');
    if (!categoryId) return setFormError('Escolha uma categoria.');
    if (!payWith) return setFormError('Escolha a conta ou o cartão.');
    save.mutate(undefined, { onSuccess: onClose });
  };

  const submitNewCategory = () => {
    if (!newName.trim()) return;
    createCategory.mutate(
      { name: newName.trim(), kind: type, color: newColor },
      {
        onSuccess: (cat) => {
          setCategoryId(cat.id);
          setCreatingCategory(false);
          setNewName('');
        },
      },
    );
  };

  return (
    <Modal title={editing ? 'Editar lançamento' : 'Novo lançamento'} onClose={onClose}>
      <form onSubmit={submit}>
        <Segmented<Kind>
          label="Tipo"
          className="mb-5"
          value={type}
          onChange={changeType}
          options={[
            { value: 'expense', label: 'Gasto', icon: ArrowUpRightIcon, tone: 'expense' },
            { value: 'income', label: 'Receita', icon: ArrowDownLeftIcon, tone: 'income' },
          ]}
        />

        <MoneyField
          large
          label={isCard ? 'Valor total da compra' : 'Valor'}
          value={amount}
          onChange={setAmount}
          autoFocus
          hint={perInstallment ? `${installmentCount}x de aproximadamente ${perInstallment}` : undefined}
        />

        <Field label={type === 'income' ? 'Recebido em' : 'Pago com'}>
          <Select value={payWith} onChange={(e) => setPayWith(e.target.value)} disabled={!!editing}>
            <optgroup label="Contas">
              {accounts.data?.map((a) => (
                <option key={a.id} value={`account:${a.id}`}>
                  {a.name}
                </option>
              ))}
            </optgroup>
            {type === 'expense' && !editing && (cards.data?.length ?? 0) > 0 && (
              <optgroup label="Cartões de crédito">
                {cards.data?.map((c) => (
                  <option key={c.id} value={`card:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>

        {isCard && !editing && (
          <Field label="Parcelas" hint="1 = à vista no cartão. Serviço cobrado todo mês, sem fim (Spotify, Netflix…)? Cadastre em Assinaturas.">
            <input className={inputCls} type="number" min={1} max={60} value={installments} onChange={(e) => setInstallments(e.target.value)} />
          </Field>
        )}

        {creatingCategory ? (
          // fora de um <label>: o bloco tem vários controles
          <div className="mb-4 rounded-xl border border-line bg-surface p-4">
            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Nome da nova categoria</span>
              <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </label>
            <ColorPicker value={newColor} onChange={setNewColor} />
            <ErrorBox error={createCategory.error} />
            <div className="flex gap-2">
              <Button small onClick={submitNewCategory} disabled={createCategory.isPending}>
                Criar categoria
              </Button>
              <Button small variant="ghost" onClick={() => setCreatingCategory(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Categoria">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Selecione…</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button
              variant="secondary"
              className="mb-4 w-11 !px-0"
              onClick={() => setCreatingCategory(true)}
              aria-label="Criar nova categoria"
              title="Nova categoria"
            >
              <PlusIcon aria-hidden size={18} weight="bold" />
            </Button>
          </div>
        )}

        <Field label="Data">
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>

        <Field label="Descrição (opcional)">
          <input className={inputCls} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: almoço, Steam, mercado…" />
        </Field>

        <ErrorBox error={formError || save.error} />

        <FormActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
