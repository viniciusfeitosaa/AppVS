import { parseValorBRL, formatValorBRL } from './parse-nf-tabela.util';

export type DemonstrativoLinhaTrabalho = {
  local: string;
  valor: string;
};

export type DemonstrativoDestinatarioParsed = {
  nome: string;
  email: string;
  linhas: DemonstrativoLinhaTrabalho[];
  total: number;
};

export type DemonstrativoLinhaIgnorada = {
  linha: string;
  motivo: string;
};

export type ParseDemonstrativoTabelaResult = {
  destinatarios: DemonstrativoDestinatarioParsed[];
  ignorados: DemonstrativoLinhaIgnorada[];
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const EMAIL_INVALIDO_REGEX = /e-?mail\s+n[aã]o\s+validado/i;
const RS_REGEX = /R\$\s*[\d.,]+/gi;
/** Valor BR: 1.234,56 ou 1234,56 / 48,00 */
const NUM_MONEY_REGEX = /\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}/g;

function normalizarValorStr(raw: string): string {
  const t = raw.trim();
  if (/^R\$/i.test(t)) {
    return t.replace(/\s+/g, ' ').replace(/R\$\s*/i, 'R$ ');
  }
  const n = parseValorBRL(t.includes('R$') ? t : `R$ ${t}`);
  return formatValorBRL(n);
}

function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Remove horas no final do trecho de local (ex.: "Flex* 48,00" → "Flex*"). */
function limparHorasNoLocal(local: string): string {
  return local
    .replace(/\*\s*\d{1,3}(?:[.,]\d{1,2})?\s*$/i, '*')
    // só remove horários com centésimos (48,00), não sufixos tipo "UPA 1"
    .replace(/\s+\d{1,3},\d{2}\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\t|]+/g, ' ')
    .trim();
}

/**
 * Extrai local + valor da linha (após o e-mail).
 *
 * - Prefere montantes com "R$".
 * - Com 2+ valores "R$": penúltimo = valor da linha; último = total (não entra na soma).
 * - Com 1 "R$": é o valor da linha; texto antes pode incluir horas (removidas do local).
 * - Sem "R$": com 2+ números monetários, penúltimo = valor; senão o único.
 * - Linha só com local/horas (sem valor): retorna null → caller aguarda R$ na linha seguinte.
 */
function extrairLocalEValor(depois: string): { local: string; valorRaw: string } | null {
  const texto = depois.trim();
  if (!texto) return null;

  const rsMatches = [...texto.matchAll(new RegExp(RS_REGEX.source, 'gi'))];
  if (rsMatches.length > 0) {
    const pick = rsMatches.length >= 2 ? rsMatches[rsMatches.length - 2]! : rsMatches[0]!;
    const valorRaw = pick[0];
    const idxFirst = rsMatches[0]!.index ?? 0;
    const local = limparHorasNoLocal(texto.slice(0, idxFirst)) || '—';
    return { local, valorRaw };
  }

  const numMatches = [...texto.matchAll(new RegExp(NUM_MONEY_REGEX.source, 'g'))];
  if (!numMatches.length) return null;

  // Um único número e parece "só horas" com asterisco (estilo NF sem R$ na mesma linha)
  if (numMatches.length === 1 && /\*\s*\d/.test(texto)) {
    return null;
  }

  // valor + total colados sem R$
  const pick = numMatches.length >= 2 ? numMatches[numMatches.length - 2]! : numMatches[numMatches.length - 1]!;
  const valorRaw = pick[0];
  const blockStart =
    numMatches.length >= 2
      ? (numMatches[numMatches.length - 2]!.index ?? 0)
      : (pick.index ?? 0);
  const local = limparHorasNoLocal(texto.slice(0, blockStart)) || '—';
  return { local, valorRaw };
}

export function parseDemonstrativoTabela(texto: string): ParseDemonstrativoTabelaResult {
  const porEmail = new Map<string, DemonstrativoDestinatarioParsed>();
  const ignorados: DemonstrativoLinhaIgnorada[] = [];
  let pendente: { email: string; nome: string; local: string } | null = null;

  for (const raw of texto.split(/\r?\n/)) {
    const linha = raw.trim();
    if (!linha) continue;

    if (EMAIL_INVALIDO_REGEX.test(linha)) {
      pendente = null;
      ignorados.push({ linha, motivo: 'E-mail não validado' });
      continue;
    }

    // Linha só de valor (R$) continuando a produção anterior (estilo NF)
    if (pendente && /^R\$\s*[\d.,]+/i.test(linha) && !EMAIL_REGEX.test(linha)) {
      const m = linha.match(/R\$\s*[\d.,]+/i);
      if (m) {
        adicionarLinha(porEmail, pendente.email, pendente.nome, pendente.local, m[0]);
        pendente = null;
        continue;
      }
    }

    const emailMatch = linha.match(EMAIL_REGEX);
    if (!emailMatch) {
      if (/^R\$\s*[\d.,]+/i.test(linha)) {
        ignorados.push({ linha, motivo: 'Valor sem profissional (e-mail) associado' });
      } else {
        ignorados.push({ linha, motivo: 'E-mail não encontrado' });
      }
      continue;
    }

    const email = emailMatch[0].toLowerCase();
    const emailIdx = linha.indexOf(emailMatch[0]);
    const nome = linha.slice(0, emailIdx).replace(/\s+/g, ' ').trim();
    if (!nome) {
      ignorados.push({ linha, motivo: 'Nome não encontrado' });
      continue;
    }

    const depois = linha.slice(emailIdx + emailMatch[0].length).trim();
    if (!depois) {
      ignorados.push({ linha, motivo: 'Local/valor não encontrados' });
      continue;
    }

    const extraido = extrairLocalEValor(depois);
    if (!extraido) {
      const localSo = limparHorasNoLocal(depois.replace(new RegExp(NUM_MONEY_REGEX.source, 'g'), ''));
      if (localSo) {
        pendente = { email, nome, local: localSo };
      } else {
        ignorados.push({ linha, motivo: 'Valor monetário não encontrado' });
      }
      continue;
    }

    adicionarLinha(porEmail, email, nome, extraido.local, extraido.valorRaw);
    pendente = null;
  }

  if (pendente) {
    ignorados.push({
      linha: `${pendente.nome} <${pendente.email}> ${pendente.local}`,
      motivo: 'Produção sem valor (R$) na linha seguinte',
    });
  }

  const destinatarios = [...porEmail.values()]
    .map((d) => ({
      ...d,
      total: arredondar2(d.total),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { destinatarios, ignorados };
}

function adicionarLinha(
  porEmail: Map<string, DemonstrativoDestinatarioParsed>,
  email: string,
  nome: string,
  local: string,
  valorRaw: string
) {
  const valor = normalizarValorStr(valorRaw);
  const valorNum = arredondar2(parseValorBRL(valor));
  const existente = porEmail.get(email);
  if (!existente) {
    porEmail.set(email, {
      nome,
      email,
      linhas: [{ local, valor }],
      total: valorNum,
    });
  } else {
    if (nome.length > existente.nome.length) existente.nome = nome;
    existente.linhas.push({ local, valor });
    existente.total = arredondar2(existente.total + valorNum);
  }
}

export function formatTotalDemonstrativo(total: number): string {
  return formatValorBRL(total);
}
