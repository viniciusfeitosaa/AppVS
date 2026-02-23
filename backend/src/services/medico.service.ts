import { prisma } from '../config/database';

export const getPerfilService = async (medicoId: string, tenantId: string) => {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: {
      id: true,
      tenantId: true,
      nomeCompleto: true,
      crm: true,
      email: true,
      especialidade: true,
      vinculo: true,
      telefone: true,
      ativo: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  return medico;
};
