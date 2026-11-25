const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos -> "R$ 1.234,56" (usado em mensagens de erro). */
export function brl(cents: number): string {
  return BRL.format(cents / 100);
}
