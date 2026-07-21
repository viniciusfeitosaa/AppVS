/** Normaliza telefone BR para dígitos com DDI 55. Retorna null se inválido. */
export function normalizePhoneE164Br(telefone: string | null | undefined): string | null {
  if (!telefone || typeof telefone !== 'string') return null;
  const digits = telefone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCountry =
    digits.length === 10 || digits.length === 11
      ? '55' + digits
      : digits.startsWith('55')
        ? digits
        : '55' + digits;
  return withCountry.length >= 12 ? withCountry : null;
}
