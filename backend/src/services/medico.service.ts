import { prisma } from '../config/database';

export const getPerfilService = async (medicoId: string) => {
  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    select: {
      id: true,
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
