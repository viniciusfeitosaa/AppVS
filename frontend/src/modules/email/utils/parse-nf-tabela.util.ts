export type NfProducaoLinha = {
  upa: string;
  horas: string;
  valor: string;
};

export type NfDestinatarioParsed = {
  nome: string;
  email: string;
  producoes: NfProducaoLinha[];
};

export type NfLinhaIgnorada = {
  linha: string;
  motivo: string;
};

export type ParseNfTabelaResult = {
  destinatarios: NfDestinatarioParsed[];
  ignorados: NfLinhaIgnorada[];
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const VALOR_LINE_REGEX = /^R\$\s*[\d.,]+/i;
const UPA_HORAS_REGEX = /(UPA\s+.+?)\*\s*(\d+,\d+)\s*$/i;
const EMAIL_INVALIDO_REGEX = /e-?mail\s+n[aã]o\s+validado/i;

type LinhaParseada =
  | { tipo: 'producao'; nome: string; email: string; upa: string; horas: string }
  | { tipo: 'valor'; valor: string }
  | { tipo: 'ignorada'; linha: string; motivo: string };

function normalizarValor(linha: string): string {
  const m = linha.trim().match(/R\$\s*[\d.,]+/i);
  return m ? m[0].replace(/\s+/g, '') : linha.trim();
}

function parseLinhaDados(linha: string): LinhaParseada {
  const trimmed = linha.trim();
  if (!trimmed) {
    return { tipo: 'ignorada', linha, motivo: 'Linha vazia' };
  }

  if (VALOR_LINE_REGEX.test(trimmed)) {
    return { tipo: 'valor', valor: normalizarValor(trimmed) };
  }

  if (EMAIL_INVALIDO_REGEX.test(trimmed)) {
    return { tipo: 'ignorada', linha: trimmed, motivo: 'E-mail não validado' };
  }

  const emailMatch = trimmed.match(EMAIL_REGEX);
  if (!emailMatch) {
    return { tipo: 'ignorada', linha: trimmed, motivo: 'E-mail não encontrado na linha' };
  }

  const email = emailMatch[0].toLowerCase();
  const emailIndex = trimmed.indexOf(emailMatch[0]);
  const nome = trimmed.slice(0, emailIndex).replace(/\s+/g, ' ').trim();
  const depoisEmail = trimmed.slice(emailIndex + emailMatch[0].length).trim();

  const upaMatch = depoisEmail.match(UPA_HORAS_REGEX);
  if (!upaMatch) {
    return { tipo: 'ignorada', linha: trimmed, motivo: 'UPA/horas não reconhecidos' };
  }

  return {
    tipo: 'producao',
    nome,
    email,
    upa: upaMatch[1].trim(),
    horas: upaMatch[2],
  };
}

/** Interpreta tabela colada (nome, e-mail, UPA, horas e valor em linha seguinte). */
export function parseNfTabela(texto: string): ParseNfTabelaResult {
  const ignorados: NfLinhaIgnorada[] = [];
  const porEmail = new Map<string, NfDestinatarioParsed>();
  let ultimaProducao: { email: string; index: number } | null = null;

  const linhas = texto.split(/\r?\n/);

  for (const linha of linhas) {
    const parsed = parseLinhaDados(linha);

    if (parsed.tipo === 'ignorada') {
      if (parsed.linha.trim()) {
        ignorados.push({ linha: parsed.linha, motivo: parsed.motivo });
      }
      ultimaProducao = null;
      continue;
    }

    if (parsed.tipo === 'valor') {
      if (!ultimaProducao) {
        ignorados.push({ linha: linha.trim(), motivo: 'Valor sem linha de produção anterior' });
        continue;
      }
      const dest = porEmail.get(ultimaProducao.email);
      if (dest && dest.producoes[ultimaProducao.index]) {
        dest.producoes[ultimaProducao.index].valor = parsed.valor;
      }
      continue;
    }

    const existente = porEmail.get(parsed.email);
    const destinatario: NfDestinatarioParsed = existente ?? {
      nome: parsed.nome,
      email: parsed.email,
      producoes: [],
    };

    if (!existente) {
      porEmail.set(parsed.email, destinatario);
    } else if (parsed.nome.length > destinatario.nome.length) {
      destinatario.nome = parsed.nome;
    }

    destinatario.producoes.push({
      upa: parsed.upa,
      horas: parsed.horas,
      valor: '',
    });

    ultimaProducao = {
      email: parsed.email,
      index: destinatario.producoes.length - 1,
    };
  }

  const destinatarios = [...porEmail.values()]
    .map((d) => ({
      ...d,
      producoes: d.producoes.filter((p) => p.valor || p.upa),
    }))
    .filter((d) => d.producoes.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  for (const d of destinatarios) {
    for (const p of d.producoes) {
      if (!p.valor) {
        ignorados.push({
          linha: `${d.nome} — ${p.upa}`,
          motivo: 'Produção sem valor (R$)',
        });
      }
    }
    d.producoes = d.producoes.filter((p) => p.valor);
  }

  return {
    destinatarios: destinatarios.filter((d) => d.producoes.length > 0),
    ignorados,
  };
}

export function parseValorBRL(valor: string): number {
  const limpo = valor.replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

export function formatValorBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function somarProducoes(producoes: NfProducaoLinha[]): number {
  return producoes.reduce((acc, p) => acc + parseValorBRL(p.valor), 0);
}
