import { prisma } from '../config/database';

interface CreateAuditLogInput {
  acao: string;
  medicoId?: string | null;
  masterId?: string | null;
  tenantId?: string;
  detalhes?: any;
  ipAddress?: string;
  userAgent?: string;
}

export const createAuditLog = async (input: CreateAuditLogInput) => {
  try {
    await prisma.auditoria.create({
      data: {
        medicoId: input.medicoId || undefined,
        masterId: input.masterId || undefined,
        acao: input.acao,
        detalhes: input.detalhes
          ? JSON.parse(JSON.stringify({ ...input.detalhes, tenantId: input.tenantId }))
          : input.tenantId
          ? { tenantId: input.tenantId }
          : null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    // Não falhar a aplicação se o log de auditoria falhar
    console.error('Erro ao criar log de auditoria:', error);
  }
};
