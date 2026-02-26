import { prisma } from '../config/database';
import { hashPassword } from '../utils/password.util';
import { normalizeCRM, validateCPF, validateCRM } from '../utils/validation.util';
import { createAuditLog } from './auditoria.service';
import crypto from 'crypto';

interface ListMedicosParams {
  tenantId: string;
  page?: number;
  limit?: number;
  search?: string;
  ativo?: boolean;
}

interface CreateMedicoInput {
  tenantId: string;
  masterId: string;
  nomeCompleto: string;
  cpf: string;
  crm: string;
  email?: string | null;
  especialidade?: string | null;
  vinculo?: string | null;
  telefone?: string | null;
  senha?: string;
}

interface UpdateMedicoInput {
  tenantId: string;
  masterId: string;
  medicoId: string;
  nomeCompleto?: string;
  cpf?: string;
  crm?: string;
  email?: string | null;
  especialidade?: string | null;
  vinculo?: string | null;
  telefone?: string | null;
}

interface ListContratosAtivosParams {
  tenantId: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface CreateContratoAtivoInput {
  tenantId: string;
  masterId: string;
  nome: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  ativo?: boolean;
  usaEscala?: boolean;
  usaPonto?: boolean;
}

interface UpdateContratoAtivoInput {
  tenantId: string;
  masterId: string;
  contratoId: string;
  nome?: string;
  descricao?: string | null;
  dataInicio?: string;
  dataFim?: string | null;
  ativo?: boolean;
  usaEscala?: boolean;
  usaPonto?: boolean;
}

interface ListEscalasParams {
  tenantId: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface CreateEscalaInput {
  tenantId: string;
  masterId: string;
  contratoAtivoId: string;
  nome: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim: string;
  ativo?: boolean;
}

interface UpdateEscalaInput {
  tenantId: string;
  masterId: string;
  escalaId: string;
  contratoAtivoId?: string;
  nome?: string;
  descricao?: string | null;
  dataInicio?: string;
  dataFim?: string;
  ativo?: boolean;
}

interface AlocarMedicoEscalaInput {
  tenantId: string;
  masterId: string;
  escalaId: string;
  medicoId: string;
  cargo?: string | null;
  valorHora?: number | null;
}

export async function listMedicosService(params: ListMedicosParams) {
  const page = Math.max(params.page || 1, 1);
  const limit = Math.min(Math.max(params.limit || 10, 1), 2000);
  const skip = (page - 1) * limit;
  const search = params.search?.trim();

  const cpfSearch = search?.replace(/\D/g, '');
  const searchFilters = search
    ? [
        { nomeCompleto: { contains: search, mode: 'insensitive' as const } },
        { crm: { contains: search, mode: 'insensitive' as const } },
        ...(cpfSearch
          ? [{ cpf: { contains: cpfSearch, mode: 'insensitive' as const } }]
          : []),
      ]
    : [];

  const where = {
    tenantId: params.tenantId,
    ...(searchFilters.length ? { OR: searchFilters } : {}),
    ...(params.ativo !== undefined ? { ativo: params.ativo } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.medico.findMany({
      where,
      select: {
        id: true,
        nomeCompleto: true,
        cpf: true,
        crm: true,
        email: true,
        especialidade: true,
        vinculo: true,
        telefone: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { nomeCompleto: 'asc' },
      skip,
      take: limit,
    }),
    prisma.medico.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createMedicoService(input: CreateMedicoInput) {
  const cpf = input.cpf.replace(/\D/g, '');
  const crm = normalizeCRM(input.crm);
  const email = input.email?.trim().toLowerCase() || null;

  if (!validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido' };
  }

  if (!crm || !validateCRM(crm)) {
    throw { statusCode: 400, message: 'CRM inválido' };
  }

  const [existingByCpf, existingByCrm] = await Promise.all([
    prisma.medico.findFirst({ where: { tenantId: input.tenantId, cpf } }),
    prisma.medico.findFirst({ where: { tenantId: input.tenantId, crm } }),
  ]);

  if (existingByCpf) {
    throw { statusCode: 409, message: 'Já existe médico com este CPF' };
  }

  if (existingByCrm) {
    throw { statusCode: 409, message: 'Já existe médico com este CRM' };
  }

  if (email) {
    const existingByEmail = await prisma.medico.findFirst({
      where: { tenantId: input.tenantId, email },
    });
    if (existingByEmail) {
      throw { statusCode: 409, message: 'Já existe médico com este e-mail' };
    }
  }

  const senhaHash = await hashPassword(input.senha || 'viva@2026');

  const medico = await prisma.medico.create({
    data: {
      tenantId: input.tenantId,
      nomeCompleto: input.nomeCompleto.trim(),
      cpf,
      crm,
      email,
      especialidade: input.especialidade?.trim() || null,
      vinculo: input.vinculo?.trim() || null,
      telefone: input.telefone?.trim() || null,
      senhaHash,
      ativo: true,
    },
  });

  await createAuditLog({
    acao: 'CRIAR_MEDICO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { medicoId: medico.id, cpf: medico.cpf, crm: medico.crm },
  });

  return medico;
}

export async function updateMedicoService(input: UpdateMedicoInput) {
  const medico = await prisma.medico.findFirst({
    where: { id: input.medicoId, tenantId: input.tenantId },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  const cpf = input.cpf ? input.cpf.replace(/\D/g, '') : undefined;
  const crm = input.crm ? normalizeCRM(input.crm) || undefined : undefined;
  const email = input.email === undefined ? undefined : input.email?.trim().toLowerCase() || null;

  if (cpf && !validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido' };
  }

  if (crm && !validateCRM(crm)) {
    throw { statusCode: 400, message: 'CRM inválido' };
  }

  if (cpf && cpf !== medico.cpf) {
    const existingByCpf = await prisma.medico.findFirst({
      where: { tenantId: input.tenantId, cpf, NOT: { id: medico.id } },
    });
    if (existingByCpf) {
      throw { statusCode: 409, message: 'Já existe médico com este CPF' };
    }
  }

  if (crm && crm !== medico.crm) {
    const existingByCrm = await prisma.medico.findFirst({
      where: { tenantId: input.tenantId, crm, NOT: { id: medico.id } },
    });
    if (existingByCrm) {
      throw { statusCode: 409, message: 'Já existe médico com este CRM' };
    }
  }

  if (email !== undefined && email !== medico.email && email !== null) {
    const existingByEmail = await prisma.medico.findFirst({
      where: { tenantId: input.tenantId, email, NOT: { id: medico.id } },
    });
    if (existingByEmail) {
      throw { statusCode: 409, message: 'Já existe médico com este e-mail' };
    }
  }

  const updated = await prisma.medico.update({
    where: { id: medico.id },
    data: {
      nomeCompleto: input.nomeCompleto?.trim() || undefined,
      cpf,
      crm,
      email,
      especialidade: input.especialidade === undefined ? undefined : input.especialidade?.trim() || null,
      vinculo: input.vinculo === undefined ? undefined : input.vinculo?.trim() || null,
      telefone: input.telefone === undefined ? undefined : input.telefone?.trim() || null,
    },
  });

  await createAuditLog({
    acao: 'ATUALIZAR_MEDICO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { medicoId: updated.id },
  });

  return updated;
}

export async function inviteMedicoService(
  tenantId: string,
  masterId: string,
  medicoId: string
) {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: { id: true, email: true, nomeCompleto: true },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  if (!medico.email) {
    throw { statusCode: 400, message: 'Médico sem e-mail cadastrado para envio de convite' };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

  await prisma.medico.update({
    where: { id: medico.id },
    data: {
      inviteTokenHash: tokenHash,
      inviteExpiresAt: expiresAt,
      inviteAcceptedAt: null,
    },
  });

  await createAuditLog({
    acao: 'CONVIDAR_MEDICO',
    tenantId,
    masterId,
    medicoId: medico.id,
    detalhes: {
      email: medico.email,
      expiresAt: expiresAt.toISOString(),
    },
  });

  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/ativar-conta/${rawToken}`;

  return {
    medicoId: medico.id,
    nomeCompleto: medico.nomeCompleto,
    email: medico.email,
    inviteUrl,
    expiresAt,
    token: rawToken,
  };
}

export async function toggleMedicoAtivoService(
  tenantId: string,
  masterId: string,
  medicoId: string,
  ativo: boolean
) {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  const updated = await prisma.medico.update({
    where: { id: medico.id },
    data: { ativo },
  });

  await createAuditLog({
    acao: ativo ? 'ATIVAR_MEDICO' : 'INATIVAR_MEDICO',
    tenantId,
    masterId,
    detalhes: { medicoId: updated.id, ativo },
  });

  return updated;
}

export async function listContratosAtivosService(params: ListContratosAtivosParams) {
  const page = Math.max(params.page || 1, 1);
  const limit = Math.min(Math.max(params.limit || 10, 1), 100);
  const skip = (page - 1) * limit;
  const search = params.search?.trim();

  const where = {
    tenantId: params.tenantId,
    ...(search
      ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' as const } },
            { descricao: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.contratoAtivo.findMany({
      where,
      orderBy: [{ ativo: 'desc' }, { dataInicio: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.contratoAtivo.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createContratoAtivoService(input: CreateContratoAtivoInput) {
  if (!input.nome?.trim()) {
    throw { statusCode: 400, message: 'Nome do contrato é obrigatório' };
  }

  if (!input.dataInicio) {
    throw { statusCode: 400, message: 'Data de início é obrigatória' };
  }

  const usaEscala = input.usaEscala ?? true;
  const usaPonto = input.usaPonto ?? true;
  if (!usaEscala && !usaPonto) {
    throw { statusCode: 400, message: 'Selecione ao menos uma opção: usar escalas ou usar ponto eletrônico' };
  }

  const contrato = await prisma.contratoAtivo.create({
    data: {
      tenantId: input.tenantId,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      dataInicio: new Date(input.dataInicio),
      dataFim: input.dataFim ? new Date(input.dataFim) : null,
      ativo: input.ativo ?? true,
      usaEscala,
      usaPonto,
    },
  });

  await createAuditLog({
    acao: 'CRIAR_CONTRATO_ATIVO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { contratoId: contrato.id, nome: contrato.nome },
  });

  return contrato;
}

export async function updateContratoAtivoService(input: UpdateContratoAtivoInput) {
  const contrato = await prisma.contratoAtivo.findFirst({
    where: { id: input.contratoId, tenantId: input.tenantId },
  });

  if (!contrato) {
    throw { statusCode: 404, message: 'Contrato não encontrado' };
  }

  if (input.usaEscala === false && input.usaPonto === false) {
    throw { statusCode: 400, message: 'Selecione ao menos uma opção: usar escalas ou usar ponto eletrônico' };
  }

  const updated = await prisma.contratoAtivo.update({
    where: { id: contrato.id },
    data: {
      nome: input.nome?.trim() || undefined,
      descricao: input.descricao === undefined ? undefined : input.descricao?.trim() || null,
      dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
      dataFim: input.dataFim === undefined ? undefined : input.dataFim ? new Date(input.dataFim) : null,
      ativo: input.ativo,
      usaEscala: input.usaEscala,
      usaPonto: input.usaPonto,
    },
  });

  await createAuditLog({
    acao: 'ATUALIZAR_CONTRATO_ATIVO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { contratoId: updated.id, nome: updated.nome },
  });

  return updated;
}

export async function deleteContratoAtivoService(
  tenantId: string,
  masterId: string,
  contratoId: string
) {
  const contrato = await prisma.contratoAtivo.findFirst({
    where: { id: contratoId, tenantId },
  });

  if (!contrato) {
    throw { statusCode: 404, message: 'Contrato não encontrado' };
  }

  await prisma.contratoAtivo.delete({
    where: { id: contrato.id },
  });

  await createAuditLog({
    acao: 'EXCLUIR_CONTRATO_ATIVO',
    tenantId,
    masterId,
    detalhes: { contratoId: contrato.id, nome: contrato.nome },
  });
}

export async function listEscalasService(params: ListEscalasParams) {
  const page = Math.max(params.page || 1, 1);
  const limit = Math.min(Math.max(params.limit || 10, 1), 100);
  const skip = (page - 1) * limit;
  const search = params.search?.trim();

  const where = {
    tenantId: params.tenantId,
    ...(search
      ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' as const } },
            { descricao: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.escala.findMany({
      where,
      include: {
        contratoAtivo: {
          select: { id: true, nome: true, ativo: true },
        },
        _count: {
          select: { alocacoes: true },
        },
      },
      orderBy: [{ ativo: 'desc' }, { dataInicio: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.escala.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createEscalaService(input: CreateEscalaInput) {
  if (!input.nome?.trim()) {
    throw { statusCode: 400, message: 'Nome da escala é obrigatório' };
  }

  if (!input.contratoAtivoId) {
    throw { statusCode: 400, message: 'Contrato ativo é obrigatório' };
  }

  const contrato = await prisma.contratoAtivo.findFirst({
    where: { id: input.contratoAtivoId, tenantId: input.tenantId },
  });

  if (!contrato) {
    throw { statusCode: 404, message: 'Contrato ativo não encontrado' };
  }

  const escala = await prisma.escala.create({
    data: {
      tenantId: input.tenantId,
      contratoAtivoId: input.contratoAtivoId,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      dataInicio: new Date(input.dataInicio),
      dataFim: new Date(input.dataFim),
      ativo: input.ativo ?? true,
    },
  });

  await createAuditLog({
    acao: 'CRIAR_ESCALA',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { escalaId: escala.id, nome: escala.nome },
  });

  return escala;
}

export async function updateEscalaService(input: UpdateEscalaInput) {
  const escala = await prisma.escala.findFirst({
    where: { id: input.escalaId, tenantId: input.tenantId },
  });

  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada' };
  }

  if (input.contratoAtivoId) {
    const contrato = await prisma.contratoAtivo.findFirst({
      where: { id: input.contratoAtivoId, tenantId: input.tenantId },
    });
    if (!contrato) {
      throw { statusCode: 404, message: 'Contrato ativo não encontrado' };
    }
  }

  const updated = await prisma.escala.update({
    where: { id: escala.id },
    data: {
      contratoAtivoId: input.contratoAtivoId || undefined,
      nome: input.nome?.trim() || undefined,
      descricao: input.descricao === undefined ? undefined : input.descricao?.trim() || null,
      dataInicio: input.dataInicio ? new Date(input.dataInicio) : undefined,
      dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
      ativo: input.ativo,
    },
  });

  await createAuditLog({
    acao: 'ATUALIZAR_ESCALA',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: { escalaId: updated.id, nome: updated.nome },
  });

  return updated;
}

export async function deleteEscalaService(tenantId: string, masterId: string, escalaId: string) {
  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId },
  });

  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada' };
  }

  await prisma.escala.delete({ where: { id: escala.id } });

  await createAuditLog({
    acao: 'EXCLUIR_ESCALA',
    tenantId,
    masterId,
    detalhes: { escalaId: escala.id, nome: escala.nome },
  });
}

export async function listEscalaMedicosService(tenantId: string, escalaId: string) {
  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId },
  });

  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada' };
  }

  return prisma.escalaMedico.findMany({
    where: { tenantId, escalaId },
    include: {
      medico: {
        select: {
          id: true,
          nomeCompleto: true,
          crm: true,
          email: true,
          especialidade: true,
          vinculo: true,
          ativo: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function alocarMedicoEscalaService(input: AlocarMedicoEscalaInput) {
  const [escala, medico] = await Promise.all([
    prisma.escala.findFirst({
      where: { id: input.escalaId, tenantId: input.tenantId, ativo: true },
    }),
    prisma.medico.findFirst({
      where: { id: input.medicoId, tenantId: input.tenantId, ativo: true },
    }),
  ]);

  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada ou inativa' };
  }
  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado ou inativo' };
  }

  const alocacao = await prisma.escalaMedico.upsert({
    where: {
      tenantId_escalaId_medicoId: {
        tenantId: input.tenantId,
        escalaId: input.escalaId,
        medicoId: input.medicoId,
      },
    },
    update: {
      cargo: input.cargo?.trim() || null,
      valorHora: input.valorHora ?? null,
      ativo: true,
    },
    create: {
      tenantId: input.tenantId,
      escalaId: input.escalaId,
      medicoId: input.medicoId,
      cargo: input.cargo?.trim() || null,
      valorHora: input.valorHora ?? null,
      ativo: true,
    },
  });

  await createAuditLog({
    acao: 'ALOCAR_MEDICO_ESCALA',
    tenantId: input.tenantId,
    masterId: input.masterId,
    medicoId: input.medicoId,
    detalhes: { escalaId: input.escalaId, alocacaoId: alocacao.id },
  });

  return alocacao;
}

export async function removerMedicoEscalaService(
  tenantId: string,
  masterId: string,
  escalaId: string,
  medicoId: string
) {
  const alocacao = await prisma.escalaMedico.findFirst({
    where: { tenantId, escalaId, medicoId },
  });

  if (!alocacao) {
    throw { statusCode: 404, message: 'Alocação não encontrada' };
  }

  await prisma.escalaMedico.delete({ where: { id: alocacao.id } });

  await createAuditLog({
    acao: 'REMOVER_MEDICO_ESCALA',
    tenantId,
    masterId,
    medicoId,
    detalhes: { escalaId },
  });
}

export async function listRegistrosPontoAdminService(
  tenantId: string,
  filters: { escalaId?: string; medicoId?: string; dataInicio?: string; dataFim?: string }
) {
  const where: any = {
    tenantId,
    ...(filters.escalaId ? { escalaId: filters.escalaId } : {}),
    ...(filters.medicoId ? { medicoId: filters.medicoId } : {}),
    ...(filters.dataInicio || filters.dataFim
      ? {
          checkInAt: {
            ...(filters.dataInicio ? { gte: new Date(filters.dataInicio) } : {}),
            ...(filters.dataFim ? { lte: new Date(filters.dataFim) } : {}),
          },
        }
      : {}),
  };

  return prisma.registroPonto.findMany({
    where,
    include: {
      medico: {
        select: { id: true, nomeCompleto: true, crm: true, email: true },
      },
      escala: {
        select: { id: true, nome: true, dataInicio: true, dataFim: true },
      },
    },
    orderBy: { checkInAt: 'desc' },
  });
}

export async function listEscalaPlantoesService(
  tenantId: string,
  escalaId: string,
  filters: { dataInicio?: string; dataFim?: string }
) {
  const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : undefined;
  const dataFim = filters.dataFim ? new Date(filters.dataFim) : undefined;

  const where: any = {
    tenantId,
    escalaId,
  };
  if (dataInicio || dataFim) {
    where.data = {};
    if (dataInicio) where.data.gte = dataInicio;
    if (dataFim) where.data.lte = dataFim;
  }

  return prisma.escalaPlantao.findMany({
    where,
    include: {
      medico: {
        select: { id: true, nomeCompleto: true, crm: true, email: true, telefone: true },
      },
    },
    orderBy: [{ data: 'asc' }, { gradeId: 'asc' }],
  });
}

export async function createEscalaPlantaoService(input: {
  tenantId: string;
  masterId: string;
  escalaId: string;
  data: string;
  gradeId: string;
  medicoId: string;
  valorHora?: number | null;
}) {
  const dataDate = new Date(input.data);
  if (isNaN(dataDate.getTime())) {
    throw { statusCode: 400, message: 'Data inválida' };
  }
  const [escala, medico] = await Promise.all([
    prisma.escala.findFirst({
      where: { id: input.escalaId, tenantId: input.tenantId, ativo: true },
    }),
    prisma.medico.findFirst({
      where: { id: input.medicoId, tenantId: input.tenantId, ativo: true },
    }),
  ]);

  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada ou inativa' };
  }
  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado ou inativo' };
  }

  const valorHora = input.valorHora != null ? Number(input.valorHora) : null;

  const plantao = await prisma.escalaPlantao.upsert({
    where: {
      escalaId_data_gradeId: {
        escalaId: input.escalaId,
        data: dataDate,
        gradeId: input.gradeId,
      },
    },
    update: { medicoId: input.medicoId, valorHora },
    create: {
      tenantId: input.tenantId,
      escalaId: input.escalaId,
      data: dataDate,
      gradeId: input.gradeId,
      medicoId: input.medicoId,
      valorHora,
    },
    include: {
      medico: {
        select: { id: true, nomeCompleto: true, crm: true, email: true, telefone: true },
      },
    },
  });

  await createAuditLog({
    acao: 'CRIAR_ESCALA_PLANTAO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    medicoId: input.medicoId,
    detalhes: { escalaId: input.escalaId, data: input.data, gradeId: input.gradeId, plantaoId: plantao.id },
  });

  return plantao;
}

export async function removerEscalaPlantaoService(
  tenantId: string,
  masterId: string,
  plantaoId: string
) {
  const plantao = await prisma.escalaPlantao.findFirst({
    where: { id: plantaoId, tenantId },
  });

  if (!plantao) {
    throw { statusCode: 404, message: 'Plantão não encontrado' };
  }

  await prisma.escalaPlantao.delete({ where: { id: plantaoId } });

  await createAuditLog({
    acao: 'REMOVER_ESCALA_PLANTAO',
    tenantId,
    masterId,
    medicoId: plantao.medicoId,
    detalhes: { escalaId: plantao.escalaId, data: plantao.data, gradeId: plantao.gradeId },
  });
}

export async function getValoresPlantaoService(
  tenantId: string,
  contratoAtivoId: string,
  subgrupoId: string
) {
  const rows = await prisma.valorPlantao.findMany({
    where: { tenantId, contratoAtivoId, subgrupoId },
    orderBy: { gradeId: 'asc' },
  });
  return rows;
}

export async function setValorPlantaoService(input: {
  tenantId: string;
  masterId: string;
  contratoAtivoId: string;
  subgrupoId: string;
  gradeId: string;
  valorHora: number | null;
}) {
  const valorHora = input.valorHora != null ? Number(input.valorHora) : null;
  const row = await prisma.valorPlantao.upsert({
    where: {
      tenantId_contratoAtivoId_subgrupoId_gradeId: {
        tenantId: input.tenantId,
        contratoAtivoId: input.contratoAtivoId,
        subgrupoId: input.subgrupoId,
        gradeId: input.gradeId,
      },
    },
    update: { valorHora },
    create: {
      tenantId: input.tenantId,
      contratoAtivoId: input.contratoAtivoId,
      subgrupoId: input.subgrupoId,
      gradeId: input.gradeId,
      valorHora,
    },
  });
  await createAuditLog({
    acao: 'CONFIGURAR_VALOR_PLANTAO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: {
      contratoAtivoId: input.contratoAtivoId,
      subgrupoId: input.subgrupoId,
      gradeId: input.gradeId,
      valorHora,
    },
  });
  return row;
}

export async function getConfigPontoService(
  tenantId: string,
  contratoAtivoId: string,
  subgrupoId: string
) {
  const row = await prisma.configPontoEletronico.findUnique({
    where: {
      tenantId_contratoAtivoId_subgrupoId: {
        tenantId,
        contratoAtivoId,
        subgrupoId,
      },
    },
  });
  return row;
}

export async function setConfigPontoService(input: {
  tenantId: string;
  masterId: string;
  contratoAtivoId: string;
  subgrupoId: string;
  horasPrevistasMes: number | null;
  valorHora: number | null;
}) {
  const horasPrevistasMes = input.horasPrevistasMes != null ? Number(input.horasPrevistasMes) : null;
  const valorHora = input.valorHora != null ? Number(input.valorHora) : null;
  const row = await prisma.configPontoEletronico.upsert({
    where: {
      tenantId_contratoAtivoId_subgrupoId: {
        tenantId: input.tenantId,
        contratoAtivoId: input.contratoAtivoId,
        subgrupoId: input.subgrupoId,
      },
    },
    update: { horasPrevistasMes, valorHora },
    create: {
      tenantId: input.tenantId,
      contratoAtivoId: input.contratoAtivoId,
      subgrupoId: input.subgrupoId,
      horasPrevistasMes,
      valorHora,
    },
  });
  await createAuditLog({
    acao: 'CONFIGURAR_PONTO_ELETRONICO',
    tenantId: input.tenantId,
    masterId: input.masterId,
    detalhes: {
      contratoAtivoId: input.contratoAtivoId,
      subgrupoId: input.subgrupoId,
      horasPrevistasMes,
      valorHora,
    },
  });
  return row;
}
