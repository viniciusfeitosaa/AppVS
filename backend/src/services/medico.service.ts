import { prisma } from '../config/database';
import env from '../config/env';
import { DOCUMENTO_TIPO_BY_FIELD, DOCUMENTOS_PERFIL_FIELDS } from '../constants/documentos.const';

interface UpdatePerfilInput {
  especialidades?: string[];
  telefone?: string;
  estadoCivil?: string;
  enderecoResidencial?: string;
  dadosBancarios?: string;
  chavePix?: string;
}

const toPublicFileUrl = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/uploads/';
  const idx = normalized.lastIndexOf(marker);
  const suffix = idx >= 0 ? normalized.slice(idx) : `/uploads/${normalized.split('/').pop()}`;
  const base =
    env.FRONTEND_URL?.replace(/\/$/, '').replace(/:3000$/, ':3001') || 'http://localhost:3001';
  return `${base}${suffix}`;
};

export const getPerfilService = async (medicoId: string, tenantId: string) => {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: {
      id: true,
      tenantId: true,
      nomeCompleto: true,
      profissao: true,
      crm: true,
      email: true,
      especialidades: true,
      vinculo: true,
      telefone: true,
      estadoCivil: true,
      enderecoResidencial: true,
      dadosBancarios: true,
      chavePix: true,
      ativo: true,
      createdAt: true,
      updatedAt: true,
      documentos: {
        select: {
          id: true,
          tipo: true,
          nomeArquivo: true,
          caminhoArquivo: true,
          mimeType: true,
          tamanhoBytes: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
    },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  return {
    ...medico,
    documentos: medico.documentos.map((doc) => ({
      ...doc,
      url: toPublicFileUrl(doc.caminhoArquivo),
    })),
  };
};

export const updatePerfilService = async (
  medicoId: string,
  tenantId: string,
  input: UpdatePerfilInput,
  files: Record<string, Express.Multer.File[]>
) => {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: { id: true },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }

  await prisma.medico.update({
    where: { id: medico.id },
    data: {
      especialidades: input.especialidades?.length
        ? input.especialidades.map((e) => (e || '').trim()).filter(Boolean)
        : undefined,
      telefone: input.telefone?.trim() || undefined,
      estadoCivil: input.estadoCivil?.trim() || undefined,
      enderecoResidencial: input.enderecoResidencial?.trim() || undefined,
      dadosBancarios: input.dadosBancarios?.trim() || undefined,
      chavePix: input.chavePix?.trim() || undefined,
    },
  });

  await Promise.all(
    DOCUMENTOS_PERFIL_FIELDS.map(async (fieldName) => {
      const file = files[fieldName]?.[0];
      if (!file) return;
      await prisma.medicoDocumento.upsert({
        where: {
          tenantId_medicoId_tipo: {
            tenantId,
            medicoId: medico.id,
            tipo: DOCUMENTO_TIPO_BY_FIELD[fieldName],
          },
        },
        update: {
          nomeArquivo: file.originalname,
          caminhoArquivo: file.path.replace(/\\/g, '/'),
          mimeType: file.mimetype,
          tamanhoBytes: file.size,
        },
        create: {
          tenantId,
          medicoId: medico.id,
          tipo: DOCUMENTO_TIPO_BY_FIELD[fieldName],
          nomeArquivo: file.originalname,
          caminhoArquivo: file.path.replace(/\\/g, '/'),
          mimeType: file.mimetype,
          tamanhoBytes: file.size,
        },
      });
    })
  );

  return getPerfilService(medico.id, tenantId);
};
