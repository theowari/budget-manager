import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Account,
  BudgetRow,
  Card,
  Category,
  Dashboard,
  Entry,
  Goal,
  GoalMovement,
  Invoice,
  Kind,
  Projection,
  RecurringRuleRow,
} from '../../../shared/types';
import type { Month } from '../../../shared/dates';
import { api, qs } from './client';

// ---- leitura ---------------------------------------------------------------

export const useAccounts = () => useQuery({ queryKey: ['accounts'], queryFn: () => api.get<Account[]>('/accounts') });

export const useCategories = (kind?: Kind) =>
  useQuery({ queryKey: ['categories', kind ?? 'all'], queryFn: () => api.get<Category[]>(`/categories${qs({ kind })}`) });

export const useCards = () => useQuery({ queryKey: ['cards'], queryFn: () => api.get<Card[]>('/cards') });

export const useGoals = () => useQuery({ queryKey: ['goals'], queryFn: () => api.get<Goal[]>('/goals') });

export const useGoalMovements = (goalId: number, enabled: boolean) =>
  useQuery({
    queryKey: ['goal-movements', goalId],
    queryFn: () => api.get<GoalMovement[]>(`/goals/${goalId}/movements`),
    enabled,
  });

export const useRecurring = () =>
  useQuery({ queryKey: ['recurring'], queryFn: () => api.get<RecurringRuleRow[]>('/recurring') });

export const useDashboard = (month: Month) =>
  useQuery({ queryKey: ['dashboard', month], queryFn: () => api.get<Dashboard>(`/dashboard${qs({ month })}`) });

export const useBudgets = (month: Month) =>
  useQuery({ queryKey: ['budgets', month], queryFn: () => api.get<BudgetRow[]>(`/budgets${qs({ month })}`) });

export const useProjection = (months: number) =>
  useQuery({ queryKey: ['projection', months], queryFn: () => api.get<Projection>(`/projection${qs({ months })}`) });

export interface EntryFilters {
  month: Month;
  type?: Kind;
  category_id?: number;
  account_id?: number;
  card_id?: number;
}

export const useEntries = (filters: EntryFilters) =>
  useQuery({ queryKey: ['entries', filters], queryFn: () => api.get<Entry[]>(`/entries${qs({ ...filters })}`) });

export const useInvoice = (cardId: number | null, month: Month) =>
  useQuery({
    queryKey: ['invoice', cardId, month],
    queryFn: () => api.get<Invoice>(`/cards/${cardId}/invoice${qs({ month })}`),
    enabled: cardId !== null,
  });

// ---- escrita ---------------------------------------------------------------

/**
 * Mutation genérica. Os dados são todos interligados (um gasto muda saldo,
 * dashboard, orçamento, projeção...), então qualquer escrita invalida tudo.
 */
export function useApiMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries(),
  });
}
