import { EmailMensagemStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import {
  deliverEmail,
  getSmtpProviderInfo,
  isEmailDeliveryConfigured,
  verifySmtpConnection,
} from '../../utils/email-delivery.util';

export type CreateEmailMensagemInput = {
  assunto: string;
  corpoHtml?: string;
  corpoTexto?: string;
  destinatarios: string[];
};

export type EmailAnexoInput = {
  filename: string;
  contentBase64: string;
  contentType?: string;
};

const MAX_ANEXO_BYTES = 8 * 1024 * 1024;
const MAX_ANEXOS = 3;

function parseAnexos(anexos: EmailAnexoInput[] | undefined) {
  if (!anexos?.length) return [];
  if (anexos.length > MAX_ANEXOS) {
    throw new Error(`Máximo de ${MAX_ANEXOS} anexos por e-mail`);
  }
  return anexos.map((a) => {
    const filename = (a.filename || '').trim().slice(0, 200);
    if (!filename) throw new Error('Nome do anexo é obrigatório');
    const raw = (a.contentBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    if (!raw) throw new Error(`Anexo vazio: ${filename}`);
    const content = Buffer.from(raw, 'base64');
    if (!content.length) throw new Error(`Anexo inválido: ${filename}`);
    if (content.length > MAX_ANEXO_BYTES) {
      throw new Error(`Anexo ${filename} excede o limite de 8 MB`);
    }
    return {
      filename,
      content,
      contentType: a.contentType?.trim() || undefined,
    };
  });
}

function normalizeDestinatarios(emails: string[]): string[] {
  const unique = new Set<string>();
  for (const raw of emails) {
    const e = raw.trim().toLowerCase();
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      unique.add(e);
    }
  }
  return [...unique];
}

function mapMensagem(row: {
  id: string;
  assunto: string;
  corpoHtml: string | null;
  corpoTexto: string | null;
  destinatarios: unknown;
  status: EmailMensagemStatus;
  erroEnvio: string | null;
  enviadoEm: Date | null;
  createdAt: Date;
  updatedAt: Date;
  criadoPorMaster: { id: string; nome: string; email: string } | null;
}) {
  return {
    id: row.id,
    assunto: row.assunto,
    corpoHtml: row.corpoHtml,
    corpoTexto: row.corpoTexto,
    destinatarios: Array.isArray(row.destinatarios) ? (row.destinatarios as string[]) : [],
    status: row.status,
    erroEnvio: row.erroEnvio,
    enviadoEm: row.enviadoEm,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    criadoPor: row.criadoPorMaster
      ? { id: row.criadoPorMaster.id, nome: row.criadoPorMaster.nome, email: row.criadoPorMaster.email }
      : null,
  };
}

const mensagemSelect = {
  id: true,
  assunto: true,
  corpoHtml: true,
  corpoTexto: true,
  destinatarios: true,
  status: true,
  erroEnvio: true,
  enviadoEm: true,
  createdAt: true,
  updatedAt: true,
  criadoPorMaster: { select: { id: true, nome: true, email: true } },
} as const;

export async function getEmailPainelResumoService(tenantId: string) {
  const [rascunhos, enviados, falhas, total] = await Promise.all([
    prisma.emailMensagem.count({ where: { tenantId, status: EmailMensagemStatus.RASCUNHO } }),
    prisma.emailMensagem.count({ where: { tenantId, status: EmailMensagemStatus.ENVIADO } }),
    prisma.emailMensagem.count({ where: { tenantId, status: EmailMensagemStatus.FALHA } }),
    prisma.emailMensagem.count({ where: { tenantId } }),
  ]);

  return {
    rascunhos,
    enviados,
    falhas,
    total,
    smtpConfigurado: isEmailDeliveryConfigured(),
    smtp: getSmtpProviderInfo(),
  };
}

export async function testarConexaoSmtpService() {
  const info = getSmtpProviderInfo();
  if (!info.configurado || info.provedor === 'resend' || info.provedor === 'nenhum') {
    return {
      ...info,
      conexao: { ok: false, mensagem: 'Teste de conexão disponível apenas para SMTP/Maddy' },
    };
  }
  const conexao = await verifySmtpConnection();
  return { ...info, conexao };
}

export async function listEmailMensagensService(tenantId: string, limit = 50) {
  const rows = await prisma.emailMensagem.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    select: mensagemSelect,
  });
  return rows.map(mapMensagem);
}

export async function getEmailMensagemService(tenantId: string, id: string) {
  const row = await prisma.emailMensagem.findFirst({
    where: { id, tenantId },
    select: mensagemSelect,
  });
  if (!row) return null;
  return mapMensagem(row);
}

export async function createEmailMensagemService(
  tenantId: string,
  criadoPorMasterId: string | null,
  input: CreateEmailMensagemInput
) {
  const destinatarios = normalizeDestinatarios(input.destinatarios);
  if (!input.assunto.trim()) {
    throw new Error('Assunto é obrigatório');
  }
  if (!destinatarios.length) {
    throw new Error('Informe ao menos um destinatário válido');
  }

  const row = await prisma.emailMensagem.create({
    data: {
      tenantId,
      assunto: input.assunto.trim(),
      corpoHtml: input.corpoHtml?.trim() || null,
      corpoTexto: input.corpoTexto?.trim() || null,
      destinatarios,
      criadoPorMasterId: criadoPorMasterId || null,
      status: EmailMensagemStatus.RASCUNHO,
    },
    select: mensagemSelect,
  });

  return mapMensagem(row);
}

export async function enviarEmailMensagemService(tenantId: string, id: string) {
  const row = await prisma.emailMensagem.findFirst({
    where: { id, tenantId },
  });
  if (!row) {
    throw new Error('Mensagem não encontrada');
  }
  if (row.status === EmailMensagemStatus.ENVIADO) {
    throw new Error('Esta mensagem já foi enviada');
  }

  const destinatarios = Array.isArray(row.destinatarios) ? (row.destinatarios as string[]) : [];
  const html = row.corpoHtml || `<p>${(row.corpoTexto || '').replace(/\n/g, '<br>')}</p>`;
  const text = row.corpoTexto || undefined;

  try {
    await deliverEmail({
      to: destinatarios,
      subject: row.assunto,
      html,
      text,
    });

    const updated = await prisma.emailMensagem.update({
      where: { id: row.id },
      data: {
        status: EmailMensagemStatus.ENVIADO,
        enviadoEm: new Date(),
        erroEnvio: null,
      },
      select: mensagemSelect,
    });

    return mapMensagem(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao enviar e-mail';
    await prisma.emailMensagem.update({
      where: { id: row.id },
      data: {
        status: EmailMensagemStatus.FALHA,
        erroEnvio: message,
      },
    });
    throw new Error(message);
  }
}

export async function deleteEmailMensagemService(tenantId: string, id: string) {
  const row = await prisma.emailMensagem.findFirst({ where: { id, tenantId } });
  if (!row) {
    throw new Error('Mensagem não encontrada');
  }
  if (row.status === EmailMensagemStatus.ENVIADO) {
    throw new Error('Não é possível excluir mensagens já enviadas');
  }
  await prisma.emailMensagem.delete({ where: { id } });
}

/**
 * Cria a mensagem, envia imediatamente (com anexos opcionais) e marca como ENVIADO.
 * Anexos não são persistidos no banco — só o registro do e-mail.
 */
export async function enviarAgoraEmailMensagemService(
  tenantId: string,
  criadoPorMasterId: string | null,
  input: CreateEmailMensagemInput & { anexos?: EmailAnexoInput[] }
) {
  if (!isEmailDeliveryConfigured()) {
    throw new Error('Serviço de e-mail não configurado (Maddy/SMTP ou Resend)');
  }

  const anexos = parseAnexos(input.anexos);
  const created = await createEmailMensagemService(tenantId, criadoPorMasterId, input);
  const row = await prisma.emailMensagem.findFirst({ where: { id: created.id, tenantId } });
  if (!row) {
    throw new Error('Mensagem não encontrada após criação');
  }

  const destinatarios = Array.isArray(row.destinatarios) ? (row.destinatarios as string[]) : [];
  const html = row.corpoHtml || `<p>${(row.corpoTexto || '').replace(/\n/g, '<br>')}</p>`;
  const text = row.corpoTexto || undefined;

  try {
    await deliverEmail({
      to: destinatarios,
      subject: row.assunto,
      html,
      text,
      attachments: anexos,
    });

    const updated = await prisma.emailMensagem.update({
      where: { id: row.id },
      data: {
        status: EmailMensagemStatus.ENVIADO,
        enviadoEm: new Date(),
        erroEnvio: null,
      },
      select: mensagemSelect,
    });

    return {
      ...mapMensagem(updated),
      anexosEnviados: anexos.map((a) => ({ filename: a.filename, bytes: a.content.length })),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao enviar e-mail';
    await prisma.emailMensagem.update({
      where: { id: row.id },
      data: {
        status: EmailMensagemStatus.FALHA,
        erroEnvio: message,
      },
    });
    throw new Error(message);
  }
}
