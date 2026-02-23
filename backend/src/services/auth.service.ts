import { prisma } from '../config/database';
import env from '../config/env';
import { validateCPF, validateCRM } from '../utils/validation.util';
import { comparePassword } from '../utils/password.util';
import { generateTokens } from '../utils/jwt.util';
import { createAuditLog } from './auditoria.service';
import { UserRole } from '@prisma/client';

export interface LoginResult {
  user: {
    id: string;
    role: UserRole;
    tenantId: string;
    nomeCompleto: string;
    crm?: string;
    email?: string | null;
    especialidade?: string | null;
    vinculo?: string | null;
  };
  accessToken: string;
  refreshToken: string;
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
      message: `Tenant padrão não encontrado (slug: ${env.TENANT_DEFAULT_SLUG})`,
    };
  }

  return tenant;
};

export const loginMedicoService = async (
  cpf: string,
  crm: string
): Promise<LoginResult> => {
  const tenant = await getDefaultTenant();

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
      crm: crm.toUpperCase(),
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
        crm: crm.toUpperCase(),
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
  await prisma.sessao.create({
    data: {
      medicoId: medico.id,
      tokenHash: refreshToken, // Em produção, fazer hash do token
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
    },
  });

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
      crm: medico.crm,
      email: medico.email,
      especialidade: medico.especialidade,
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

  await prisma.sessaoMaster.create({
    data: {
      masterId: master.id,
      tokenHash: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

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
    },
    accessToken,
    refreshToken,
  };
};

// Compatibilidade com endpoint legado /login
export const loginService = loginMedicoService;
