import fs from 'fs';
import { StatusCadastroMedico, StatusRevisaoDocumentoPerfil } from '@prisma/client';
import { prisma } from '../config/database';
import { DOCUMENTO_LABEL_BY_TIPO, statusValidadeDocumento } from '../constants/documentos.const';
import { createAuditLog } from './auditoria.service';
import { getMedicoDocumentoPerfilForDownload } from './medico.service';
import {
  fileExistsSafe,
  resolveStoredFileToAbsolute,
  toStoredUploadPath,
} from '../utils/upload-path.util';

function safeUnlinkStoredPath(caminhoStored: string | null | undefined) {
  if (!caminhoStored?.trim()) return;
  try {
    const full = resolveStoredFileToAbsolute(caminhoStored.trim());
    if (fileExistsSafe(full)) fs.unlinkSync(full);
  } catch {
    // ignore
  }
}

async function assertCadastroPendente(tenantId: string, medicoId: string) {
  const m = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE },
    select: { id: true, nomeCompleto: true, email: true },
  });
  if (!m) {
    throw { statusCode: 404, message: 'Cadastro pendente não encontrado ou já processado' };
  }
  return m;
}

async function assertDocumentoDoCadastro(tenantId: string, medicoId: string, documentoId: string) {
  await assertCadastroPendente(tenantId, medicoId);
  const doc = await prisma.medicoDocumento.findFirst({
    where: { id: documentoId, medicoId, tenantId },
  });
  if (!doc) {
    throw { statusCode: 404, message: 'Documento não encontrado neste cadastro' };
  }
  return doc;
}

export async function listCadastrosPendentesService(tenantId: string) {
  return prisma.medico.findMany({
    where: { tenantId, statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      profissao: true,
      crm: true,
      cpf: true,
      telefone: true,
      createdAt: true,
    },
  });
}

export async function getCadastroPendenteDetalheService(tenantId: string, medicoId: string) {
  const m = await prisma.medico.findFirst({
    where: {
      id: medicoId,
      tenantId,
      statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE,
    },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      profissao: true,
      crm: true,
      cpf: true,
      telefone: true,
      especialidades: true,
      vinculo: true,
      estadoCivil: true,
      enderecoResidencial: true,
      dadosBancarios: true,
      chavePix: true,
      createdAt: true,
      updatedAt: true,
      documentos: {
        select: {
          id: true,
          tipo: true,
          nomeArquivo: true,
          mimeType: true,
          tamanhoBytes: true,
          validadeEm: true,
          statusRevisao: true,
          solicitacaoMensagem: true,
          solicitadoEm: true,
          revisadoEm: true,
          createdAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      },
      rqe: true,
      localInteresseTrabalho: true,
      interesseTrabalho: true,
    },
  });
  if (!m) {
    throw { statusCode: 404, message: 'Cadastro pendente não encontrado ou já processado' };
  }
  return {
    ...m,
    documentos: m.documentos.map((doc) => ({
      ...doc,
      statusValidade: statusValidadeDocumento(doc.tipo, doc.validadeEm),
    })),
  };
}

export async function downloadCadastroPendenteDocumentoService(
  tenantId: string,
  medicoId: string,
  documentoId: string
) {
  const m = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE },
    select: { id: true },
  });
  if (!m) {
    throw { statusCode: 404, message: 'Cadastro pendente não encontrado' };
  }
  return getMedicoDocumentoPerfilForDownload(medicoId, tenantId, documentoId);
}

export async function confirmarOkDocumentoCadastroPendenteService(
  tenantId: string,
  masterId: string,
  medicoId: string,
  documentoId: string
) {
  const doc = await assertDocumentoDoCadastro(tenantId, medicoId, documentoId);
  const updated = await prisma.medicoDocumento.update({
    where: { id: doc.id },
    data: {
      statusRevisao: StatusRevisaoDocumentoPerfil.OK,
      revisadoEm: new Date(),
      revisadoPorMasterId: masterId,
    },
    select: {
      id: true,
      tipo: true,
      statusRevisao: true,
      revisadoEm: true,
    },
  });

  await createAuditLog({
    acao: 'CONFIRMAR_OK_DOCUMENTO_CADASTRO_PENDENTE',
    tenantId,
    masterId,
    medicoId,
    detalhes: { documentoId, tipo: doc.tipo },
  });

  return updated;
}

export async function solicitarDocumentoCadastroPendenteService(
  tenantId: string,
  masterId: string,
  medicoId: string,
  documentoId: string,
  mensagem: string
) {
  const msg = (mensagem ?? '').trim();
  if (!msg) {
    throw { statusCode: 400, message: 'Informe o motivo / mensagem para o profissional.' };
  }
  if (msg.length > 4000) {
    throw { statusCode: 400, message: 'Mensagem demasiado longa (máx. 4000 caracteres).' };
  }

  const medico = await assertCadastroPendente(tenantId, medicoId);
  const doc = await assertDocumentoDoCadastro(tenantId, medicoId, documentoId);
  const emailTo = (medico.email ?? '').trim().toLowerCase();
  if (!emailTo) {
    throw { statusCode: 400, message: 'Este cadastro não tem e-mail para envio da solicitação.' };
  }

  const nomeDocumento = DOCUMENTO_LABEL_BY_TIPO[doc.tipo] ?? String(doc.tipo);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nome: true },
  });
  const nomeInstituicao = tenant?.nome?.trim() || null;

  const updated = await prisma.medicoDocumento.update({
    where: { id: doc.id },
    data: {
      statusRevisao: StatusRevisaoDocumentoPerfil.SOLICITADO,
      solicitacaoMensagem: msg,
      solicitadoEm: new Date(),
      revisadoEm: new Date(),
      revisadoPorMasterId: masterId,
    },
    select: {
      id: true,
      tipo: true,
      statusRevisao: true,
      solicitacaoMensagem: true,
      solicitadoEm: true,
    },
  });

  await createAuditLog({
    acao: 'SOLICITAR_DOCUMENTO_CADASTRO_PENDENTE',
    tenantId,
    masterId,
    medicoId,
    detalhes: { documentoId, tipo: doc.tipo },
  });

  try {
    const { enqueueEmailJob } = await import('../jobs/email-queue');
    const queued = await enqueueEmailJob({
      type: 'cadastro-documento-solicitado',
      to: emailTo,
      nomeCompleto: medico.nomeCompleto,
      nomeDocumento,
      mensagem: msg,
      nomeInstituicao,
    });
    if (!queued) {
      const { enviarEmailCadastroDocumentoSolicitado } = await import('./cadastro-publico-email.service');
      await enviarEmailCadastroDocumentoSolicitado({
        to: emailTo,
        nomeCompleto: medico.nomeCompleto,
        nomeDocumento,
        mensagem: msg,
        nomeInstituicao,
      });
    }
  } catch (err) {
    console.error('[cadastro-pendente] Falha no e-mail de solicitação de documento:', err);
    throw {
      statusCode: 502,
      message: 'Status atualizado, mas falhou o envio do e-mail. Verifique SMTP/Resend e tente novamente.',
    };
  }

  return updated;
}

export async function substituirDocumentoCadastroPendenteService(
  tenantId: string,
  masterId: string,
  medicoId: string,
  documentoId: string,
  file: Express.Multer.File | undefined
) {
  if (!file) {
    throw { statusCode: 400, message: 'Envie um ficheiro (campo arquivo).' };
  }
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(file.mimetype)) {
    safeUnlinkStoredPath(toStoredUploadPath(file.path));
    throw { statusCode: 400, message: 'Tipo de ficheiro não permitido. Use PDF, JPEG, PNG ou WebP.' };
  }

  const doc = await assertDocumentoDoCadastro(tenantId, medicoId, documentoId);
  const oldPath = doc.caminhoArquivo;
  const novoCaminho = toStoredUploadPath(file.path);

  const updated = await prisma.medicoDocumento.update({
    where: { id: doc.id },
    data: {
      nomeArquivo: file.originalname || doc.nomeArquivo,
      caminhoArquivo: novoCaminho,
      mimeType: file.mimetype,
      tamanhoBytes: file.size,
      statusRevisao: StatusRevisaoDocumentoPerfil.OK,
      revisadoEm: new Date(),
      revisadoPorMasterId: masterId,
      solicitacaoMensagem: null,
      solicitadoEm: null,
    },
    select: {
      id: true,
      tipo: true,
      nomeArquivo: true,
      mimeType: true,
      tamanhoBytes: true,
      statusRevisao: true,
      revisadoEm: true,
    },
  });

  if (oldPath && oldPath !== novoCaminho) {
    safeUnlinkStoredPath(oldPath);
  }

  await createAuditLog({
    acao: 'SUBSTITUIR_DOCUMENTO_CADASTRO_PENDENTE',
    tenantId,
    masterId,
    medicoId,
    detalhes: { documentoId, tipo: doc.tipo, nomeArquivo: updated.nomeArquivo },
  });

  return updated;
}

export async function aprovarCadastroPendenteService(tenantId: string, masterId: string, medicoId: string) {
  const m = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE },
    select: { id: true, nomeCompleto: true, email: true },
  });
  if (!m) {
    throw { statusCode: 404, message: 'Cadastro pendente não encontrado ou já processado' };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nome: true },
  });
  const nomeInstituicao = tenant?.nome?.trim() || null;

  await prisma.medico.update({
    where: { id: medicoId },
    data: {
      statusCadastro: StatusCadastroMedico.ATIVO,
      ativo: true,
    },
  });

  await createAuditLog({
    acao: 'APROVAR_CADASTRO_PUBLICO_MEDICO',
    tenantId,
    masterId,
    medicoId,
    detalhes: { medicoId },
  });

  try {
    const { notificarBoasVindasMedico } = await import('./notificacao-medico.service');
    await notificarBoasVindasMedico(tenantId, medicoId, m.nomeCompleto);
  } catch (err) {
    console.error('[notificacao] boas-vindas (aprovação cadastro):', err);
  }

  try {
    const emailTo = (m.email ?? '').trim().toLowerCase();
    if (!emailTo) throw new Error('Médico sem e-mail');
    const { enqueueEmailJob } = await import('../jobs/email-queue');
    const queued = await enqueueEmailJob({
      type: 'cadastro-aprovado',
      to: emailTo,
      nomeCompleto: m.nomeCompleto,
      nomeInstituicao,
    });
    if (!queued) {
      const { enviarEmailCadastroAprovado } = await import('./cadastro-publico-email.service');
      await enviarEmailCadastroAprovado({
        to: m.email,
        nomeCompleto: m.nomeCompleto,
        nomeInstituicao,
      });
    }
    console.log('[cadastro-pendente] E-mail de cadastro aprovado enfileirado/enviado para:', emailTo);
  } catch (err) {
    console.error('[cadastro-pendente] Falha no e-mail de cadastro aprovado (SMTP/Resend não configurado ou erro de envio):', err);
  }

  return { ok: true as const };
}

export async function rejeitarCadastroPendenteService(tenantId: string, masterId: string, medicoId: string) {
  const m = await prisma.medico.findFirst({
    where: { id: medicoId, tenantId, statusCadastro: StatusCadastroMedico.PENDENTE_ANALISE },
    select: { id: true },
  });
  if (!m) {
    throw { statusCode: 404, message: 'Cadastro pendente não encontrado ou já processado' };
  }

  await prisma.medico.update({
    where: { id: medicoId },
    data: {
      statusCadastro: StatusCadastroMedico.REJEITADO,
      ativo: false,
    },
  });

  await createAuditLog({
    acao: 'REJEITAR_CADASTRO_PUBLICO_MEDICO',
    tenantId,
    masterId,
    medicoId,
    detalhes: { medicoId },
  });

  return { ok: true as const };
}
