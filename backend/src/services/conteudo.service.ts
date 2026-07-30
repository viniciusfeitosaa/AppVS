import {
  ConteudoEventoStatus,
  ConteudoPalestranteStatus,
  ConteudoParticipanteOrigem,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/database';
import { getFrontendAppBaseUrl } from '../utils/email-branding.util';
import { newConteudoToken, parseYoutubeUrl, youtubeEmbedUrl } from '../utils/conteudo.util';

const palestranteSelect = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
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
    createdAt: Date;
    updatedAt: Date;
    palestrante: Prisma.ConteudoPalestranteGetPayload<{ select: typeof palestranteSelect }> | null;
    _count?: { participantes: number };
  },
  opts?: { includeTokens?: boolean }
) {
  const base = getFrontendAppBaseUrl();
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
    participantesCount: evento._count?.participantes ?? undefined,
    createdAt: evento.createdAt.toISOString(),
    updatedAt: evento.updatedAt.toISOString(),
    ...(opts?.includeTokens
      ? {
          tokenPalestrante: evento.tokenPalestrante,
          tokenInscricao: evento.tokenInscricao,
          linkPalestrante: `${base}/conteudos/palestrante/${evento.tokenPalestrante}`,
          linkInscricao: `${base}/conteudos/inscricao/${evento.tokenInscricao}`,
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
  palestrante: { id: string; nome: string; bio: string | null; fotoUrl: string | null; especialidade: string | null } | null;
  jaInscrito?: boolean;
}) {
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
  };
}

export async function listPalestrantesAdminService(tenantId: string, q?: string) {
  const where: Prisma.ConteudoPalestranteWhereInput = { tenantId };
  if (q?.trim()) {
    where.OR = [
      { nome: { contains: q.trim(), mode: 'insensitive' } },
      { email: { contains: q.trim(), mode: 'insensitive' } },
    ];
  }
  return prisma.conteudoPalestrante.findMany({
    where,
    select: palestranteSelect,
    orderBy: { nome: 'asc' },
    take: 50,
  });
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
  return formatEventoAdmin(evento, { includeTokens: true });
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
  if (status === ConteudoEventoStatus.PUBLICADO && !yt.youtubeVideoId) {
    throw { statusCode: 400, message: 'Informe o link do YouTube antes de publicar.' };
  }

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

  const nextStatus = input.status ?? existing.status;
  const nextYoutubeId =
    input.youtubeUrl !== undefined
      ? resolveYoutubeFields(input.youtubeUrl).youtubeVideoId
      : existing.youtubeVideoId;
  if (nextStatus === ConteudoEventoStatus.PUBLICADO && !nextYoutubeId) {
    throw { statusCode: 400, message: 'Informe o link do YouTube antes de publicar.' };
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
  if (status === ConteudoEventoStatus.PUBLICADO) {
    const existing = await prisma.conteudoEvento.findFirst({ where: { id, tenantId } });
    if (!existing) notFound();
    if (!existing.youtubeVideoId) {
      throw { statusCode: 400, message: 'Informe o link do YouTube antes de publicar.' };
    }
  }
  return updateEventoAdminService(tenantId, id, { status });
}

export async function regenerarTokenAdminService(
  tenantId: string,
  id: string,
  tipo: 'palestrante' | 'inscricao'
) {
  const existing = await prisma.conteudoEvento.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();

  const data =
    tipo === 'palestrante'
      ? { tokenPalestrante: newConteudoToken() }
      : { tokenInscricao: newConteudoToken() };

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
      nome: true,
      email: true,
      telefone: true,
      crm: true,
      especialidade: true,
      cidade: true,
      interesseCorpoClinico: true,
      medicoId: true,
      consentimentoLgpd: true,
      createdAt: true,
    },
  });
}

/** Lista unificada de precadastros (inscritos externos) de todos os conteúdos. */
export async function listPrecadastrosAdminService(tenantId: string) {
  const rows = await prisma.conteudoParticipante.findMany({
    where: { tenantId, origem: ConteudoParticipanteOrigem.EXTERNO },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      crm: true,
      especialidade: true,
      cidade: true,
      interesseCorpoClinico: true,
      consentimentoLgpd: true,
      createdAt: true,
      evento: {
        select: { id: true, titulo: true, iniciaEm: true, status: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    email: r.email,
    telefone: r.telefone,
    crm: r.crm,
    especialidade: r.especialidade,
    cidade: r.cidade,
    interesseCorpoClinico: r.interesseCorpoClinico,
    consentimentoLgpd: r.consentimentoLgpd,
    createdAt: r.createdAt.toISOString(),
    evento: {
      id: r.evento.id,
      titulo: r.evento.titulo,
      iniciaEm: r.evento.iniciaEm.toISOString(),
      status: r.evento.status,
    },
    /** Linha única para leitura rápida no Master. */
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
  }));
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
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ iniciaEm: 'desc' }],
  });

  return rows.map((e) =>
    formatEventoPublico({
      ...e,
      jaInscrito: e.participantes.length > 0,
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
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!evento) notFound();
  return formatEventoPublico({
    ...evento,
    jaInscrito: evento.participantes.length > 0,
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
    bio?: string | null;
    fotoUrl?: string | null;
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

  const data = {
    nome,
    email,
    telefone: input.telefone?.trim() || null,
    bio: input.bio?.trim() || null,
    fotoUrl: input.fotoUrl?.trim() || null,
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
    crm?: string | null;
    especialidade?: string | null;
    cidade?: string | null;
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
  if (nome.length < 2) throw { statusCode: 400, message: 'Informe o nome completo.' };
  if (!email.includes('@')) throw { statusCode: 400, message: 'E-mail inválido.' };
  if (telefone.length < 8) {
    throw { statusCode: 400, message: 'Informe um telefone/WhatsApp válido.' };
  }
  if (!input.consentimentoLgpd) {
    throw { statusCode: 400, message: 'É necessário aceitar o consentimento LGPD.' };
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
        nome,
        email,
        telefone,
        crm: input.crm?.trim() || null,
        especialidade: input.especialidade?.trim() || null,
        cidade: input.cidade?.trim() || null,
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
