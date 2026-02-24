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

export async function listMedicosService(params: ListMedicosParams) {
  const page = Math.max(params.page || 1, 1);
  const limit = Math.min(Math.max(params.limit || 10, 1), 100);
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
