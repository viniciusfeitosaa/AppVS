import fs from 'fs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  DOCUMENTO_LABEL_BY_TIPO,
  DOCUMENTO_TIPO_BY_FIELD,
  DOCUMENTOS_PERFIL_FIELDS,
  documentoExigeValidadeField,
  parseValidadeEmDate,
  statusValidadeDocumento,
  type DocumentoPerfilFieldName,
} from '../constants/documentos.const';
import {
  fileExistsSafe,
  resolveStoredFileToAbsolute,
  toStoredUploadPath,
} from '../utils/upload-path.util';
import { comparePassword } from '../utils/password.util';
import { createAuditLog } from './auditoria.service';

function safeUnlinkStoredPath(caminhoStored: string | null | undefined) {
  if (!caminhoStored?.trim()) return;
  try {
    const full = resolveStoredFileToAbsolute(caminhoStored.trim());
    if (fileExistsSafe(full)) fs.unlinkSync(full);
  } catch {
    // caminho inválido ou fora de uploads — ignorar
  }
}

interface UpdatePerfilInput {
  especialidades?: string[];
  telefone?: string;
  estadoCivil?: string;
  enderecoResidencial?: string;
  dadosBancarios?: string;
  chavePix?: string;
}

/** Grava ficheiros de perfil (multer) em `medico_documentos` — usado no update de perfil e no cadastro público. */
export async function upsertMedicoDocumentosFromMulter(
  prismaClient: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
  medicoId: string,
  files: Record<string, Express.Multer.File[] | undefined> | undefined | null,
  validades?: Partial<Record<DocumentoPerfilFieldName, string>> | null
) {
  const validadeMap = validades || {};
  const hasFiles = files && Object.values(files).some((arr) => arr && arr.length > 0);
  const hasValidades = Object.keys(validadeMap).length > 0;
  if (!hasFiles && !hasValidades) return;

  await Promise.all(
    DOCUMENTOS_PERFIL_FIELDS.map(async (fieldName) => {
      const file = files?.[fieldName]?.[0];
      const validadeRaw = validadeMap[fieldName];
      const exigeValidade = documentoExigeValidadeField(fieldName);
      const validadeParsed =
        validadeRaw !== undefined ? parseValidadeEmDate(validadeRaw) : undefined;

      if (validadeRaw !== undefined && validadeRaw.trim() && validadeParsed === null) {
        throw {
          statusCode: 400,
          message: `Data de validade inválida para ${DOCUMENTO_LABEL_BY_TIPO[DOCUMENTO_TIPO_BY_FIELD[fieldName]]}. Use AAAA-MM-DD.`,
        };
      }

      if (!file && validadeRaw === undefined) return;

      if (file && exigeValidade && (validadeParsed === undefined || validadeParsed === null)) {
        throw {
          statusCode: 400,
          message: `Informe a data de validade de: ${DOCUMENTO_LABEL_BY_TIPO[DOCUMENTO_TIPO_BY_FIELD[fieldName]]}.`,
        };
      }

      const tipo = DOCUMENTO_TIPO_BY_FIELD[fieldName];

      if (file) {
        await prismaClient.medicoDocumento.upsert({
          where: {
            tenantId_medicoId_tipo: {
              tenantId,
              medicoId,
              tipo,
            },
          },
          update: {
            nomeArquivo: file.originalname,
            caminhoArquivo: toStoredUploadPath(file.path),
            mimeType: file.mimetype,
            tamanhoBytes: file.size,
            ...(exigeValidade && validadeParsed ? { validadeEm: validadeParsed } : {}),
          },
          create: {
            tenantId,
            medicoId,
            tipo,
            nomeArquivo: file.originalname,
            caminhoArquivo: toStoredUploadPath(file.path),
            mimeType: file.mimetype,
            tamanhoBytes: file.size,
            validadeEm: exigeValidade ? validadeParsed ?? null : null,
          },
        });
        return;
      }

      if (validadeParsed) {
        const existing = await prismaClient.medicoDocumento.findUnique({
          where: {
            tenantId_medicoId_tipo: { tenantId, medicoId, tipo },
          },
          select: { id: true },
        });
        if (!existing) {
          throw {
            statusCode: 400,
            message: `Anexe o ficheiro antes de informar a validade de: ${DOCUMENTO_LABEL_BY_TIPO[tipo]}.`,
          };
        }
        await prismaClient.medicoDocumento.update({
          where: { id: existing.id },
          data: { validadeEm: validadeParsed },
        });
      }
    })
  );
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
          validadeEm: true,
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
      statusValidade: statusValidadeDocumento(doc.tipo, doc.validadeEm),
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
  files: Record<string, Express.Multer.File[]>,
  validades?: Partial<Record<DocumentoPerfilFieldName, string>> | null
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

  await upsertMedicoDocumentosFromMulter(prisma, tenantId, medico.id, files, validades);

  return getPerfilService(medico.id, tenantId);
};

/** Exclusão permanente da conta do associado (Apple Guideline 5.1.1(v)). */
export async function deleteSelfAccountService(
  medicoId: string,
  tenantId: string,
  senha: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null }
) {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId },
    select: {
      id: true,
      email: true,
      nomeCompleto: true,
      senhaHash: true,
      documentos: { select: { caminhoArquivo: true } },
      documentosEnviados: { select: { caminhoArquivo: true } },
      registrosPonto: {
        where: { fotoCheckinCaminho: { not: null } },
        select: { fotoCheckinCaminho: true },
      },
    },
  });

  if (!medico) {
    throw { statusCode: 404, message: 'Conta não encontrada' };
  }

  const senhaOk = await comparePassword(senha, medico.senhaHash);
  if (!senhaOk) {
    throw { statusCode: 401, message: 'Senha incorreta' };
  }

  await createAuditLog({
    acao: 'EXCLUIR_CONTA_PROPRIA',
    tenantId,
    medicoId: medico.id,
    ipAddress: meta?.ipAddress ?? undefined,
    userAgent: meta?.userAgent ?? undefined,
    detalhes: {
      email: medico.email,
      nomeCompleto: medico.nomeCompleto,
    },
  });

  for (const doc of medico.documentos) {
    safeUnlinkStoredPath(doc.caminhoArquivo);
  }
  for (const doc of medico.documentosEnviados) {
    safeUnlinkStoredPath(doc.caminhoArquivo);
  }
  for (const ponto of medico.registrosPonto) {
    safeUnlinkStoredPath(ponto.fotoCheckinCaminho);
  }

  await prisma.medico.delete({ where: { id: medico.id } });

  return {
    message:
      'Sua conta foi excluída permanentemente. Você pode criar um novo cadastro no futuro, se desejar.',
  };
}
