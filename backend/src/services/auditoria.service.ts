import { prisma } from '../config/database';

export const createAuditLog = async (
  medicoId: string | null,
  acao: string,
  detalhes: any,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    await prisma.auditoria.create({
      data: {
        medicoId: medicoId || undefined,
        acao,
        detalhes: detalhes ? JSON.parse(JSON.stringify(detalhes)) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Não falhar a aplicação se o log de auditoria falhar
    console.error('Erro ao criar log de auditoria:', error);
  }
};
