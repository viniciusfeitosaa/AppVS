import { EMAIL_CONTATOS } from '../constants/email-contatos.const';

function normalizarNomeBusca(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove sufixo " · CRM …" do rótulo da produção. */
export function nomeProfissionalSemCrm(rotulo: string): string {
  return rotulo.replace(/\s*[·•]\s*CRM\s*.+$/i, '').trim();
}

/**
 * Resolve e-mail do médico a partir do rótulo da produção,
 * lista do corpo clínico e contatos do painel de e-mail.
 */
export function resolverEmailProfissional(
  rotuloMedico: string,
  medicos: { nomeCompleto: string; email: string | null }[]
): string | null {
  const nome = nomeProfissionalSemCrm(rotuloMedico);
  const alvo = normalizarNomeBusca(nome);
  if (!alvo) return null;

  const matchLista = (lista: { nome: string; email: string | null }[]) => {
    const exact = lista.find((m) => normalizarNomeBusca(m.nome) === alvo && m.email);
    if (exact?.email) return exact.email.trim().toLowerCase();
    const partial = lista.find((m) => {
      const n = normalizarNomeBusca(m.nome);
      return m.email && (n.includes(alvo) || alvo.includes(n));
    });
    return partial?.email?.trim().toLowerCase() ?? null;
  };

  const fromCadastro = matchLista(
    medicos.map((m) => ({ nome: m.nomeCompleto, email: m.email }))
  );
  if (fromCadastro) return fromCadastro;

  return matchLista(EMAIL_CONTATOS.map((c) => ({ nome: c.nome, email: c.email })));
}
