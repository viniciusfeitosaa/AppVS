import { prisma } from '../config/database';
import { validateCPF, validateCRM } from '../utils/validation.util';
import { comparePassword, hashPassword } from '../utils/password.util';
import { generateTokens } from '../utils/jwt.util';
import { createAuditLog } from './auditoria.service';

export interface LoginResult {
  medico: {
    id: string;
    nomeCompleto: string;
    crm: string;
    email: string | null;
    especialidade: string | null;
    vinculo: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export const loginService = async (
  cpf: string,
  crm: string
): Promise<LoginResult> => {
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
      cpf: cpf.replace(/\D/g, ''), // Remove formatação
      crm: crm.toUpperCase(),
      ativo: true,
    },
  });

  if (!medico) {
    // Log de tentativa de login inválida
    await createAuditLog(null, 'TENTATIVA_LOGIN_INVALIDA', {
      cpf: cpf.replace(/\D/g, ''),
      crm: crm.toUpperCase(),
    });

    throw { statusCode: 401, message: 'CPF ou CRM inválidos' };
  }

  // Gerar tokens
  const { accessToken, refreshToken } = await generateTokens(medico.id);

  // Salvar sessão (refresh token)
  await prisma.sessao.create({
    data: {
      medicoId: medico.id,
      tokenHash: refreshToken, // Em produção, fazer hash do token
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
    },
  });

  // Log de login bem-sucedido
  await createAuditLog(medico.id, 'LOGIN', null);

  return {
    medico: {
      id: medico.id,
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
