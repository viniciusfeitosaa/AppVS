import { prisma } from '../config/database';
import { DOCUMENTO_TIPO_BY_FIELD, DOCUMENTOS_PERFIL_FIELDS } from '../constants/documentos.const';
import { fileExistsSafe, resolveStoredFileToAbsolute } from '../utils/upload-path.util';

interface UpdatePerfilInput {
  especialidades?: string[];
  telefone?: string;
  estadoCivil?: string;
  enderecoResidencial?: string;
  dadosBancarios?: string;
  chavePix?: string;
}

const perfilSelectSemDocumentos = {
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
} as const;

/** Perfil sem join em documentos (dashboard — documentos vêm de outra query). */
export const getPerfilResumoDashboardService = async (medicoId: string, tenantId: string) => {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: perfilSelectSemDocumentos,
  });
  if (!medico) {
    throw { statusCode: 404, message: 'Médico não encontrado' };
  }
  return { ...medico, documentos: [] as never[] };
};

export const getPerfilService = async (medicoId: string, tenantId: string) => {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: {
      ...perfilSelectSemDocumentos,
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
      /** Download apenas via GET /api/medico/perfil/documentos/:id/download (autenticado). */
    })),
  };
};

export async function getMedicoDocumentoPerfilForDownload(
  medicoId: string,
  tenantId: string,
  documentoId: string
) {
  const doc = await prisma.medicoDocumento.findFirst({
    where: { id: documentoId, medicoId, tenantId },
  });
  if (!doc) {
    throw { statusCode: 404, message: 'Documento não encontrado' };
  }
  const fullPath = resolveStoredFileToAbsolute(doc.caminhoArquivo);
  if (!fileExistsSafe(fullPath)) {
    throw { statusCode: 404, message: 'Arquivo não encontrado no servidor' };
  }
  return { path: fullPath, nomeArquivo: doc.nomeArquivo, mimeType: doc.mimeType };
}

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
