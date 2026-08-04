import { MESES_OPCOES, anosDisponiveis, nomeMes } from './email-nf-template.util';
import type { EmailNfPersonalizado } from './email-nf-template.util';
import type { DemonstrativoDestinatarioParsed } from './parse-demonstrativo-tabela.util';
import type { EmailAnexoPayload } from '../types';

export { MESES_OPCOES, anosDisponiveis };

/** Competência por calendário (ex.: agosto/2026). */
export type CompetenciaMesAno = {
  tipo: 'mes_ano';
  mes: number;
  ano: number;
};

/** Competência por intervalo (ex.: 15/06/2026 a 14/07/2026). Datas em ISO yyyy-mm-dd. */
export type CompetenciaPeriodo = {
  tipo: 'periodo';
  dataInicio: string;
  dataFim: string;
};

export type CompetenciaDemonstrativo = CompetenciaMesAno | CompetenciaPeriodo;

function nomeMesTitulo(mes: number): string {
  const nome = nomeMes(mes);
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** ISO yyyy-mm-dd → dd/mm/yyyy */
export function formatarDataBR(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso.trim();
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function resolverCompetencia(
  competencia: CompetenciaDemonstrativo | number,
  ano?: number
): CompetenciaDemonstrativo {
  if (typeof competencia === 'number') {
    return { tipo: 'mes_ano', mes: competencia, ano: ano ?? new Date().getFullYear() };
  }
  return competencia;
}

/** Rótulo legível da competência (corpo, PDF, prévia). */
export function formatCompetenciaLabel(
  competencia: CompetenciaDemonstrativo | number,
  ano?: number
): string {
  const c = resolverCompetencia(competencia, ano);
  if (c.tipo === 'mes_ano') {
    return `${nomeMes(c.mes)} de ${c.ano}`;
  }
  return `${formatarDataBR(c.dataInicio)} a ${formatarDataBR(c.dataFim)}`;
}

/** Slug para nome de arquivo PDF. */
export function competenciaArquivoSlug(
  competencia: CompetenciaDemonstrativo | number,
  ano?: number
): string {
  const c = resolverCompetencia(competencia, ano);
  if (c.tipo === 'mes_ano') {
    return `${c.ano}-${String(c.mes).padStart(2, '0')}`;
  }
  return `${c.dataInicio}_${c.dataFim}`.replace(/-/g, '');
}

export function buildAssuntoDemonstrativo(
  competencia: CompetenciaDemonstrativo | number,
  ano?: number
): string {
  const c = resolverCompetencia(competencia, ano);
  if (c.tipo === 'mes_ano') {
    return `Envio de Demonstrativo – ${nomeMesTitulo(c.mes)} de ${c.ano}`;
  }
  return `Envio de Demonstrativo – ${formatarDataBR(c.dataInicio)} a ${formatarDataBR(c.dataFim)}`;
}

/**
 * Corpo do e-mail de demonstrativo: texto curto apenas.
 * Valores (locais, valor, total) vão somente no PDF anexo.
 */
export function buildCorpoDemonstrativo(
  competencia: CompetenciaDemonstrativo | number,
  anoOuNome?: number | string,
  nomeDestinatario?: string
): string {
  // API antiga: (mes, ano, nome?) | nova: (competencia, nome?)
  let c: CompetenciaDemonstrativo;
  let nome: string | undefined;

  if (typeof competencia === 'number') {
    c = { tipo: 'mes_ano', mes: competencia, ano: typeof anoOuNome === 'number' ? anoOuNome : new Date().getFullYear() };
    nome = typeof anoOuNome === 'string' ? anoOuNome : nomeDestinatario;
  } else {
    c = competencia;
    nome = typeof anoOuNome === 'string' ? anoOuNome : nomeDestinatario;
  }

  const label = formatCompetenciaLabel(c);
  const ref =
    c.tipo === 'mes_ano'
      ? `referente ao mês de ${label}`
      : `referente ao período de ${label}`;

  const saudacao = nome?.trim()
    ? `Prezado(a) Dr(a) ${nome.trim()},`
    : 'Prezado(a) Dr(a),';

  return `${saudacao}

Segue, em anexo, o demonstrativo ${ref}.

Ficamos à disposição para quaisquer esclarecimentos.

Atenciosamente,

Viva Saúde

⸻

Este é um e-mail automático do sistema Viva Saúde. Por favor, não responda a esta mensagem.`;
}

export type DemonstrativoContato = {
  nome: string;
  email: string;
};

/** Alias histórico: lista só nome+e-mail (sem tabela de valores). */
export function parseDemonstrativoContatos(texto: string): {
  destinatarios: DemonstrativoContato[];
  ignorados: { linha: string; motivo: string }[];
} {
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const EMAIL_INVALIDO_REGEX = /e-?mail\s+n[aã]o\s+validado/i;
  const porEmail = new Map<string, DemonstrativoContato>();
  const ignorados: { linha: string; motivo: string }[] = [];

  for (const raw of texto.split(/\r?\n/)) {
    const linha = raw.trim();
    if (!linha) continue;

    if (EMAIL_INVALIDO_REGEX.test(linha)) {
      ignorados.push({ linha, motivo: 'E-mail não validado' });
      continue;
    }

    const emailMatch = linha.match(EMAIL_REGEX);
    if (!emailMatch) {
      ignorados.push({ linha, motivo: 'E-mail não encontrado' });
      continue;
    }

    const email = emailMatch[0].toLowerCase();
    const nome = linha.slice(0, linha.indexOf(emailMatch[0])).replace(/\s+/g, ' ').trim();
    if (!nome) {
      ignorados.push({ linha, motivo: 'Nome não encontrado' });
      continue;
    }

    if (!porEmail.has(email)) {
      porEmail.set(email, { nome, email });
    }
  }

  return {
    destinatarios: [...porEmail.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    ignorados,
  };
}

export type EmailDemonstrativoPersonalizado = EmailNfPersonalizado & {
  /** Dados da tabela — só para o PDF; não vão no corpo do e-mail. */
  dados?: {
    linhas: { local: string; valor: string }[];
    total: number;
  };
  anexos?: EmailAnexoPayload[];
};

export function buildEmailsDemonstrativo(
  competencia: CompetenciaDemonstrativo,
  destinatarios: DemonstrativoContato[]
): EmailDemonstrativoPersonalizado[] {
  const assunto = buildAssuntoDemonstrativo(competencia);
  return destinatarios.map((d) => ({
    nome: d.nome,
    email: d.email,
    assunto,
    corpoTexto: buildCorpoDemonstrativo(competencia, d.nome),
  }));
}

export function buildEmailsDemonstrativoComDados(
  competencia: CompetenciaDemonstrativo,
  destinatarios: DemonstrativoDestinatarioParsed[]
): EmailDemonstrativoPersonalizado[] {
  const assunto = buildAssuntoDemonstrativo(competencia);
  return destinatarios.map((d) => ({
    nome: d.nome,
    email: d.email,
    assunto,
    corpoTexto: buildCorpoDemonstrativo(competencia, d.nome),
    dados: {
      linhas: d.linhas,
      total: d.total,
    },
  }));
}

/** Defaults úteis para período (ex.: 15 do mês anterior → 14 do mês atual). */
export function periodoPadraoCompetencia(ref = new Date()): { dataInicio: string; dataFim: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth(); // 0-based
  // fim = 14 do mês corrente
  const fim = new Date(y, m, 14);
  // início = 15 do mês anterior
  const ini = new Date(y, m - 1, 15);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { dataInicio: iso(ini), dataFim: iso(fim) };
}
