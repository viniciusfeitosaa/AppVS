import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import tls from 'tls';
import { Resend } from 'resend';
import env from '../config/env';
import { getOrgDisplayName } from './email-branding.util';

const MADDY_INTERNAL_HOSTS = new Set(['maddy', '127.0.0.1', 'localhost']);

function hasSmtpConfig(): boolean {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function hasResendConfig(): boolean {
  return !!env.RESEND_API_KEY;
}

function resolveTlsServername(host: string): string {
  const configured = process.env.SMTP_TLS_SERVERNAME?.trim();
  if (configured) return configured;
  if (MADDY_INTERNAL_HOSTS.has(host)) {
    return process.env.MADDY_HOSTNAME?.trim() || 'mail.vivasaude.cloud';
  }
  return host;
}

function buildTlsOptions(host: string): tls.ConnectionOptions {
  const tlsServername = resolveTlsServername(host);
  const options: tls.ConnectionOptions = { servername: tlsServername };
  if (host !== tlsServername) {
    options.checkServerIdentity = (_hostname: string, cert: tls.PeerCertificate) =>
      tls.checkServerIdentity(tlsServername, cert);
  }
  return options;
}

/** Transporte SMTP (Maddy na rede Docker ou servidor externo). */
export function createSmtpTransporter(): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  const host = env.SMTP_HOST!;
  const port = parseInt(env.SMTP_PORT || '587', 10);
  const secure = env.SMTP_SECURE === 'true';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! },
    requireTLS: !secure && port === 587,
    tls: buildTlsOptions(host),
  });
}

export function formatFromAddress(fromName?: string): string {
  const addr = env.SMTP_FROM || env.SMTP_USER!;
  const name = (fromName || getOrgDisplayName()).trim();
  return name ? `${name} <${addr}>` : addr;
}

export type SmtpProviderInfo = {
  configurado: boolean;
  provedor: 'maddy' | 'smtp' | 'resend' | 'nenhum';
  host: string | null;
  porta: number | null;
  remetente: string | null;
  tlsServername: string | null;
  usuario: string | null;
};

export function getSmtpProviderInfo(): SmtpProviderInfo {
  if (hasSmtpConfig()) {
    const host = env.SMTP_HOST!;
    const isMaddy = host === 'maddy' || MADDY_INTERNAL_HOSTS.has(host);
    return {
      configurado: true,
      provedor: isMaddy ? 'maddy' : 'smtp',
      host,
      porta: parseInt(env.SMTP_PORT || '587', 10),
      remetente: env.SMTP_FROM || env.SMTP_USER || null,
      tlsServername: resolveTlsServername(host),
      usuario: env.SMTP_USER || null,
    };
  }

  if (hasResendConfig()) {
    return {
      configurado: true,
      provedor: 'resend',
      host: null,
      porta: null,
      remetente: env.RESEND_FROM || env.SMTP_FROM || null,
      tlsServername: null,
      usuario: null,
    };
  }

  return {
    configurado: false,
    provedor: 'nenhum',
    host: null,
    porta: null,
    remetente: null,
    tlsServername: null,
    usuario: null,
  };
}

export type DeliverEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
};

/** Envio transacional centralizado — Maddy (SMTP) tem prioridade sobre Resend. */
export async function deliverEmail(input: DeliverEmailInput): Promise<void> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((e) => e.trim())
    .filter(Boolean);
  if (!recipients.length) {
    throw new Error('Informe ao menos um destinatário');
  }

  const text =
    input.text || input.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  if (hasSmtpConfig()) {
    const transporter = createSmtpTransporter();
    await transporter.sendMail({
      from: formatFromAddress(input.fromName),
      to: recipients.join(', '),
      subject: input.subject,
      html: input.html,
      text,
    });
    return;
  }

  if (hasResendConfig()) {
    const resend = new Resend(env.RESEND_API_KEY!);
    const from = env.RESEND_FROM || formatFromAddress(input.fromName);
    const { error } = await resend.emails.send({
      from,
      to: recipients,
      subject: input.subject,
      html: input.html,
      text,
    });
    if (error) {
      throw new Error(error.message || 'Falha ao enviar via Resend');
    }
    return;
  }

  throw new Error('Serviço de e-mail não configurado (Maddy/SMTP ou Resend)');
}

export type SmtpConnectionResult = {
  ok: boolean;
  mensagem: string;
  latenciaMs?: number;
};

/** Verifica ligação SMTP ao Maddy (ou outro host configurado). */
export async function verifySmtpConnection(): Promise<SmtpConnectionResult> {
  if (!hasSmtpConfig()) {
    return { ok: false, mensagem: 'SMTP não configurado' };
  }

  const started = Date.now();
  try {
    const transporter = createSmtpTransporter();
    await transporter.verify();
    return {
      ok: true,
      mensagem: 'Conexão SMTP OK',
      latenciaMs: Date.now() - started,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha na verificação SMTP';
    return {
      ok: false,
      mensagem: message,
      latenciaMs: Date.now() - started,
    };
  }
}

export function isEmailDeliveryConfigured(): boolean {
  return hasSmtpConfig() || hasResendConfig();
}
