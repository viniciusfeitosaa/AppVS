import { prisma } from '../config/database';
import env from '../config/env';
import { normalizeCRM, validateCPF, validateCRM } from '../utils/validation.util';
import { comparePassword, hashPassword } from '../utils/password.util';
import { generateTokens } from '../utils/jwt.util';
import { createAuditLog } from './auditoria.service';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';

export interface LoginResult {
  user: {
    id: string;
    role: UserRole;
    tenantId: string;
    nomeCompleto: string;
    profissao?: string;
    crm?: string | null;
    email?: string | null;
    especialidades: string[];
    vinculo?: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

interface RegisterPublicMedicoInput {
  nomeCompleto: string;
  email: string;
  password: string;
  cpf: string;
  profissao: string;
  crm?: string;
  especialidades?: string[];
  telefone: string;
}

const getDefaultTenant = async () => {
  const tenant = await prisma.tenant.findFirst({
    where: {
      slug: env.TENANT_DEFAULT_SLUG,
      ativo: true,
    },
  });

  if (!tenant) {
    throw {
      statusCode: 500,
      message:
        'Banco não configurado. No terminal, na pasta backend, rode: npx prisma db push e depois npm run prisma:seed',
    };
  }

  return tenant;
};

const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const createMedicoSession = async (medicoId: string, refreshToken: string) => {
  await prisma.sessao.create({
    data: {
      medicoId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
};

const createMasterSession = async (masterId: string, refreshToken: string) => {
  await prisma.sessaoMaster.create({
    data: {
      masterId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
};

export const loginMedicoService = async (
  cpf: string,
  crm: string
): Promise<LoginResult> => {
  const tenant = await getDefaultTenant();
  const normalizedCRM = normalizeCRM(crm);

  // Validar CPF
  if (!validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido' };
  }

  // Validar CRM
  if (!validateCRM(crm)) {
    throw { statusCode: 400, message: 'CRM inválido' };
  }

  // Buscar médico
  const medico = await prisma.medico.findFirst({
    where: {
      tenantId: tenant.id,
      cpf: cpf.replace(/\D/g, ''), // Remove formatação
      crm: normalizedCRM!,
      ativo: true,
    },
  });

  if (!medico) {
    // Log de tentativa de login inválida
    await createAuditLog({
      acao: 'TENTATIVA_LOGIN_INVALIDA',
      tenantId: tenant.id,
      detalhes: {
        cpf: cpf.replace(/\D/g, ''),
        crm: normalizedCRM,
      },
    });

    throw { statusCode: 401, message: 'CPF ou CRM inválidos' };
  }

  // Gerar tokens
  const { accessToken, refreshToken } = await generateTokens(
    medico.id,
    UserRole.MEDICO,
    tenant.id
  );

  // Salvar sessão (refresh token)
  await createMedicoSession(medico.id, refreshToken);

  // Log de login bem-sucedido
  await createAuditLog({
    acao: 'LOGIN_MEDICO',
    medicoId: medico.id,
    tenantId: tenant.id,
  });

  return {
    user: {
      id: medico.id,
      role: UserRole.MEDICO,
      tenantId: tenant.id,
      nomeCompleto: medico.nomeCompleto,
      profissao: medico.profissao ?? 'Médico',
      crm: medico.crm,
      email: medico.email,
      especialidades: medico.especialidades ?? [],
      vinculo: medico.vinculo ?? null,
    },
    accessToken,
    refreshToken,
  };
};

export const loginMasterService = async (
  email: string,
  password: string
): Promise<LoginResult> => {
  const tenant = await getDefaultTenant();
  const normalizedEmail = email.trim().toLowerCase();

  const master = await prisma.usuarioMaster.findFirst({
    where: {
      tenantId: tenant.id,
      email: normalizedEmail,
      ativo: true,
      role: UserRole.MASTER,
    },
  });

  if (!master) {
    await createAuditLog({
      acao: 'TENTATIVA_LOGIN_MASTER_INVALIDA',
      tenantId: tenant.id,
      detalhes: { email: normalizedEmail },
    });
    throw { statusCode: 401, message: 'E-mail ou senha inválidos' };
  }

  const isValidPassword = await comparePassword(password, master.senhaHash);
  if (!isValidPassword) {
    await createAuditLog({
      acao: 'TENTATIVA_LOGIN_MASTER_INVALIDA',
      tenantId: tenant.id,
      masterId: master.id,
      detalhes: { email: normalizedEmail },
    });
    throw { statusCode: 401, message: 'E-mail ou senha inválidos' };
  }

  const { accessToken, refreshToken } = await generateTokens(
    master.id,
    UserRole.MASTER,
    tenant.id
  );

  await createMasterSession(master.id, refreshToken);

  await createAuditLog({
    acao: 'LOGIN_MASTER',
    tenantId: tenant.id,
    masterId: master.id,
  });

  return {
    user: {
      id: master.id,
      role: UserRole.MASTER,
      tenantId: tenant.id,
      nomeCompleto: master.nome,
      email: master.email,
      especialidades: [],
    },
    accessToken,
    refreshToken,
  };
};

// Compatibilidade com endpoint legado /login
export const loginService = loginMedicoService;

export const loginByEmailService = async (
  email: string,
  password: string
): Promise<LoginResult> => {
  const tenant = await getDefaultTenant();
  const normalizedEmail = email.trim().toLowerCase();

  // 1) Tenta master primeiro
  const master = await prisma.usuarioMaster.findFirst({
    where: {
      tenantId: tenant.id,
      email: normalizedEmail,
      ativo: true,
      role: UserRole.MASTER,
    },
  });

  if (master) {
    const ok = await comparePassword(password, master.senhaHash);
    if (!ok) {
      throw { statusCode: 401, message: 'E-mail ou senha inválidos' };
    }

    const { accessToken, refreshToken } = await generateTokens(
      master.id,
      UserRole.MASTER,
      tenant.id
    );
    await createMasterSession(master.id, refreshToken);

    return {
      user: {
        id: master.id,
        role: UserRole.MASTER,
        tenantId: tenant.id,
        nomeCompleto: master.nome,
        email: master.email,
        especialidades: [],
      },
      accessToken,
      refreshToken,
    };
  }

  // 2) Senão, tenta médico por e-mail/senha
  const medico = await prisma.medico.findFirst({
    where: {
      tenantId: tenant.id,
      email: normalizedEmail,
      ativo: true,
    },
  });

  if (!medico) {
    throw { statusCode: 401, message: 'E-mail ou senha inválidos' };
  }

  const ok = await comparePassword(password, medico.senhaHash);
  if (!ok) {
    throw { statusCode: 401, message: 'E-mail ou senha inválidos' };
  }

  const { accessToken, refreshToken } = await generateTokens(
    medico.id,
    UserRole.MEDICO,
    tenant.id
  );
  await createMedicoSession(medico.id, refreshToken);

  return {
    user: {
      id: medico.id,
      role: UserRole.MEDICO,
      tenantId: tenant.id,
      nomeCompleto: medico.nomeCompleto,
      profissao: medico.profissao ?? 'Médico',
      crm: medico.crm,
      email: medico.email,
      especialidades: medico.especialidades ?? [],
      vinculo: medico.vinculo ?? null,
    },
    accessToken,
    refreshToken,
  };
};

export const acceptInviteService = async (
  token: string,
  password: string
): Promise<LoginResult> => {
  const tenant = await getDefaultTenant();
  const tokenHash = hashToken(token);

  const medico = await prisma.medico.findFirst({
    where: {
      tenantId: tenant.id,
      inviteTokenHash: tokenHash,
      inviteExpiresAt: {
        gte: new Date(),
      },
    },
  });

  if (!medico) {
    throw { statusCode: 400, message: 'Convite inválido ou expirado' };
  }

  const senhaHash = await hashPassword(password);
  const updated = await prisma.medico.update({
    where: { id: medico.id },
    data: {
      senhaHash,
      inviteTokenHash: null,
      inviteExpiresAt: null,
      inviteAcceptedAt: new Date(),
      ativo: true,
    },
  });

  const { accessToken, refreshToken } = await generateTokens(
    updated.id,
    UserRole.MEDICO,
    tenant.id
  );
  await createMedicoSession(updated.id, refreshToken);

  await createAuditLog({
    acao: 'ACEITAR_CONVITE_MEDICO',
    tenantId: tenant.id,
    medicoId: updated.id,
  });

  return {
    user: {
      id: updated.id,
      role: UserRole.MEDICO,
      tenantId: tenant.id,
      nomeCompleto: updated.nomeCompleto,
      profissao: updated.profissao ?? 'Médico',
      crm: updated.crm,
      email: updated.email,
      especialidades: updated.especialidades ?? [],
      vinculo: updated.vinculo ?? null,
    },
    accessToken,
    refreshToken,
  };
};

const PROFISSAO_MEDICO = 'Médico';

export const registerPublicMedicoService = async (
  input: RegisterPublicMedicoInput
) => {
  const tenant = await getDefaultTenant();
  const cpf = input.cpf.replace(/\D/g, '');
  const email = input.email.trim().toLowerCase();
  const profissao = (input.profissao || '').trim();
  const isMedico = profissao === PROFISSAO_MEDICO;

  if (!validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido' };
  }

  if (!profissao) {
    throw { statusCode: 400, message: 'Profissão é obrigatória' };
  }

  let crm: string | null = null;
  if (isMedico) {
    const crmNorm = input.crm ? normalizeCRM(input.crm) : '';
    if (!crmNorm || !validateCRM(crmNorm)) {
      throw { statusCode: 400, message: 'CRM inválido' };
    }
    crm = crmNorm;
  }

  // Médico sem especialidades = [Clínica Médica]; senão usa as enviadas (várias permitidas)
  const especialidades = (input.especialidades || []).filter((e) => (e || '').trim()).map((e) => (e || '').trim());
  const especialidadesFinal = isMedico
    ? (especialidades.length > 0 ? especialidades : ['Clínica Médica'])
    : especialidades;

  const [existingByCpf, existingByCrm, existingByEmail] = await Promise.all([
    prisma.medico.findFirst({ where: { tenantId: tenant.id, cpf } }),
    crm
      ? prisma.medico.findFirst({ where: { tenantId: tenant.id, crm } })
      : Promise.resolve(null),
    prisma.medico.findFirst({ where: { tenantId: tenant.id, email } }),
  ]);

  if (existingByCpf) {
    throw { statusCode: 409, message: 'Já existe cadastro com este CPF' };
  }

  if (existingByCrm) {
    throw { statusCode: 409, message: 'Já existe cadastro com este CRM' };
  }

  if (existingByEmail) {
    throw { statusCode: 409, message: 'Já existe cadastro com este e-mail' };
  }

  const senhaHash = await hashPassword(input.password);

  const medico = await prisma.medico.create({
    data: {
      tenantId: tenant.id,
      nomeCompleto: input.nomeCompleto.trim(),
      email,
      cpf,
      profissao,
      crm,
      senhaHash,
      especialidades: especialidadesFinal,
      vinculo: 'Associado',
      telefone: input.telefone.trim(),
      ativo: true,
      inviteTokenHash: null,
      inviteExpiresAt: null,
      inviteAcceptedAt: new Date(),
    },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      crm: true,
      vinculo: true,
    },
  });

  await createAuditLog({
    acao: 'CADASTRO_PUBLICO_MEDICO',
    tenantId: tenant.id,
    medicoId: medico.id,
    detalhes: {
      email: medico.email,
      crm: medico.crm,
      vinculo: medico.vinculo ?? null,
    },
  });

  return {
    medico,
    message: 'Cadastro realizado com sucesso. Você já pode fazer login.',
  };
};
