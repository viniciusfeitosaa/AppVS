import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database';

export async function listDocumentosEnviadosAdmin(tenantId: string, medicoId?: string) {
  const list = await prisma.documentoEnviado.findMany({
    where: {
      tenantId,
      ...(medicoId ? { medicoId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      medico: {
        select: { id: true, nomeCompleto: true, crm: true, email: true },
      },
    },
  });
  return list;
}

export async function uploadAndSendDocumento(
  tenantId: string,
  masterId: string,
  medicoId: string,
  file: Express.Multer.File,
  titulo?: string | null
) {
  const medico = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, ativo: true },
    select: { id: true },
  });
  if (!medico) {
    throw { statusCode: 404, message: 'Profissional não encontrado' };
  }

  const relativePath = path.relative(path.resolve(process.cwd(), 'uploads'), file.path);
  const normalizedPath = relativePath.split(path.sep).join('/');

  const doc = await prisma.documentoEnviado.create({
    data: {
      tenantId,
      medicoId,
      titulo: titulo?.trim() || null,
      nomeArquivo: file.originalname || path.basename(file.filename),
      caminhoArquivo: normalizedPath,
      mimeType: file.mimetype || 'application/octet-stream',
      tamanhoBytes: file.size,
      enviadoPorId: masterId,
    },
    include: {
      medico: { select: { id: true, nomeCompleto: true, crm: true } },
    },
  });
  return doc;
}

export async function deleteDocumentoEnviado(tenantId: string, id: string) {
  const doc = await prisma.documentoEnviado.findFirst({
    where: { id, tenantId },
  });
  if (!doc) {
    throw { statusCode: 404, message: 'Documento não encontrado' };
  }
  const fullPath = path.resolve(process.cwd(), 'uploads', doc.caminhoArquivo);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
  await prisma.documentoEnviado.delete({ where: { id } });
}

export async function listMeusDocumentos(medicoId: string, tenantId: string) {
  return prisma.documentoEnviado.findMany({
    where: { medicoId, tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      titulo: true,
      nomeArquivo: true,
      mimeType: true,
      tamanhoBytes: true,
      createdAt: true,
    },
  });
}

export async function getDocumentoForDownload(medicoId: string, tenantId: string, id: string) {
  const doc = await prisma.documentoEnviado.findFirst({
    where: { id, medicoId, tenantId },
  });
  if (!doc) {
    throw { statusCode: 404, message: 'Documento não encontrado' };
  }
  const fullPath = path.resolve(process.cwd(), 'uploads', doc.caminhoArquivo);
  if (!fs.existsSync(fullPath)) {
    throw { statusCode: 404, message: 'Arquivo não encontrado no servidor' };
  }
  return { path: fullPath, nomeArquivo: doc.nomeArquivo, mimeType: doc.mimeType };
}
