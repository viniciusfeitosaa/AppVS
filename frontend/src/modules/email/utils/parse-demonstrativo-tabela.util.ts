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
  /** Nome tentativamente extraído da linha (quando não há e-mail). */
  nome?: string;
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
/** Linha (quase) só com valor monetário, ex.: `R$2.340,00` ou `R$ 2.340,00`. */
const LINHA_SO_RS_REGEX = /^R\$\s*[\d.,]+\s*$/i;
/** Tokens típicos de local/plantão — cortam o nome. */
const LOCAL_TOKEN_REGEX =
  /^(UPA|UPINHA|FLEX|PS|PA|PRONTO|PRONTO-SOCORRO|SAMU|UBS|CAPS|HOSP|HOSPITAL|PLANTAO|PLANTÃO)/i;

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

/**
 * Tenta obter o nome da pessoa em linhas sem e-mail (ex.: "João Silva UPA X R$ 100,00").
 */
export function extrairNomeDeLinhaSemEmail(linha: string): string | undefined {
  const semEmailInvalido = linha.replace(EMAIL_INVALIDO_REGEX, ' ').trim();
  const cutMoney = semEmailInvalido.search(/R\$|\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}/i);
  const head = (cutMoney >= 0 ? semEmailInvalido.slice(0, cutMoney) : semEmailInvalido)
    .replace(/[\t|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!head || head.length < 3) return undefined;

  const words = head.split(' ').filter(Boolean);
  const nameWords: string[] = [];
  for (const w of words) {
    if (LOCAL_TOKEN_REGEX.test(w)) break;
    if (/^\d/.test(w)) break;
    if (!/[A-Za-zÀ-ÿ]/.test(w)) break;
    nameWords.push(w);
    if (nameWords.length >= 6) break;
  }
  const nome = nameWords.join(' ').trim();
  return nome.length >= 3 ? nome : undefined;
}

function pushIgnorado(
  ignorados: DemonstrativoLinhaIgnorada[],
  linha: string,
  motivo: string,
  nomeHint?: string
) {
  const nome = nomeHint || extrairNomeDeLinhaSemEmail(linha);
  ignorados.push(nome ? { linha, motivo, nome } : { linha, motivo });
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

/** Número sem milhar e típico de horas de plantão (não valor em R$). */
function pareceHorasPlantao(raw: string): boolean {
  if (/\.\d{3},/.test(raw)) return false;
  const n = parseValorBRL(`R$ ${raw}`);
  // Ex.: 6,00 … 192,00 no export ISGH; valores em R$ costumam ter milhar ou vir na linha com R$.
  return Number.isFinite(n) && n > 0 && n < 1000;
}

/**
 * Extrai local + valor da linha (após o e-mail).
 *
 * - Prefere montantes com "R$".
 * - Com 2+ valores "R$": penúltimo = valor da linha; último = total (não entra na soma).
 * - Com 1 "R$": é o valor da linha; texto antes pode incluir horas (removidas do local).
 * - Sem "R$":
 *   - 2 números (ex.: `36,00 4.680,00`): típico **horas + valor** → usa o **último** (valor em R$).
 *   - 3+ números: penúltimo = valor da linha; último = total acumulado.
 *   - 1 número que parece horas (ex.: `… Diarista 18,00`): retorna null → aguarda `R$…` na linha seguinte.
 *   - 1 número com milhar: valor da linha.
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

  // Um único número e parece "só horas" (com ou sem asterisco) → valor vem na linha seguinte com R$
  if (numMatches.length === 1 && pareceHorasPlantao(numMatches[0]![0])) {
    return null;
  }

  let pick: RegExpMatchArray;
  let blockStart: number;

  if (numMatches.length === 1) {
    pick = numMatches[0]!;
    blockStart = pick.index ?? 0;
  } else if (numMatches.length === 2) {
    // Planilha: Local | Horas | Valor → o valor é o ÚLTIMO.
    const a = numMatches[0]!;
    const b = numMatches[1]!;
    const aTemMilhar = /\.\d{3},/.test(a[0]);
    const bTemMilhar = /\.\d{3},/.test(b[0]);
    if (!aTemMilhar && bTemMilhar) {
      pick = b;
    } else if (aTemMilhar && !bTemMilhar) {
      pick = a;
    } else {
      const aNum = parseValorBRL(`R$ ${a[0]}`);
      const bNum = parseValorBRL(`R$ ${b[0]}`);
      pick = bNum >= aNum ? b : a;
    }
    blockStart = a.index ?? 0;
  } else {
    // 3+: penúltimo = valor da linha; último = total (não entra na soma)
    pick = numMatches[numMatches.length - 2]!;
    blockStart = pick.index ?? 0;
  }

  const valorRaw = pick[0];
  const local = limparHorasNoLocal(texto.slice(0, blockStart)) || '—';
  return { local, valorRaw };
}

export function parseDemonstrativoTabela(texto: string): ParseDemonstrativoTabelaResult {
  const porEmail = new Map<string, DemonstrativoDestinatarioParsed>();
  const ignorados: DemonstrativoLinhaIgnorada[] = [];
  let pendente: { email: string; nome: string; local: string } | null = null;

  const flushPendenteSemValor = () => {
    if (!pendente) return;
    pushIgnorado(
      ignorados,
      `${pendente.nome} <${pendente.email}> ${pendente.local}`,
      'Produção sem valor (R$) na linha seguinte',
      pendente.nome
    );
    pendente = null;
  };

  for (const raw of texto.split(/\r?\n/)) {
    const linha = raw.trim();
    if (!linha) continue;

    if (EMAIL_INVALIDO_REGEX.test(linha)) {
      flushPendenteSemValor();
      pushIgnorado(ignorados, linha, 'E-mail não validado');
      continue;
    }

    // Linha só de valor (R$) continuando a produção anterior (export ISGH: horas numa linha, R$ na seguinte)
    if (pendente && LINHA_SO_RS_REGEX.test(linha) && !EMAIL_REGEX.test(linha)) {
      const m = linha.match(/R\$\s*[\d.,]+/i);
      if (m) {
        adicionarLinha(porEmail, pendente.email, pendente.nome, pendente.local, m[0]);
        pendente = null;
        continue;
      }
    }

    const emailMatch = linha.match(EMAIL_REGEX);
    if (!emailMatch) {
      if (LINHA_SO_RS_REGEX.test(linha) || /^R\$\s*[\d.,]+/i.test(linha)) {
        pushIgnorado(ignorados, linha, 'Valor sem profissional (e-mail) associado');
      } else {
        pushIgnorado(ignorados, linha, 'E-mail não encontrado');
      }
      continue;
    }

    const email = emailMatch[0].toLowerCase();
    const emailIdx = linha.indexOf(emailMatch[0]);
    const nome = linha.slice(0, emailIdx).replace(/\s+/g, ' ').trim();
    if (!nome) {
      pushIgnorado(ignorados, linha, 'Nome não encontrado');
      continue;
    }

    const depois = linha.slice(emailIdx + emailMatch[0].length).trim();
    if (!depois) {
      pushIgnorado(ignorados, linha, 'Local/valor não encontrados', nome);
      continue;
    }

    const extraido = extrairLocalEValor(depois);
    if (!extraido) {
      const localSo = limparHorasNoLocal(depois.replace(new RegExp(NUM_MONEY_REGEX.source, 'g'), ''));
      if (localSo) {
        flushPendenteSemValor();
        pendente = { email, nome, local: localSo };
      } else {
        pushIgnorado(ignorados, linha, 'Valor monetário não encontrado', nome);
      }
      continue;
    }

    flushPendenteSemValor();
    adicionarLinha(porEmail, email, nome, extraido.local, extraido.valorRaw);
    pendente = null;
  }

  flushPendenteSemValor();

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
