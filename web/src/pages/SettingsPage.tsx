import { useEffect, useState, type FormEvent } from 'react';
import { currentMonth } from '../../../shared/dates';
import type { Account, Category, Kind, RecurringRuleRow } from '../../../shared/types';
import { api } from '../api/client';
import { useAccounts, useApiMutation, useCategories, useRecurring } from '../api/hooks';
import {
  Amount, Badge, Button, Card, ColorPicker, ConfirmButton, Dot, Empty, ErrorBox, Field, inputCls, Modal, MoneyField,
  PageHeader, SectionTitle,
} from '../components/ui';
import { brl, centsToInput, monthLabel, parseMoney } from '../lib/format';

type Tab = 'accounts' | 'categories' | 'recurring';

const TABS: { id: Tab; label: string }[] = [
  { id: 'accounts', label: 'Contas' },
  { id: 'categories', label: 'Categorias' },
  { id: 'recurring', label: 'Recorrências' },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('accounts');

  return (
    <>
      <PageHeader title="Cadastros" subtitle="Suas contas, tipos de gasto e lançamentos que se repetem todo mês." />

      <div className="mb-5 inline-flex rounded-lg bg-slate-200/70 p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts' && <AccountsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'recurring' && <RecurringTab />}
    </>
  );
}

// ---- contas -------------------------------------------------------------------------

function AccountsTab() {
  const accounts = useAccounts();
  const [editing, setEditing] = useState<Account | 'new' | null>(null);

  return (
    <>
      <SectionTitle aside={<Button small onClick={() => setEditing('new')}>+ Nova conta</Button>}>Contas</SectionTitle>
      <ErrorBox error={accounts.error} />
      <Card className="p-0">
        <ul className="divide-y divide-slate-100">
          {accounts.data?.map((a) => (
            <li key={a.id} className="flex items-center gap-4 px-5 py-3.5">
              <span className="flex-1 font-medium text-slate-900">{a.name}</span>
              <Amount text={brl(a.balance_cents)} tone={a.balance_cents < 0 ? 'expense' : 'neutral'} />
              <Button small variant="ghost" onClick={() => setEditing(a)}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        O saldo de cada conta é calculado: saldo inicial + receitas − gastos − faturas pagas − dinheiro guardado em caixinhas.
      </p>
      {editing && <AccountModal account={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function AccountModal({ account, onClose }: { account?: Account; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? '');
  const [initial, setInitial] = useState(account ? centsToInput(account.initial_balance_cents) : '0,00');
  const [formError, setFormError] = useState('');

  const save = useApiMutation((body: object) => (account ? api.put(`/accounts/${account.id}`, body) : api.post('/accounts', body)));
  const remove = useApiMutation(() => api.delete(`/accounts/${account!.id}`));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const initial_balance_cents = parseMoney(initial) ?? NaN;
    if (!name.trim()) return setFormError('Informe o nome da conta.');
    if (Number.isNaN(initial_balance_cents)) return setFormError('Saldo inicial inválido.');
    save.mutate({ name: name.trim(), initial_balance_cents }, { onSuccess: onClose });
  };

  return (
    <Modal title={account ? 'Editar conta' : 'Nova conta'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nome">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Carteira, Poupança" autoFocus />
        </Field>
        <MoneyField label="Saldo inicial" value={initial} onChange={setInitial} hint="Quanto você tinha nesta conta quando começou a usar o sistema." />
        <ErrorBox error={formError || save.error || remove.error} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>{account && <ConfirmButton small={false} label="Excluir conta" onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })} />}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ---- categorias ------------------------------------------------------------------------

function CategoriesTab() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CategoryColumn kind="expense" title="Tipos de gasto" />
      <CategoryColumn kind="income" title="Tipos de receita" />
    </div>
  );
}

function CategoryColumn({ kind, title }: { kind: Kind; title: string }) {
  const categories = useCategories(kind);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  return (
    <div>
      <SectionTitle aside={<Button small onClick={() => setEditing('new')}>+ Nova</Button>}>{title}</SectionTitle>
      <ErrorBox error={categories.error} />
      <Card className="p-0">
        {categories.data?.length ? (
          <ul className="divide-y divide-slate-100">
            {categories.data.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <Dot color={c.color} />
                <span className="flex-1 text-sm font-medium text-slate-800">{c.name}</span>
                <Button small variant="ghost" onClick={() => setEditing(c)}>
                  Editar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <Empty>Nenhuma categoria.</Empty>
          </div>
        )}
      </Card>
      {editing && <CategoryModal kind={kind} category={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryModal({ kind, category, onClose }: { kind: Kind; category?: Category; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? '#6366f1');
  const [formError, setFormError] = useState('');

  const save = useApiMutation((body: object) => (category ? api.put(`/categories/${category.id}`, body) : api.post('/categories', body)));
  const remove = useApiMutation(() => api.delete(`/categories/${category!.id}`));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) return setFormError('Informe o nome.');
    save.mutate({ name: name.trim(), kind, color }, { onSuccess: onClose });
  };

  return (
    <Modal title={category ? 'Editar categoria' : kind === 'expense' ? 'Novo tipo de gasto' : 'Novo tipo de receita'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nome">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'expense' ? 'Ex.: Assinaturas, Pets, Academia' : 'Ex.: Freela, Reembolso'} autoFocus />
        </Field>
        <ColorPicker value={color} onChange={setColor} />
        <ErrorBox error={formError || save.error || remove.error} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>{category && <ConfirmButton small={false} label="Excluir" onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })} />}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ---- recorrências ------------------------------------------------------------------------

function RecurringTab() {
  const rules = useRecurring();
  const [editing, setEditing] = useState<RecurringRuleRow | 'new' | null>(null);

  return (
    <>
      <SectionTitle aside={<Button small onClick={() => setEditing('new')}>+ Nova recorrência</Button>}>Lançamentos que se repetem todo mês</SectionTitle>
      <ErrorBox error={rules.error} />
      {rules.data?.length ? (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {rules.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <span className="w-16 shrink-0 text-xs text-slate-400">dia {r.day_of_month}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.description}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    <Dot color={r.category_color} /> {r.category_name} · {r.account_name} · desde {monthLabel(r.start_month)}
                    {r.end_month && <Badge>até {monthLabel(r.end_month)}</Badge>}
                  </p>
                </div>
                <Amount text={`${r.type === 'income' ? '+' : '−'} ${brl(r.amount_cents)}`} tone={r.type} />
                <Button small variant="ghost" onClick={() => setEditing(r)}>
                  Editar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty>Cadastre seu salário, aluguel, assinaturas… O sistema lança todo mês e usa isso na projeção.</Empty>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Ao criar, os meses passados desde o início já são lançados. Editar vale só daqui pra frente; apagar uma recorrência mantém os lançamentos que ela já gerou.
      </p>
      {editing && <RecurringModal rule={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function RecurringModal({ rule, onClose }: { rule?: RecurringRuleRow; onClose: () => void }) {
  const accounts = useAccounts();
  const [type, setType] = useState<Kind>(rule?.type ?? 'expense');
  const categories = useCategories(type);
  const [description, setDescription] = useState(rule?.description ?? '');
  const [amount, setAmount] = useState(rule ? centsToInput(rule.amount_cents) : '');
  const [day, setDay] = useState(String(rule?.day_of_month ?? 5));
  const [accountId, setAccountId] = useState(rule ? String(rule.account_id) : '');
  const [categoryId, setCategoryId] = useState(rule ? String(rule.category_id) : '');
  const [startMonth, setStartMonth] = useState(rule?.start_month ?? currentMonth());
  const [endMonth, setEndMonth] = useState(rule?.end_month ?? '');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!accountId && accounts.data?.[0]) setAccountId(String(accounts.data[0].id));
  }, [accounts.data, accountId]);

  const save = useApiMutation((body: object) => (rule ? api.put(`/recurring/${rule.id}`, body) : api.post('/recurring', body)));
  const remove = useApiMutation(() => api.delete(`/recurring/${rule!.id}`));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const amount_cents = parseMoney(amount);
    if (!description.trim()) return setFormError('Informe uma descrição.');
    if (!amount_cents || amount_cents <= 0) return setFormError('Informe um valor maior que zero.');
    if (!categoryId) return setFormError('Escolha uma categoria.');
    save.mutate(
      {
        type,
        account_id: Number(accountId),
        category_id: Number(categoryId),
        amount_cents,
        description: description.trim(),
        day_of_month: Number(day),
        start_month: startMonth,
        end_month: endMonth || null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal title={rule ? 'Editar recorrência' : 'Nova recorrência'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Tipo">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={type === k}
              onClick={() => {
                setType(k);
                setCategoryId('');
              }}
              className={`rounded-md py-1.5 text-sm font-medium transition ${type === k ? 'bg-white shadow-sm ' + (k === 'expense' ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-500'}`}
            >
              {k === 'expense' ? 'Gasto fixo' : 'Receita fixa'}
            </button>
          ))}
        </div>
        <Field label="Descrição">
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Salário, Aluguel, Netflix" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Valor" value={amount} onChange={setAmount} />
          <Field label="Dia do mês" hint="31 em mês curto vira o último dia.">
            <input className={inputCls} type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
        </div>
        <Field label={type === 'income' ? 'Cai na conta' : 'Sai da conta'}>
          <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Categoria">
          <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Selecione…</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Começa em">
            <input className={inputCls} type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} required />
          </Field>
          <Field label="Termina em (opcional)">
            <input className={inputCls} type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
          </Field>
        </div>
        <ErrorBox error={formError || save.error || remove.error} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>{rule && <ConfirmButton small={false} label="Excluir" onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })} />}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
