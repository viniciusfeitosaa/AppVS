import {
  ConteudoEventoStatus,
  ConteudoPalestranteStatus,
  ConteudoParticipanteOrigem,
  ConteudoParticipantePerfil,
  ConteudoPrecadastroStatus,
  ConteudoPresencaOrigem,
  Prisma,
  StatusCadastroMedico,
} from '@prisma/client';
import { prisma } from '../config/database';
import { getFrontendAppBaseUrl } from '../utils/email-branding.util';
import { newConteudoToken, parseYoutubeUrl, youtubeEmbedUrl } from '../utils/conteudo.util';
import { validateCPF } from '../utils/validation.util';
import { TERMOS_CADASTRO_VERSAO } from '../constants/termos-cadastro.const';
import { enviarEmailPrecadastroAceito } from './cadastro-publico-email.service';
import { hashPassword } from '../utils/password.util';
import { resolveRegistroConselhoParaCadastro } from '../utils/profissao-registro.util';
import {
  buildTemplateVivaAtualizaAvaliacao,
  formAvaliacaoSemGabarito,
  sanitizeAvaliacaoFormulario,
  validarRespostasAvaliacao,
  type AvaliacaoFormulario,
  type AvaliacaoRespostasMap,
} from '../constants/conteudo-avaliacao.const';

const palestranteSelect = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  cpf: true,
  bio: true,
  fotoUrl: true,
  crm: true,
  especialidade: true,
  medicoId: true,
  status: true,
} as const;

function notFound(message = 'Conteúdo não encontrado'): never {
  throw { statusCode: 404, message };
}

function conflict(message: string): never {
  throw { statusCode: 409, message };
}

function formatEventoAdmin(
  evento: {
    id: string;
    titulo: string;
    capaUrl: string | null;
    youtubeUrl: string | null;
    youtubeVideoId: string | null;
    descricao: string | null;
    iniciaEm: Date;
    status: ConteudoEventoStatus;
    palestranteId: string | null;
    tokenPalestrante: string;
    tokenInscricao: string;
    tokenFrequencia: string;
    frequenciaAberta: boolean;
    frequenciaAbertaEm: Date | null;
    frequenciaFechadaEm: Date | null;
    avaliacaoAtiva?: boolean;
    avaliacaoFormulario?: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    palestrante: Prisma.ConteudoPalestranteGetPayload<{ select: typeof palestranteSelect }> | null;
    _count?: { participantes: number };
  },
  opts?: { includeTokens?: boolean; presentesCount?: number }
) {
  const base = getFrontendAppBaseUrl();
  const participantesCount = evento._count?.participantes ?? undefined;
  const presentesCount = opts?.presentesCount;
  const form = sanitizeAvaliacaoFormulario(evento.avaliacaoFormulario ?? null);
  const avaliacaoAtiva = !!(evento.avaliacaoAtiva && form);
  return {
    id: evento.id,
    titulo: evento.titulo,
    capaUrl: evento.capaUrl,
    youtubeUrl: evento.youtubeUrl,
    youtubeVideoId: evento.youtubeVideoId,
    youtubeEmbedUrl: youtubeEmbedUrl(evento.youtubeVideoId),
    descricao: evento.descricao,
    iniciaEm: evento.iniciaEm.toISOString(),
    status: evento.status,
    palestranteId: evento.palestranteId,
    palestrante: evento.palestrante,
    participantesCount,
    presentesCount,
    ausentesCount:
      participantesCount !== undefined && presentesCount !== undefined
        ? Math.max(0, participantesCount - presentesCount)
        : undefined,
    frequenciaAberta: evento.frequenciaAberta,
    frequenciaAbertaEm: evento.frequenciaAbertaEm?.toISOString() ?? null,
    frequenciaFechadaEm: evento.frequenciaFechadaEm?.toISOString() ?? null,
    avaliacaoAtiva,
    avaliacao: form,
    createdAt: evento.createdAt.toISOString(),
    updatedAt: evento.updatedAt.toISOString(),
    ...(opts?.includeTokens
      ? {
          tokenPalestrante: evento.tokenPalestrante,
          tokenInscricao: evento.tokenInscricao,
          tokenFrequencia: evento.tokenFrequencia,
          linkPalestrante: `${base}/conteudos/palestrante/${evento.tokenPalestrante}`,
          linkInscricao: `${base}/conteudos/inscricao/${evento.tokenInscricao}`,
          linkFrequencia: `${base}/conteudos/frequencia/${evento.tokenFrequencia}`,
        }
      : {}),
  };
}

function formatEventoPublico(evento: {
  id: string;
  titulo: string;
  capaUrl: string | null;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  descricao: string | null;
  iniciaEm: Date;
  status: ConteudoEventoStatus;
  frequenciaAberta?: boolean;
  avaliacaoAtiva?: boolean;
  avaliacaoFormulario?: Prisma.JsonValue | null;
  palestrante: { id: string; nome: string; bio: string | null; fotoUrl: string | null; especialidade: string | null } | null;
  jaInscrito?: boolean;
  presenteEm?: Date | null;
  avaliadoEm?: Date | null;
}) {
  const form = sanitizeAvaliacaoFormulario(evento.avaliacaoFormulario ?? null);
  const precisaAvaliacao =
    !!(evento.avaliacaoAtiva && form) && !evento.avaliadoEm;
  return {
    id: evento.id,
    titulo: evento.titulo,
    capaUrl: evento.capaUrl,
    youtubeUrl: evento.youtubeUrl,
    youtubeVideoId: evento.youtubeVideoId,
    youtubeEmbedUrl: youtubeEmbedUrl(evento.youtubeVideoId),
    descricao: evento.descricao,
    iniciaEm: evento.iniciaEm.toISOString(),
    status: evento.status,
    frequenciaAberta: evento.frequenciaAberta ?? false,
    avaliacaoAtiva: !!(evento.avaliacaoAtiva && form),
    avaliacao: form ? formAvaliacaoSemGabarito(form) : null,
    avaliadoEm: evento.avaliadoEm ? evento.avaliadoEm.toISOString() : null,
    precisaAvaliacao,
    palestrante: evento.palestrante
      ? {
          id: evento.palestrante.id,
          nome: evento.palestrante.nome,
          bio: evento.palestrante.bio,
          fotoUrl: evento.palestrante.fotoUrl,
          especialidade: evento.palestrante.especialidade,
        }
      : null,
    jaInscrito: evento.jaInscrito ?? false,
    presenteEm: evento.presenteEm ? evento.presenteEm.toISOString() : null,
  };
}

export async function listPalestrantesAdminService(tenantId: string, q?: string) {
  const where: Prisma.ConteudoPalestranteWhereInput = { tenantId };
  if (q?.trim()) {
    where.OR = [
      { nome: { contains: q.trim(), mode: 'insensitive' } },
      { email: { contains: q.trim(), mode: 'insensitive' } },
      { crm: { contains: q.trim(), mode: 'insensitive' } },
      { especialidade: { contains: q.trim(), mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.conteudoPalestrante.findMany({
    where,
    select: {
      ...palestranteSelect,
      createdAt: true,
      updatedAt: true,
      eventos: {
        select: {
          id: true,
          titulo: true,
          iniciaEm: true,
          status: true,
        },
        orderBy: { iniciaEm: 'desc' },
        take: 20,
      },
      _count: { select: { eventos: true } },
    },
    orderBy: { nome: 'asc' },
    take: 200,
  });

  return rows.map((p) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    telefone: p.telefone,
    cpf: p.cpf,
    bio: p.bio,
    fotoUrl: p.fotoUrl,
    crm: p.crm,
    especialidade: p.especialidade,
    medicoId: p.medicoId,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    eventosCount: p._count.eventos,
    eventos: p.eventos.map((e) => ({
      id: e.id,
      titulo: e.titulo,
      iniciaEm: e.iniciaEm.toISOString(),
      status: e.status,
    })),
  }));
}

export async function listEventosAdminService(tenantId: string) {
  const rows = await prisma.conteudoEvento.findMany({
    where: { tenantId },
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
    orderBy: [{ iniciaEm: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map((e) => formatEventoAdmin(e, { includeTokens: true }));
}

export async function getEventoAdminService(tenantId: string, id: string) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { id, tenantId },
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
  });
  if (!evento) notFound();
  const presentesCount = await prisma.conteudoParticipante.count({
    where: { tenantId, eventoId: id, presenteEm: { not: null } },
  });
  return formatEventoAdmin(evento, { includeTokens: true, presentesCount });
}

type CreateEventoInput = {
  titulo: string;
  youtubeUrl?: string | null;
  iniciaEm: string | Date;
  descricao?: string | null;
  capaUrl?: string | null;
  palestranteId?: string | null;
  status?: ConteudoEventoStatus;
};

function resolveYoutubeFields(youtubeUrl?: string | null): {
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
} {
  const raw = (youtubeUrl || '').trim();
  if (!raw) {
    return { youtubeUrl: null, youtubeVideoId: null };
  }
  const yt = parseYoutubeUrl(raw);
  return { youtubeUrl: yt.canonicalUrl, youtubeVideoId: yt.videoId };
}

export async function createEventoAdminService(
  tenantId: string,
  masterId: string,
  input: CreateEventoInput
) {
  const yt = resolveYoutubeFields(input.youtubeUrl);
  const iniciaEm = new Date(input.iniciaEm);
  if (Number.isNaN(iniciaEm.getTime())) {
    throw { statusCode: 400, message: 'Data/hora do evento inválida.' };
  }

  if (input.palestranteId) {
    const pal = await prisma.conteudoPalestrante.findFirst({
      where: { id: input.palestranteId, tenantId },
    });
    if (!pal) throw { statusCode: 400, message: 'Palestrante não encontrado.' };
  }

  const status = input.status || ConteudoEventoStatus.RASCUNHO;

  const evento = await prisma.conteudoEvento.create({
    data: {
      tenantId,
      titulo: input.titulo.trim(),
      youtubeUrl: yt.youtubeUrl,
      youtubeVideoId: yt.youtubeVideoId,
      iniciaEm,
      descricao: input.descricao?.trim() || null,
      capaUrl: input.capaUrl?.trim() || null,
      palestranteId: input.palestranteId || null,
      status,
      tokenPalestrante: newConteudoToken(),
      tokenInscricao: newConteudoToken(),
      tokenFrequencia: newConteudoToken(),
      criadoPorMasterId: masterId,
    },
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
  });

  return formatEventoAdmin(evento, { includeTokens: true });
}

type UpdateEventoInput = {
  titulo?: string;
  youtubeUrl?: string | null;
  iniciaEm?: string | Date;
  descricao?: string | null;
  capaUrl?: string | null;
  palestranteId?: string | null;
  status?: ConteudoEventoStatus;
};

export async function updateEventoAdminService(
  tenantId: string,
  id: string,
  input: UpdateEventoInput
) {
  const existing = await prisma.conteudoEvento.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();

  const data: Prisma.ConteudoEventoUpdateInput = {};

  if (input.titulo !== undefined) data.titulo = input.titulo.trim();
  if (input.descricao !== undefined) data.descricao = input.descricao?.trim() || null;
  if (input.capaUrl !== undefined) data.capaUrl = input.capaUrl?.trim() || null;
  if (input.status !== undefined) data.status = input.status;

  if (input.iniciaEm !== undefined) {
    const iniciaEm = new Date(input.iniciaEm);
    if (Number.isNaN(iniciaEm.getTime())) {
      throw { statusCode: 400, message: 'Data/hora do evento inválida.' };
    }
    data.iniciaEm = iniciaEm;
  }

  if (input.youtubeUrl !== undefined) {
    const yt = resolveYoutubeFields(input.youtubeUrl);
    data.youtubeUrl = yt.youtubeUrl;
    data.youtubeVideoId = yt.youtubeVideoId;
  }

  if (input.palestranteId !== undefined) {
    if (input.palestranteId === null) {
      data.palestrante = { disconnect: true };
    } else {
      const pal = await prisma.conteudoPalestrante.findFirst({
        where: { id: input.palestranteId, tenantId },
      });
      if (!pal) throw { statusCode: 400, message: 'Palestrante não encontrado.' };
      data.palestrante = { connect: { id: input.palestranteId } };
    }
  }

  const evento = await prisma.conteudoEvento.update({
    where: { id },
    data,
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
  });

  return formatEventoAdmin(evento, { includeTokens: true });
}

export async function setEventoStatusAdminService(
  tenantId: string,
  id: string,
  status: ConteudoEventoStatus
) {
  return updateEventoAdminService(tenantId, id, { status });
}

export async function abrirFrequenciaAdminService(tenantId: string, id: string) {
  const existing = await prisma.conteudoEvento.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();
  if (existing.status === ConteudoEventoStatus.RASCUNHO) {
    throw { statusCode: 400, message: 'Abra as inscrições antes de liberar a frequência.' };
  }

  const evento = await prisma.conteudoEvento.update({
    where: { id },
    data: {
      frequenciaAberta: true,
      frequenciaAbertaEm: new Date(),
      frequenciaFechadaEm: null,
      // Novo link a cada abertura — invalida QR/link vazado de sessões anteriores
      tokenFrequencia: newConteudoToken(),
    },
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
  });

  const presentesCount = await prisma.conteudoParticipante.count({
    where: { tenantId, eventoId: id, presenteEm: { not: null } },
  });
  return formatEventoAdmin(evento, { includeTokens: true, presentesCount });
}

export async function fecharFrequenciaAdminService(tenantId: string, id: string) {
  const existing = await prisma.conteudoEvento.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();

  const evento = await prisma.conteudoEvento.update({
    where: { id },
    data: {
      frequenciaAberta: false,
      frequenciaFechadaEm: new Date(),
    },
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
  });

  const presentesCount = await prisma.conteudoParticipante.count({
    where: { tenantId, eventoId: id, presenteEm: { not: null } },
  });
  return formatEventoAdmin(evento, { includeTokens: true, presentesCount });
}

/**
 * Aplica o template Avaliação Viva Atualiza (9 perguntas) e ativa a avaliação na frequência.
 * Mantido como atalho; preferir salvarAvaliacaoFormularioAdminService com formulário customizado.
 */
export async function aplicarTemplateAvaliacaoAdminService(tenantId: string, id: string) {
  const existing = await prisma.conteudoEvento.findFirst({
    where: { id, tenantId },
    include: { palestrante: { select: { nome: true } } },
  });
  if (!existing) notFound();

  const form = buildTemplateVivaAtualizaAvaliacao({
    tema: existing.titulo,
    palestrante: existing.palestrante?.nome
      ? existing.palestrante.nome.startsWith('Dr')
        ? existing.palestrante.nome
        : `Dr(a). ${existing.palestrante.nome}`
      : 'A definir',
  });

  const evento = await prisma.conteudoEvento.update({
    where: { id },
    data: {
      avaliacaoAtiva: true,
      avaliacaoFormulario: form as unknown as Prisma.InputJsonValue,
    },
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
  });

  const presentesCount = await prisma.conteudoParticipante.count({
    where: { tenantId, eventoId: id, presenteEm: { not: null } },
  });
  return formatEventoAdmin(evento, { includeTokens: true, presentesCount });
}

/**
 * Salva o formulário de avaliação personalizado (perguntas/respostas do master).
 * Cada conteúdo pode ter perguntas diferentes.
 */
export async function salvarAvaliacaoFormularioAdminService(
  tenantId: string,
  id: string,
  input: { formulario: unknown; ativa?: boolean }
) {
  const existing = await prisma.conteudoEvento.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();

  const form = sanitizeAvaliacaoFormulario(input.formulario);
  if (!form) {
    throw {
      statusCode: 400,
      message:
        'Formulário inválido. Informe um título e ao menos uma pergunta (texto, estrelas ou múltipla escolha).',
    };
  }

  const ativa =
    input.ativa === undefined
      ? existing.avaliacaoAtiva || form.perguntas.length > 0
      : !!input.ativa;

  const evento = await prisma.conteudoEvento.update({
    where: { id },
    data: {
      avaliacaoFormulario: form as unknown as Prisma.InputJsonValue,
      avaliacaoAtiva: ativa && form.perguntas.length > 0,
    },
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
  });

  const presentesCount = await prisma.conteudoParticipante.count({
    where: { tenantId, eventoId: id, presenteEm: { not: null } },
  });
  return formatEventoAdmin(evento, { includeTokens: true, presentesCount });
}

/** Ativa/desativa avaliação (formulário deve existir). */
export async function setAvaliacaoAtivaAdminService(
  tenantId: string,
  id: string,
  ativa: boolean
) {
  const existing = await prisma.conteudoEvento.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();
  if (ativa && !sanitizeAvaliacaoFormulario(existing.avaliacaoFormulario)) {
    throw {
      statusCode: 400,
      message: 'Crie e salve as perguntas da avaliação antes de ativar.',
    };
  }

  const evento = await prisma.conteudoEvento.update({
    where: { id },
    data: { avaliacaoAtiva: !!ativa },
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
  });

  const presentesCount = await prisma.conteudoParticipante.count({
    where: { tenantId, eventoId: id, presenteEm: { not: null } },
  });
  return formatEventoAdmin(evento, { includeTokens: true, presentesCount });
}

function asRespostasMap(raw: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) out[k] = s;
  }
  return out;
}

/**
 * Relatório de respostas da avaliação do conteúdo: agregado + linhas individuais + textos livres.
 */
export async function getAvaliacaoResultadosAdminService(tenantId: string, eventoId: string) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { id: eventoId, tenantId },
    select: {
      id: true,
      titulo: true,
      avaliacaoFormulario: true,
      avaliacaoAtiva: true,
    },
  });
  if (!evento) notFound();

  const form = sanitizeAvaliacaoFormulario(evento.avaliacaoFormulario ?? null);

  const rows = await prisma.conteudoParticipante.findMany({
    where: { tenantId, eventoId },
    orderBy: { avaliadoEm: 'desc' },
    select: {
      id: true,
      nome: true,
      email: true,
      origem: true,
      presenteEm: true,
      avaliadoEm: true,
      avaliacaoRespostas: true,
    },
  });

  const inscritos = rows.length;
  const presentes = rows.filter((r) => !!r.presenteEm).length;
  const comResposta = rows.filter((r) => {
    if (r.avaliadoEm) return true;
    // legado / parcial: tem JSON de respostas mesmo sem data
    if (r.avaliacaoRespostas == null) return false;
    if (typeof r.avaliacaoRespostas !== 'object' || Array.isArray(r.avaliacaoRespostas)) return false;
    return Object.keys(r.avaliacaoRespostas as object).length > 0;
  });
  const avaliaram = comResposta.length;
  const taxaRespostaPresentes =
    presentes > 0 ? Math.round((avaliaram / presentes) * 1000) / 10 : null;

  const respostasIndividuais = comResposta.map((r) => ({
    participanteId: r.id,
    nome: r.nome,
    email: r.email,
    origem: r.origem,
    avaliadoEm: (r.avaliadoEm || r.presenteEm || new Date()).toISOString(),
    respostas: asRespostasMap(r.avaliacaoRespostas),
  }));

  type OpcaoStat = { valor: string; label: string; total: number; pct: number };
  type TextoItem = {
    participanteId: string;
    nome: string;
    email: string;
    resposta: string;
    avaliadoEm: string;
  };

  const perguntasStats =
    form?.perguntas.map((p) => {
      const valores = comResposta
        .map((r) => {
          const map = asRespostasMap(r.avaliacaoRespostas);
          const v = map[p.id];
          return v
            ? {
                valor: v,
                participanteId: r.id,
                nome: r.nome,
                email: r.email,
                avaliadoEm: (r.avaliadoEm || r.presenteEm || new Date()).toISOString(),
              }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => !!x);

      const totalRespostas = valores.length;

      if (p.tipo === 'texto') {
        return {
          id: p.id,
          tipo: p.tipo,
          texto: p.texto,
          totalRespostas,
          textos: valores.map((v) => ({
            participanteId: v.participanteId,
            nome: v.nome,
            email: v.email,
            resposta: v.valor,
            avaliadoEm: v.avaliadoEm,
          })) as TextoItem[],
          opcoes: undefined as OpcaoStat[] | undefined,
          mediaEstrelas: null as number | null,
          acertos: null as { total: number; corretos: number; pct: number } | null,
          respostaCorreta: undefined as string | undefined,
        };
      }

      const counts = new Map<string, number>();
      for (const v of valores) {
        counts.set(v.valor, (counts.get(v.valor) || 0) + 1);
      }

      const opcoesBase: Array<{ valor: string; label: string }> = p.opcoes?.length
        ? p.opcoes.map((o) => ({ valor: o.valor, label: o.label }))
        : Array.from(counts.keys()).map((valor) => ({ valor, label: valor }));

      const known = new Set(opcoesBase.map((o) => o.valor));
      for (const valor of counts.keys()) {
        if (!known.has(valor)) {
          opcoesBase.push({ valor, label: valor });
          known.add(valor);
        }
      }

      const opcoes: OpcaoStat[] = opcoesBase.map((o) => {
        const total = counts.get(o.valor) || 0;
        const pct = totalRespostas > 0 ? Math.round((total / totalRespostas) * 1000) / 10 : 0;
        return { valor: o.valor, label: o.label, total, pct };
      });

      let mediaEstrelas: number | null = null;
      if (p.tipo === 'estrelas' && totalRespostas > 0) {
        const nums = valores.map((v) => Number(v.valor)).filter((n) => Number.isFinite(n));
        if (nums.length) {
          mediaEstrelas =
            Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
        }
      }

      let acertos: { total: number; corretos: number; pct: number } | null = null;
      if (p.tipo === 'quiz' && p.respostaCorreta && totalRespostas > 0) {
        const corretos = valores.filter((v) => v.valor === p.respostaCorreta).length;
        acertos = {
          total: totalRespostas,
          corretos,
          pct: Math.round((corretos / totalRespostas) * 1000) / 10,
        };
      }

      return {
        id: p.id,
        tipo: p.tipo,
        texto: p.texto,
        totalRespostas,
        textos: undefined as TextoItem[] | undefined,
        opcoes,
        mediaEstrelas,
        acertos,
        respostaCorreta: p.tipo === 'quiz' ? p.respostaCorreta : undefined,
      };
    }) ?? [];

  return {
    eventoId: evento.id,
    titulo: evento.titulo,
    avaliacaoAtiva: evento.avaliacaoAtiva,
    formulario: form,
    resumo: {
      inscritos,
      presentes,
      avaliaram,
      taxaRespostaPresentes,
    },
    perguntas: perguntasStats,
    respostas: respostasIndividuais,
  };
}

function resolverFormAvaliacaoEvento(evento: {
  avaliacaoAtiva: boolean;
  avaliacaoFormulario: Prisma.JsonValue | null;
}): AvaliacaoFormulario | null {
  if (!evento.avaliacaoAtiva) return null;
  return sanitizeAvaliacaoFormulario(evento.avaliacaoFormulario);
}

function prepararRespostasSeNecessario(
  form: AvaliacaoFormulario | null,
  respostasRaw: unknown,
  jaAvaliado: boolean
): AvaliacaoRespostasMap | null {
  if (!form) return null;
  if (jaAvaliado) return null;
  if (respostasRaw === undefined || respostasRaw === null) {
    throw {
      statusCode: 400,
      message: 'Preencha a avaliação da aula para confirmar a presença.',
    };
  }
  return validarRespostasAvaliacao(form, respostasRaw);
}

export async function regenerarTokenAdminService(
  tenantId: string,
  id: string,
  tipo: 'palestrante' | 'inscricao' | 'frequencia'
) {
  const existing = await prisma.conteudoEvento.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();

  const data =
    tipo === 'palestrante'
      ? { tokenPalestrante: newConteudoToken() }
      : tipo === 'inscricao'
        ? { tokenInscricao: newConteudoToken() }
        : { tokenFrequencia: newConteudoToken() };

  const updated = await prisma.conteudoEvento.update({
    where: { id },
    data,
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
  });

  return formatEventoAdmin(updated, { includeTokens: true });
}

export async function convidarPalestranteAdminService(
  tenantId: string,
  eventoId: string,
  input: { nome?: string; email?: string; medicoId?: string }
) {
  const evento = await prisma.conteudoEvento.findFirst({ where: { id: eventoId, tenantId } });
  if (!evento) notFound();

  let palestrante;

  if (input.medicoId) {
    const medico = await prisma.medico.findFirst({
      where: { id: input.medicoId, tenantId, ativo: true },
    });
    if (!medico) throw { statusCode: 400, message: 'Médico não encontrado.' };

    palestrante = await prisma.conteudoPalestrante.create({
      data: {
        tenantId,
        nome: medico.nomeCompleto,
        email: medico.email || `${medico.id}@pendente.local`,
        telefone: medico.telefone,
        crm: medico.crm,
        especialidade: medico.especialidades?.[0] || null,
        medicoId: medico.id,
        status: ConteudoPalestranteStatus.COMPLETO,
      },
      select: palestranteSelect,
    });
  } else {
    const nome = (input.nome || 'Palestrante').trim();
    const email = (input.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw { statusCode: 400, message: 'Informe um e-mail válido para o convite do palestrante.' };
    }

    palestrante = await prisma.conteudoPalestrante.create({
      data: {
        tenantId,
        nome,
        email,
        status: ConteudoPalestranteStatus.PENDENTE_FORM,
      },
      select: palestranteSelect,
    });
  }

  const updated = await prisma.conteudoEvento.update({
    where: { id: eventoId },
    data: { palestranteId: palestrante.id },
    include: {
      palestrante: { select: palestranteSelect },
      _count: { select: { participantes: true } },
    },
  });

  return formatEventoAdmin(updated, { includeTokens: true });
}

export async function listParticipantesAdminService(tenantId: string, eventoId: string) {
  const evento = await prisma.conteudoEvento.findFirst({ where: { id: eventoId, tenantId } });
  if (!evento) notFound();

  return prisma.conteudoParticipante.findMany({
    where: { tenantId, eventoId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      origem: true,
      perfil: true,
      nome: true,
      email: true,
      telefone: true,
      cpf: true,
      crm: true,
      especialidade: true,
      cidade: true,
      faculdade: true,
      semestre: true,
      participaLiga: true,
      ligaNome: true,
      interesseCorpoClinico: true,
      medicoId: true,
      consentimentoLgpd: true,
      presenteEm: true,
      presencaOrigem: true,
      avaliacaoRespostas: true,
      avaliadoEm: true,
      createdAt: true,
    },
  }).then((rows) =>
    rows.map((r) => ({
      ...r,
      presenteEm: r.presenteEm?.toISOString() ?? null,
      avaliadoEm: r.avaliadoEm?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}

/** Remove inscrição do conteúdo (= some da lista de participantes e de precadastros se for externo). */
export async function deleteParticipanteAdminService(
  tenantId: string,
  eventoId: string,
  participanteId: string
) {
  const row = await prisma.conteudoParticipante.findFirst({
    where: { id: participanteId, tenantId, eventoId },
    select: { id: true, nome: true, email: true },
  });
  if (!row) notFound('Participante não encontrado.');

  await prisma.conteudoParticipante.delete({ where: { id: row.id } });
  return { id: row.id, nome: row.nome, email: row.email };
}

/** Lista unificada de precadastros (inscritos externos) de todos os conteúdos. */
export async function listPrecadastrosAdminService(tenantId: string) {
  const rows = await prisma.conteudoParticipante.findMany({
    where: { tenantId, origem: ConteudoParticipanteOrigem.EXTERNO },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      perfil: true,
      nome: true,
      email: true,
      telefone: true,
      cpf: true,
      crm: true,
      especialidade: true,
      cidade: true,
      faculdade: true,
      semestre: true,
      participaLiga: true,
      ligaNome: true,
      interesseCorpoClinico: true,
      consentimentoLgpd: true,
      precadastroStatus: true,
      precadastroAceitoEm: true,
      presenteEm: true,
      presencaOrigem: true,
      createdAt: true,
      evento: {
        select: { id: true, titulo: true, iniciaEm: true, status: true },
      },
    },
  });

  return rows.map((r) => {
    const camposFaltantes = computeCamposFaltantesCadastroCorpo({
      nome: r.nome,
      email: r.email,
      telefone: r.telefone,
      cpf: r.cpf,
      crm: r.crm,
      perfil: r.perfil,
    });
    return {
      id: r.id,
      perfil: r.perfil,
      nome: r.nome,
      email: r.email,
      telefone: r.telefone,
      cpf: r.cpf,
      crm: r.crm,
      especialidade: r.especialidade,
      cidade: r.cidade,
      faculdade: r.faculdade,
      semestre: r.semestre,
      participaLiga: r.participaLiga,
      ligaNome: r.ligaNome,
      interesseCorpoClinico: r.interesseCorpoClinico,
      consentimentoLgpd: r.consentimentoLgpd,
      precadastroStatus: r.precadastroStatus,
      precadastroAceitoEm: r.precadastroAceitoEm?.toISOString() ?? null,
      presenteEm: r.presenteEm?.toISOString() ?? null,
      presencaOrigem: r.presencaOrigem,
      createdAt: r.createdAt.toISOString(),
      camposFaltantes,
      evento: {
        id: r.evento.id,
        titulo: r.evento.titulo,
        iniciaEm: r.evento.iniciaEm.toISOString(),
        status: r.evento.status,
      },
      resumo: [
        r.nome,
        r.email,
        r.telefone,
        r.crm ? `CRM ${r.crm}` : null,
        r.especialidade,
        r.cidade,
        r.interesseCorpoClinico ? 'interesse corpo clínico' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  });
}

function computeCamposFaltantesCadastroCorpo(p: {
  nome: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  crm: string | null;
  perfil: ConteudoParticipantePerfil;
}): string[] {
  const faltam: string[] = [];
  if (!p.nome || p.nome.trim().length < 3) faltam.push('Nome completo');
  if (!p.email || !p.email.includes('@')) faltam.push('E-mail');
  const cpf = (p.cpf || '').replace(/\D/g, '');
  if (!validateCPF(cpf)) faltam.push('CPF');
  if (!p.telefone || p.telefone.trim().length < 8) faltam.push('Telefone');
  if (p.perfil === ConteudoParticipantePerfil.MEDICO && !p.crm?.trim()) {
    faltam.push('CRM / registro profissional');
  }
  // Sempre pedidos no formulário de conclusão
  faltam.push('Senha de acesso');
  faltam.push('Profissão');
  faltam.push('Aceite dos termos de cadastro');
  return faltam;
}

/**
 * Aceita precadastros (opção A): gera link de conclusão e e-mail.
 * Ao completar o cadastro pelo link, entra como ATIVO — não passa por Avaliação.
 */
export async function aceitarPrecadastrosAdminService(
  tenantId: string,
  masterId: string,
  ids: string[]
) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw { statusCode: 400, message: 'Selecione ao menos um pré-cadastro.' };
  }
  if (uniqueIds.length > 100) {
    throw { statusCode: 400, message: 'Selecione no máximo 100 pré-cadastros por vez.' };
  }

  const rows = await prisma.conteudoParticipante.findMany({
    where: {
      tenantId,
      id: { in: uniqueIds },
      origem: ConteudoParticipanteOrigem.EXTERNO,
    },
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  const results: Array<{
    id: string;
    nome: string;
    email: string;
    ok: boolean;
    message: string;
    camposFaltantes?: string[];
    cadastroUrl?: string;
  }> = [];

  for (const id of uniqueIds) {
    const row = byId.get(id);
    if (!row) {
      results.push({ id, nome: '', email: '', ok: false, message: 'Pré-cadastro não encontrado.' });
      continue;
    }
    if (row.precadastroStatus === ConteudoPrecadastroStatus.CONVERTIDO) {
      results.push({
        id,
        nome: row.nome,
        email: row.email,
        ok: false,
        message: 'Já convertido em corpo clínico.',
      });
      continue;
    }

    const email = row.email.trim().toLowerCase();
    const cpf = (row.cpf || '').replace(/\D/g, '');
    const existing = await prisma.medico.findFirst({
      where: {
        tenantId,
        OR: [
          { email },
          ...(cpf.length === 11 ? [{ cpf }] : []),
        ],
      },
      select: { id: true, statusCadastro: true },
    });
    if (existing) {
      results.push({
        id,
        nome: row.nome,
        email: row.email,
        ok: false,
        message:
          existing.statusCadastro === StatusCadastroMedico.PENDENTE_ANALISE
            ? 'Já existe cadastro em Avaliação com este e-mail/CPF.'
            : 'Já existe profissional no corpo clínico com este e-mail/CPF.',
      });
      continue;
    }

    const token = newConteudoToken();
    const camposFaltantes = computeCamposFaltantesCadastroCorpo({
      nome: row.nome,
      email: row.email,
      telefone: row.telefone,
      cpf: row.cpf,
      crm: row.crm,
      perfil: row.perfil,
    });
    const cadastroUrl = `${getFrontendAppBaseUrl()}/conteudos/cadastro-corpo/${token}`;

    await prisma.conteudoParticipante.update({
      where: { id: row.id },
      data: {
        precadastroStatus: ConteudoPrecadastroStatus.ACEITO,
        tokenCadastroCorpo: token,
        precadastroAceitoEm: new Date(),
        precadastroAceitoPorMasterId: masterId,
      },
    });

    try {
      await enviarEmailPrecadastroAceito({
        to: email,
        nomeCompleto: row.nome,
        cadastroUrl,
        camposFaltantes,
      });
    } catch (err) {
      console.error('[precadastro-aceite] e-mail falhou para', email, err);
    }

    results.push({
      id,
      nome: row.nome,
      email: row.email,
      ok: true,
      message: 'Aceito — e-mail com link de cadastro enviado (se SMTP/Resend estiver ativo).',
      camposFaltantes,
      cadastroUrl,
    });
  }

  const aceitos = results.filter((r) => r.ok).length;
  return {
    aceitos,
    total: uniqueIds.length,
    results,
  };
}

export async function getPublicCadastroCorpoFormService(token: string) {
  const row = await prisma.conteudoParticipante.findFirst({
    where: {
      tokenCadastroCorpo: token,
      origem: ConteudoParticipanteOrigem.EXTERNO,
    },
    include: {
      evento: { select: { id: true, titulo: true, iniciaEm: true } },
    },
  });
  if (!row) notFound('Link de cadastro inválido ou expirado.');
  if (row.precadastroStatus === ConteudoPrecadastroStatus.CONVERTIDO) {
    throw { statusCode: 400, message: 'Este cadastro já foi concluído. Faça login com seu e-mail e senha.' };
  }
  if (row.precadastroStatus !== ConteudoPrecadastroStatus.ACEITO) {
    throw { statusCode: 400, message: 'Este convite ainda não foi liberado pela equipe.' };
  }

  const camposFaltantes = computeCamposFaltantesCadastroCorpo({
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    cpf: row.cpf,
    crm: row.crm,
    perfil: row.perfil,
  });

  return {
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    cpf: row.cpf,
    crm: row.crm,
    especialidade: row.especialidade,
    perfil: row.perfil,
    cidade: row.cidade,
    camposFaltantes,
    evento: {
      id: row.evento.id,
      titulo: row.evento.titulo,
      iniciaEm: row.evento.iniciaEm.toISOString(),
    },
  };
}

/**
 * Completa o cadastro a partir do precadastro aceito → Medico ATIVO (não vai para Avaliação).
 */
export async function submitPublicCadastroCorpoService(
  token: string,
  input: {
    nomeCompleto?: string;
    email?: string;
    telefone?: string | null;
    cpf?: string | null;
    password: string;
    confirmPassword?: string;
    profissao: string;
    crm?: string | null;
    especialidades?: string[] | string | null;
    aceitouTermos?: boolean | string;
  }
) {
  const row = await prisma.conteudoParticipante.findFirst({
    where: {
      tokenCadastroCorpo: token,
      origem: ConteudoParticipanteOrigem.EXTERNO,
    },
  });
  if (!row) notFound('Link de cadastro inválido ou expirado.');
  if (row.precadastroStatus === ConteudoPrecadastroStatus.CONVERTIDO) {
    throw { statusCode: 400, message: 'Este cadastro já foi concluído.' };
  }
  if (row.precadastroStatus !== ConteudoPrecadastroStatus.ACEITO) {
    throw { statusCode: 400, message: 'Este convite ainda não foi liberado pela equipe.' };
  }

  const aceitou =
    input.aceitouTermos === true ||
    input.aceitouTermos === 'true' ||
    input.aceitouTermos === '1' ||
    input.aceitouTermos === 'on';
  if (!aceitou) {
    throw { statusCode: 400, message: 'É necessário aceitar a declaração e os termos de cadastro.' };
  }

  const password = (input.password || '').trim();
  if (password.length < 8) {
    throw { statusCode: 400, message: 'A senha deve ter no mínimo 8 caracteres.' };
  }
  if (input.confirmPassword != null && input.confirmPassword !== password) {
    throw { statusCode: 400, message: 'As senhas não coincidem.' };
  }

  const profissao = (input.profissao || '').trim();
  if (!profissao) {
    throw { statusCode: 400, message: 'Informe a profissão.' };
  }

  const nomeCompleto = (input.nomeCompleto || row.nome || '').trim();
  if (nomeCompleto.length < 3) {
    throw { statusCode: 400, message: 'Informe o nome completo.' };
  }

  const email = (input.email || row.email || '').trim().toLowerCase();
  if (!email.includes('@')) {
    throw { statusCode: 400, message: 'E-mail inválido.' };
  }

  const telefone = (input.telefone || row.telefone || '').trim();
  if (telefone.length < 8) {
    throw { statusCode: 400, message: 'Informe um telefone válido.' };
  }

  const cpf = (input.cpf || row.cpf || '').replace(/\D/g, '');
  if (!validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido.' };
  }

  const crmRaw = input.crm ?? row.crm;
  const crm = resolveRegistroConselhoParaCadastro(profissao, crmRaw);

  let especialidadesArr: string[] = [];
  const rawEsp = input.especialidades;
  if (Array.isArray(rawEsp)) {
    especialidadesArr = rawEsp.map((e) => String(e ?? '').trim()).filter(Boolean);
  } else if (typeof rawEsp === 'string' && rawEsp.trim()) {
    especialidadesArr = [rawEsp.trim()];
  } else if (row.especialidade?.trim()) {
    especialidadesArr = [row.especialidade.trim()];
  }
  const isMedico = profissao === 'Médico';
  const especialidadesFinal = isMedico
    ? especialidadesArr.length > 0
      ? especialidadesArr
      : ['Clínica Médica']
    : especialidadesArr;

  const existing = await prisma.medico.findFirst({
    where: {
      tenantId: row.tenantId,
      OR: [{ email }, { cpf }, ...(crm ? [{ crm }] : [])],
    },
    select: { id: true, statusCadastro: true },
  });
  if (existing) {
    throw {
      statusCode: 409,
      message:
        existing.statusCadastro === StatusCadastroMedico.PENDENTE_ANALISE
          ? 'Já existe cadastro em análise com estes dados. Use a área de Avaliação ou o login quando aprovado.'
          : 'Já existe profissional cadastrado com estes dados. Faça login ou use "Esqueci a senha".',
    };
  }

  const senhaHash = await hashPassword(password);

  const medico = await prisma.$transaction(async (tx) => {
    const created = await tx.medico.create({
      data: {
        tenantId: row.tenantId,
        nomeCompleto,
        email,
        cpf,
        profissao,
        crm,
        senhaHash,
        especialidades: especialidadesFinal,
        vinculo: 'Associado',
        telefone,
        ativo: true,
        statusCadastro: StatusCadastroMedico.ATIVO,
        termosCadastroAceitosEm: new Date(),
        termosCadastroVersao: TERMOS_CADASTRO_VERSAO,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        inviteAcceptedAt: new Date(),
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
      },
    });

    await tx.conteudoParticipante.update({
      where: { id: row.id },
      data: {
        precadastroStatus: ConteudoPrecadastroStatus.CONVERTIDO,
        tokenCadastroCorpo: null,
        medicoId: created.id,
        nome: nomeCompleto,
        email,
        telefone,
        cpf,
        crm,
      },
    });

    return created;
  });

  try {
    const { notificarBoasVindasMedico } = await import('./notificacao-medico.service');
    await notificarBoasVindasMedico(row.tenantId, medico.id, medico.nomeCompleto);
  } catch (err) {
    console.error('[precadastro-cadastro] boas-vindas:', err);
  }

  return {
    medico: {
      id: medico.id,
      nomeCompleto: medico.nomeCompleto,
      email: medico.email,
    },
    message:
      'Cadastro concluído. Você já faz parte do corpo clínico e pode entrar com o e-mail e a senha definidos.',
  };
}

export async function setCapaEventoAdminService(tenantId: string, id: string, capaUrl: string) {
  return updateEventoAdminService(tenantId, id, { capaUrl });
}

export async function getEventoCapaPathAdminService(tenantId: string, id: string) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { id, tenantId },
    select: { capaUrl: true },
  });
  if (!evento?.capaUrl) notFound('Capa não encontrada');
  return evento.capaUrl;
}

/* ——— Médico ——— */

export async function listEventosMedicoService(tenantId: string, medicoId: string) {
  const rows = await prisma.conteudoEvento.findMany({
    where: {
      tenantId,
      status: { in: [ConteudoEventoStatus.PUBLICADO, ConteudoEventoStatus.ENCERRADO] },
    },
    include: {
      palestrante: {
        select: { id: true, nome: true, bio: true, fotoUrl: true, especialidade: true },
      },
      participantes: {
        where: { medicoId },
        select: { id: true, presenteEm: true, avaliadoEm: true },
        take: 1,
      },
    },
    orderBy: [{ iniciaEm: 'desc' }],
  });

  return rows.map((e) =>
    formatEventoPublico({
      ...e,
      jaInscrito: e.participantes.length > 0,
      presenteEm: e.participantes[0]?.presenteEm ?? null,
      avaliadoEm: e.participantes[0]?.avaliadoEm ?? null,
    })
  );
}

export async function getEventoMedicoService(tenantId: string, medicoId: string, id: string) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: {
      id,
      tenantId,
      status: { in: [ConteudoEventoStatus.PUBLICADO, ConteudoEventoStatus.ENCERRADO] },
    },
    include: {
      palestrante: {
        select: { id: true, nome: true, bio: true, fotoUrl: true, especialidade: true },
      },
      participantes: {
        where: { medicoId },
        select: { id: true, presenteEm: true, avaliadoEm: true },
        take: 1,
      },
    },
  });
  if (!evento) notFound();
  return formatEventoPublico({
    ...evento,
    jaInscrito: evento.participantes.length > 0,
    presenteEm: evento.participantes[0]?.presenteEm ?? null,
    avaliadoEm: evento.participantes[0]?.avaliadoEm ?? null,
  });
}

export async function inscreverMedicoService(tenantId: string, medicoId: string, eventoId: string) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { id: eventoId, tenantId, status: ConteudoEventoStatus.PUBLICADO },
  });
  if (!evento) notFound('Evento não disponível para inscrição.');

  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, ativo: true },
  });
  if (!medico) throw { statusCode: 400, message: 'Perfil médico inválido.' };

  const email = (medico.email || '').trim().toLowerCase();
  if (!email) {
    throw { statusCode: 400, message: 'Atualize seu e-mail no perfil antes de se inscrever.' };
  }

  const existente = await prisma.conteudoParticipante.findFirst({
    where: {
      eventoId,
      OR: [{ medicoId }, { email }],
    },
  });
  if (existente) conflict('Você já está inscrito neste conteúdo.');

  try {
    const row = await prisma.conteudoParticipante.create({
      data: {
        tenantId,
        eventoId,
        origem: ConteudoParticipanteOrigem.MEDICO,
        perfil: ConteudoParticipantePerfil.MEDICO,
        medicoId,
        nome: medico.nomeCompleto,
        email,
        telefone: medico.telefone,
        consentimentoLgpd: true,
      },
    });
    return row;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      conflict('Você já está inscrito neste conteúdo.');
    }
    throw e;
  }
}

export async function confirmarPresencaMedicoService(
  tenantId: string,
  medicoId: string,
  eventoId: string,
  respostasRaw?: unknown
) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: {
      id: eventoId,
      tenantId,
      status: { in: [ConteudoEventoStatus.PUBLICADO, ConteudoEventoStatus.ENCERRADO] },
    },
  });
  if (!evento) notFound();
  if (!evento.frequenciaAberta) {
    throw { statusCode: 400, message: 'A frequência ainda não está aberta para este conteúdo.' };
  }

  const participante = await prisma.conteudoParticipante.findFirst({
    where: { eventoId, tenantId, medicoId },
  });
  if (!participante) {
    throw { statusCode: 400, message: 'Você precisa estar inscrito para confirmar presença.' };
  }

  const form = resolverFormAvaliacaoEvento(evento);
  const respostas = prepararRespostasSeNecessario(form, respostasRaw, !!participante.avaliadoEm);

  if (participante.presenteEm) {
    // Já presente: ainda pode enviar avaliação pendente
    if (respostas) {
      const updated = await prisma.conteudoParticipante.update({
        where: { id: participante.id },
        data: {
          avaliacaoRespostas: respostas as unknown as Prisma.InputJsonValue,
          avaliadoEm: new Date(),
        },
      });
      return {
        presenteEm: updated.presenteEm!.toISOString(),
        jaRegistrado: true,
        avaliadoEm: updated.avaliadoEm!.toISOString(),
      };
    }
    return {
      presenteEm: participante.presenteEm.toISOString(),
      jaRegistrado: true,
      avaliadoEm: participante.avaliadoEm?.toISOString() ?? null,
    };
  }

  const updated = await prisma.conteudoParticipante.update({
    where: { id: participante.id },
    data: {
      presenteEm: new Date(),
      presencaOrigem: ConteudoPresencaOrigem.APP,
      ...(respostas
        ? {
            avaliacaoRespostas: respostas as unknown as Prisma.InputJsonValue,
            avaliadoEm: new Date(),
          }
        : {}),
    },
  });

  return {
    presenteEm: updated.presenteEm!.toISOString(),
    jaRegistrado: false,
    avaliadoEm: updated.avaliadoEm?.toISOString() ?? null,
  };
}

/* ——— Públicos (token) ——— */

export async function getPublicPalestranteFormService(token: string) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { tokenPalestrante: token },
    include: {
      palestrante: { select: palestranteSelect },
    },
  });
  if (!evento) notFound('Convite de palestrante inválido ou expirado.');

  return {
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      iniciaEm: evento.iniciaEm.toISOString(),
    },
    palestrante: evento.palestrante,
  };
}

export async function submitPublicPalestranteFormService(
  token: string,
  input: {
    nome: string;
    email: string;
    telefone?: string | null;
    cpf?: string | null;
    bio?: string | null;
    crm?: string | null;
    especialidade?: string | null;
  }
) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { tokenPalestrante: token },
  });
  if (!evento) notFound('Convite de palestrante inválido ou expirado.');

  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  if (nome.length < 2) throw { statusCode: 400, message: 'Informe o nome completo.' };
  if (!email.includes('@')) throw { statusCode: 400, message: 'E-mail inválido.' };

  const cpf = (input.cpf || '').replace(/\D/g, '');
  if (!validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido.' };
  }

  const data = {
    nome,
    email,
    telefone: input.telefone?.trim() || null,
    cpf,
    bio: input.bio?.trim() || null,
    crm: input.crm?.trim() || null,
    especialidade: input.especialidade?.trim() || null,
    status: ConteudoPalestranteStatus.COMPLETO,
  };

  if (evento.palestranteId) {
    const palestrante = await prisma.conteudoPalestrante.update({
      where: { id: evento.palestranteId },
      data,
      select: palestranteSelect,
    });
    return { palestrante, eventoTitulo: evento.titulo };
  }

  const palestrante = await prisma.conteudoPalestrante.create({
    data: {
      tenantId: evento.tenantId,
      ...data,
    },
    select: palestranteSelect,
  });

  await prisma.conteudoEvento.update({
    where: { id: evento.id },
    data: { palestranteId: palestrante.id },
  });

  return { palestrante, eventoTitulo: evento.titulo };
}

export async function getPublicInscricaoFormService(token: string) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { tokenInscricao: token },
    include: {
      palestrante: {
        select: { id: true, nome: true, bio: true, fotoUrl: true, especialidade: true },
      },
    },
  });
  if (!evento) notFound('Link de inscrição inválido.');
  if (evento.status === ConteudoEventoStatus.ENCERRADO) {
    throw { statusCode: 400, message: 'Este conteúdo já foi encerrado.' };
  }
  if (evento.status === ConteudoEventoStatus.RASCUNHO) {
    throw { statusCode: 400, message: 'Este conteúdo ainda não está aberto para inscrição.' };
  }

  return {
    evento: formatEventoPublico(evento),
  };
}

export async function submitPublicInscricaoService(
  token: string,
  input: {
    nome: string;
    email: string;
    telefone?: string | null;
    perfil?: 'MEDICO' | 'ESTUDANTE';
    crm?: string | null;
    especialidade?: string | null;
    cidade?: string | null;
    cpf?: string | null;
    faculdade?: string | null;
    semestre?: string | null;
    participaLiga?: boolean | null;
    ligaNome?: string | null;
    interesseCorpoClinico?: boolean;
    consentimentoLgpd: boolean;
  }
) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { tokenInscricao: token },
  });
  if (!evento) notFound('Link de inscrição inválido.');
  if (evento.status !== ConteudoEventoStatus.PUBLICADO) {
    throw { statusCode: 400, message: 'Inscrições não estão abertas para este conteúdo.' };
  }

  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  const telefone = input.telefone?.trim() || '';
  const perfil =
    input.perfil === 'ESTUDANTE'
      ? ConteudoParticipantePerfil.ESTUDANTE
      : ConteudoParticipantePerfil.MEDICO;

  if (nome.length < 2) throw { statusCode: 400, message: 'Informe o nome completo.' };
  if (!email.includes('@')) throw { statusCode: 400, message: 'E-mail inválido.' };
  if (telefone.length < 8) {
    throw { statusCode: 400, message: 'Informe um telefone/WhatsApp válido.' };
  }
  const cpf = (input.cpf || '').replace(/\D/g, '');
  if (!validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido.' };
  }
  if (!input.consentimentoLgpd) {
    throw { statusCode: 400, message: 'É necessário aceitar o consentimento LGPD.' };
  }

  let crm: string | null = null;
  let especialidade: string | null = null;
  let faculdade: string | null = null;
  let semestre: string | null = null;
  let participaLiga: boolean | null = null;
  let ligaNome: string | null = null;

  if (perfil === ConteudoParticipantePerfil.ESTUDANTE) {
    faculdade = input.faculdade?.trim() || null;
    semestre = input.semestre?.trim() || null;
    if (!faculdade || faculdade.length < 2) {
      throw { statusCode: 400, message: 'Informe a faculdade.' };
    }
    if (!semestre) {
      throw { statusCode: 400, message: 'Informe o semestre.' };
    }
    participaLiga = input.participaLiga === true;
    ligaNome = participaLiga ? input.ligaNome?.trim() || null : null;
    if (participaLiga && (!ligaNome || ligaNome.length < 2)) {
      throw { statusCode: 400, message: 'Informe qual liga você participa.' };
    }
  } else {
    crm = input.crm?.trim() || null;
    especialidade = input.especialidade?.trim() || null;
  }

  const existente = await prisma.conteudoParticipante.findFirst({
    where: { eventoId: evento.id, email },
  });
  if (existente) conflict('Este e-mail já está inscrito neste conteúdo.');

  try {
    return await prisma.conteudoParticipante.create({
      data: {
        tenantId: evento.tenantId,
        eventoId: evento.id,
        origem: ConteudoParticipanteOrigem.EXTERNO,
        perfil,
        nome,
        email,
        telefone,
        cpf,
        crm,
        especialidade,
        cidade: input.cidade?.trim() || null,
        faculdade,
        semestre,
        participaLiga,
        ligaNome,
        interesseCorpoClinico: input.interesseCorpoClinico !== false,
        consentimentoLgpd: true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      conflict('Este e-mail já está inscrito neste conteúdo.');
    }
    throw e;
  }
}

export async function getPublicFrequenciaService(token: string) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { tokenFrequencia: token },
    select: {
      id: true,
      titulo: true,
      iniciaEm: true,
      frequenciaAberta: true,
      status: true,
      avaliacaoAtiva: true,
      avaliacaoFormulario: true,
      palestrante: { select: { nome: true } },
    },
  });
  if (!evento) notFound('Link de frequência inválido.');

  const form = resolverFormAvaliacaoEvento(evento);

  return {
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      iniciaEm: evento.iniciaEm.toISOString(),
      status: evento.status,
      frequenciaAberta: evento.frequenciaAberta,
      palestranteNome: evento.palestrante?.nome ?? null,
      avaliacaoAtiva: !!form,
      avaliacao: form ? formAvaliacaoSemGabarito(form) : null,
    },
  };
}

export async function submitPublicFrequenciaService(
  token: string,
  emailRaw: string,
  respostasRaw?: unknown
) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { tokenFrequencia: token },
  });
  if (!evento) notFound('Link de frequência inválido.');
  if (!evento.frequenciaAberta) {
    throw { statusCode: 400, message: 'A frequência não está aberta no momento.' };
  }

  const form = resolverFormAvaliacaoEvento(evento);
  // Se avaliação ativa, validamos respostas antes (anti-enumeração: se e-mail inválido ainda devolvemos ack genérico
  // apenas se respostas forem válidas quando form ativo).
  let respostasValidas: AvaliacaoRespostasMap | null = null;
  if (form) {
    if (respostasRaw === undefined || respostasRaw === null) {
      throw {
        statusCode: 400,
        message: 'Preencha a avaliação da aula para confirmar a presença.',
      };
    }
    respostasValidas = validarRespostasAvaliacao(form, respostasRaw);
  }

  const email = (emailRaw || '').trim().toLowerCase();
  const ack = {
    presenteEm: null as string | null,
    jaRegistrado: false,
    registrado: false,
    avaliadoEm: null as string | null,
  };

  if (!email.includes('@')) {
    return ack;
  }

  const participante = await prisma.conteudoParticipante.findFirst({
    where: { eventoId: evento.id, email },
  });
  if (!participante) {
    return ack;
  }

  if (participante.presenteEm) {
    if (respostasValidas && !participante.avaliadoEm) {
      const updated = await prisma.conteudoParticipante.update({
        where: { id: participante.id },
        data: {
          avaliacaoRespostas: respostasValidas as unknown as Prisma.InputJsonValue,
          avaliadoEm: new Date(),
        },
      });
      console.log(
        `[conteudos] frequencia+avaliacao (já presente) email=${email} evento=${evento.id}`
      );
      return {
        presenteEm: updated.presenteEm!.toISOString(),
        jaRegistrado: true,
        registrado: true,
        avaliadoEm: updated.avaliadoEm!.toISOString(),
      };
    }
    return {
      presenteEm: participante.presenteEm.toISOString(),
      jaRegistrado: true,
      registrado: true,
      avaliadoEm: participante.avaliadoEm?.toISOString() ?? null,
    };
  }

  const updated = await prisma.conteudoParticipante.update({
    where: { id: participante.id },
    data: {
      presenteEm: new Date(),
      presencaOrigem: ConteudoPresencaOrigem.LINK_PUBLICO,
      ...(respostasValidas
        ? {
            avaliacaoRespostas: respostasValidas as unknown as Prisma.InputJsonValue,
            avaliadoEm: new Date(),
          }
        : {}),
    },
  });

  console.log(
    `[conteudos] frequencia${respostasValidas ? '+avaliacao' : ''} email=${email} evento=${evento.id} avaliou=${!!respostasValidas}`
  );

  return {
    presenteEm: updated.presenteEm!.toISOString(),
    jaRegistrado: false,
    registrado: true,
    avaliadoEm: updated.avaliadoEm?.toISOString() ?? null,
  };
}

export async function getCapaByInscricaoTokenService(token: string) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: { tokenInscricao: token },
    select: { capaUrl: true, status: true },
  });
  if (!evento?.capaUrl) notFound('Capa não encontrada');
  return evento.capaUrl;
}

export async function getCapaByEventoPublicadoService(tenantId: string, eventoId: string) {
  const evento = await prisma.conteudoEvento.findFirst({
    where: {
      id: eventoId,
      tenantId,
      status: { in: [ConteudoEventoStatus.PUBLICADO, ConteudoEventoStatus.ENCERRADO] },
    },
    select: { capaUrl: true },
  });
  if (!evento?.capaUrl) notFound('Capa não encontrada');
  return evento.capaUrl;
}
