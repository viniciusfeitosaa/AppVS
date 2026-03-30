import { prisma } from '../config/database';
import env from '../config/env';
import { normalizeCRM, validateCPF, validateCRM } from '../utils/validation.util';
import { comparePassword, hashPassword } from '../utils/password.util';
import { generateTokens } from '../utils/jwt.util';
import { createAuditLog } from './auditoria.service';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';
import tls from 'tls';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import twilio from 'twilio';

const RESET_EMAIL_SUBJECT = 'Redefinir sua senha — Viva Saúde';

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Logo nos e-mails: EMAIL_LOGO_URL ou FRONTEND_URL + /assets/logo-horizontal.png (PNG costuma abrir melhor que AVIF). */
function getResetEmailLogoUrl(): string {
  const custom = process.env.EMAIL_LOGO_URL?.trim();
  if (custom) return custom;
  const base = (process.env.FRONTEND_URL || 'https://sejavivasaude.com.br').replace(/\/$/, '');
  const prefix = (process.env.FRONTEND_ASSET_PREFIX || '').replace(/\/$/, '');
  return `${base}${prefix}/assets/logo-horizontal.png`;
}

function buildResetPasswordEmailHtml(resetLink: string): string {
  const href = escapeHtmlAttr(resetLink);
  const logoSrc = escapeHtmlAttr(getResetEmailLogoUrl());
  const year = new Date().getFullYear();
  const linkDisplay = resetLink.replace(/&/g, '&amp;');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="x-ua-compatible" content="ie=edge">
<title>Redefinir senha — Viva Saúde</title>
</head>
<body style="margin:0;padding:0;background-color:#ecfdf5;">
<!-- Pré-visualização em alguns clientes de e-mail -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Use o link seguro para criar uma nova senha na Viva Saúde. Válido por 1 hora.</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ecfdf5;">
  <tr>
    <td align="center" style="padding:28px 14px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #bbf7d0;box-shadow:0 12px 40px rgba(20,83,45,0.1);">
        <tr>
          <td bgcolor="#ecfdf5" style="padding:32px 28px 24px;text-align:center;background:linear-gradient(180deg,#ecfdf5 0%,#ffffff 55%);border-bottom:1px solid #d1fae5;">
            <img src="${logoSrc}" alt="Viva Saúde" width="220" height="auto" style="display:block;margin:0 auto 12px;max-width:220px;height:auto;border:0;outline:none;text-decoration:none;">
            <p style="margin:0;font-size:13px;letter-spacing:0.02em;color:#15803d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Cuidado que conecta profissionais e instituições</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
            <p style="margin:0 0 6px;font-size:15px;line-height:1.5;color:#374151;">Olá,</p>
            <h1 style="margin:0 0 18px;font-size:23px;font-weight:700;line-height:1.3;color:#14532d;letter-spacing:-0.02em;">Redefinir sua senha de acesso</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#4b5563;">Recebemos um pedido para <strong style="color:#166534;font-weight:600;">criar uma nova senha</strong> para a sua conta na plataforma <strong style="color:#14532d;">Viva Saúde</strong>.</p>
            <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#4b5563;">Para continuar com segurança, toque no botão abaixo. O link é <strong style="color:#14532d;">válido por 1 hora</strong> e só pode ser usado uma vez.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 26px;">
              <tr>
                <td style="border-radius:14px;background-color:#166534;box-shadow:0 4px 14px rgba(22,101,52,0.35);">
                  <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 40px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:14px;">Criar nova senha</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#6b7280;">O botão não abre? Copie e cole este endereço no navegador:</p>
            <p style="margin:0 0 26px;padding:12px 14px;background-color:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;font-size:12px;line-height:1.55;color:#166534;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${linkDisplay}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px;">
              <tr>
                <td style="width:4px;background-color:#22c55e;border-radius:2px;"></td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;"><strong style="color:#374151;">Não foi você?</strong> Ignore este e-mail com tranquilidade — a sua senha atual continua válida e nada será alterado.</p>
                </td>
              </tr>
            </table>
            <p style="margin:22px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;font-size:14px;line-height:1.55;color:#4b5563;">Com os melhores cumprimentos,<br><strong style="color:#166534;">Equipe Viva Saúde</strong></p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px 22px;background-color:#f0fdf4;text-align:center;font-size:11px;line-height:1.55;color:#86a89a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
            © ${year} Viva Saúde. Este e-mail foi enviado automaticamente; não é necessário responder.<br>
            Dúvidas? Fale connosco pelo canal de suporte da sua instituição ou pelo e-mail de contato oficial.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildResetPasswordEmailText(resetLink: string): string {
  const line = '─'.repeat(44);
  return [
    'VIVA SAÚDE — Redefinição de senha',
    line,
    '',
    'Olá,',
    '',
    'Recebemos um pedido para criar uma nova senha para a sua conta na plataforma Viva Saúde.',
    '',
    'Para continuar com segurança, abra o link abaixo no navegador. Ele é válido por 1 hora e só pode ser usado uma vez:',
    '',
    resetLink,
    '',
    '—',
    '',
    'Não foi você?',
    'Pode ignorar este e-mail com tranquilidade — a sua senha atual continua válida e nada será alterado.',
    '',
    'Com os melhores cumprimentos,',
    'Equipe Viva Saúde',
    '',
    line,
    'Mensagem automática. Por favor, não responda a este e-mail.',
  ].join('\n');
}

function hasResendConfig(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function hasSmtpConfig(): boolean {
  const e = process.env;
  return !!(e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS);
}

function hasEvolutionConfig(): boolean {
  const e = process.env;
  return !!(e.EVOLUTION_API_URL && e.EVOLUTION_API_KEY && e.EVOLUTION_INSTANCE);
}

function hasTwilioConfig(): boolean {
  const e = process.env;
  return !!(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_WHATSAPP_FROM);
}

function hasWhatsAppConfig(): boolean {
  return hasEvolutionConfig() || hasTwilioConfig();
}

/** Normaliza telefone para E.164 (ex.: 11999999999 → 5511999999999). Retorna null se inválido. */
function normalizePhoneForWhatsApp(telefone: string | null | undefined): string | null {
  if (!telefone || typeof telefone !== 'string') return null;
  const digits = telefone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCountry = digits.length === 10 || digits.length === 11 ? '55' + digits : digits.startsWith('55') ? digits : '55' + digits;
  return withCountry.length >= 12 ? withCountry : null;
}

const RESET_WHATSAPP_BODY = (resetLink: string) =>
  `*Viva Saúde* — Redefinição de senha\n\nPara criar uma nova senha, abra o link abaixo (válido por 1 hora):\n${resetLink}\n\nSe não foi você, ignore esta mensagem — a sua senha permanece a mesma.`;

async function sendResetPasswordWhatsApp(toPhoneE164: string, resetLink: string): Promise<void> {
  const number = toPhoneE164.replace(/^\++/, '');
  const body = RESET_WHATSAPP_BODY(resetLink);

  if (hasEvolutionConfig()) {
    const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const instance = process.env.EVOLUTION_INSTANCE!;
    const apiKey = process.env.EVOLUTION_API_KEY!;
    const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ number, text: body }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Evolution API ${res.status}: ${errText}`);
    }
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!;
  const client = twilio(accountSid, authToken);
  await client.messages.create({
    from,
    to: `whatsapp:+${number}`,
    body,
  });
}

async function sendResetPasswordEmailResend(to: string, resetLink: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY!;
  const from = process.env.RESEND_FROM || 'Viva Saúde <onboarding@resend.dev>';
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: RESET_EMAIL_SUBJECT,
    html: buildResetPasswordEmailHtml(resetLink),
    text: buildResetPasswordEmailText(resetLink),
  });
  if (error) {
    console.error('[esqueci-senha] Resend API error:', JSON.stringify(error));
    throw new Error(error.message || 'Resend falhou');
  }
  console.log('[esqueci-senha] Resend enviado com sucesso. id:', data?.id ?? 'n/a', 'para:', to);
}

async function sendResetPasswordEmailSmtp(to: string, resetLink: string): Promise<void> {
  if (!hasSmtpConfig()) return;
  const host = process.env.SMTP_HOST!;
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  // Com SMTP_HOST=maddy ou 127.0.0.1 o cert do servidor é para mail.* — o Node precisa do nome certo para TLS/SNI.
  const tlsServername =
    process.env.SMTP_TLS_SERVERNAME?.trim() ||
    (['maddy', '127.0.0.1', 'localhost'].includes(host) ? 'mail.vivasaude.cloud' : host);
  // Ligação ao hostname Docker (ex.: maddy) mas certificado emitido para mail.* — validar contra tlsServername.
  const tlsOptions: tls.ConnectionOptions = {
    servername: tlsServername,
    ...(host !== tlsServername
      ? {
          checkServerIdentity: (_hostname: string, cert: tls.PeerCertificate) =>
            tls.checkServerIdentity(tlsServername, cert),
        }
      : {}),
  };
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure && port === 587,
    tls: tlsOptions,
  });
  const from = process.env.SMTP_FROM || user;
  await transporter.sendMail({
    from: from ? `Viva Saúde <${from}>` : user,
    to,
    subject: RESET_EMAIL_SUBJECT,
    text: buildResetPasswordEmailText(resetLink),
    html: buildResetPasswordEmailHtml(resetLink),
  });
}

export interface LoginResult {
  user: {
    id: string;
    role: UserRole;
    tenantId: string;
    nomeCompleto: string;
    profissao?: string;
    crm?: string | null;
    email?: string | null;
    especialidades: string[];
    vinculo?: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

interface RegisterPublicMedicoInput {
  nomeCompleto: string;
  email: string;
  password: string;
  cpf: string;
  profissao: string;
  crm?: string;
  especialidades?: string[];
  telefone: string;
}

const getDefaultTenant = async () => {
  const tenant = await prisma.tenant.findFirst({
    where: {
      slug: env.TENANT_DEFAULT_SLUG,
      ativo: true,
    },
  });

  if (!tenant) {
    throw {
      statusCode: 500,
      message:
        'Banco não configurado. No terminal, na pasta backend, rode: npx prisma db push e depois npm run prisma:seed',
    };
  }

  return tenant;
};

const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const createMedicoSession = async (prismaClient: any, medicoId: string, refreshToken: string) => {
  await prismaClient.sessao.create({
    data: {
      medicoId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
};

const createMasterSession = async (prismaClient: any, masterId: string, refreshToken: string) => {
  await prismaClient.sessaoMaster.create({
    data: {
      masterId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
};

export const loginMedicoService = async (
  cpf: string,
  crm: string
): Promise<LoginResult> => {
  const tenant = await getDefaultTenant();
  const normalizedCRM = normalizeCRM(crm);

  // Validar CPF
  if (!validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido' };
  }

  // Validar CRM
  if (!validateCRM(crm)) {
    throw { statusCode: 400, message: 'CRM inválido' };
  }

  // Buscar médico
  const medico = await prisma.medico.findFirst({
    where: {
      tenantId: tenant.id,
      cpf: cpf.replace(/\D/g, ''), // Remove formatação
      crm: normalizedCRM!,
      ativo: true,
    },
  });

  if (!medico) {
    // Log de tentativa de login inválida
    await createAuditLog({
      acao: 'TENTATIVA_LOGIN_INVALIDA',
      tenantId: tenant.id,
      detalhes: {
        cpf: cpf.replace(/\D/g, ''),
        crm: normalizedCRM,
      },
    });

    throw { statusCode: 401, message: 'CPF ou CRM inválidos' };
  }

  // Gerar tokens
  const { accessToken, refreshToken } = await generateTokens(
    medico.id,
    UserRole.MEDICO,
    tenant.id
  );

  // Salvar sessão (refresh token)
  await createMedicoSession(prisma, medico.id, refreshToken);

  // Log de login bem-sucedido
  await createAuditLog({
    acao: 'LOGIN_MEDICO',
    medicoId: medico.id,
    tenantId: tenant.id,
  });

  return {
    user: {
      id: medico.id,
      role: UserRole.MEDICO,
      tenantId: tenant.id,
      nomeCompleto: medico.nomeCompleto,
      profissao: medico.profissao ?? 'Médico',
      crm: medico.crm,
      email: medico.email,
      especialidades: medico.especialidades ?? [],
      vinculo: medico.vinculo ?? null,
    },
    accessToken,
    refreshToken,
  };
};

export const loginMasterService = async (
  email: string,
  password: string
): Promise<LoginResult> => {
  const tenant = await getDefaultTenant();
  const normalizedEmail = email.trim().toLowerCase();

  const master = await prisma.usuarioMaster.findFirst({
    where: {
      tenantId: tenant.id,
      email: normalizedEmail,
      ativo: true,
      role: UserRole.MASTER,
    },
  });

  if (!master) {
    await createAuditLog({
      acao: 'TENTATIVA_LOGIN_MASTER_INVALIDA',
      tenantId: tenant.id,
      detalhes: { email: normalizedEmail },
    });
    throw { statusCode: 401, message: 'E-mail ou senha inválidos' };
  }

  const isValidPassword = await comparePassword(password, master.senhaHash);
  if (!isValidPassword) {
    await createAuditLog({
      acao: 'TENTATIVA_LOGIN_MASTER_INVALIDA',
      tenantId: tenant.id,
      masterId: master.id,
      detalhes: { email: normalizedEmail },
    });
    throw { statusCode: 401, message: 'E-mail ou senha inválidos' };
  }

  const { accessToken, refreshToken } = await generateTokens(
    master.id,
    UserRole.MASTER,
    tenant.id
  );

  await createMasterSession(prisma, master.id, refreshToken);

  await createAuditLog({
    acao: 'LOGIN_MASTER',
    tenantId: tenant.id,
    masterId: master.id,
  });

  return {
    user: {
      id: master.id,
      role: UserRole.MASTER,
      tenantId: tenant.id,
      nomeCompleto: master.nome,
      email: master.email,
      especialidades: [],
    },
    accessToken,
    refreshToken,
  };
};

// Compatibilidade com endpoint legado /login
export const loginService = loginMedicoService;

export const loginByEmailService = async (
  email: string,
  password: string
): Promise<LoginResult> => {
  const tenant = await getDefaultTenant();
  const normalizedEmail = email.trim().toLowerCase();

  // 1) Tenta master primeiro
  const master = await prisma.usuarioMaster.findFirst({
    where: {
      tenantId: tenant.id,
      email: normalizedEmail,
      ativo: true,
      role: UserRole.MASTER,
    },
  });

  if (master) {
    const ok = await comparePassword(password, master.senhaHash);
    if (!ok) {
      throw { statusCode: 401, message: 'E-mail ou senha inválidos' };
    }

    const { accessToken, refreshToken } = await generateTokens(
      master.id,
      UserRole.MASTER,
      tenant.id
    );
    await createMasterSession(prisma, master.id, refreshToken);

    return {
      user: {
        id: master.id,
        role: UserRole.MASTER,
        tenantId: tenant.id,
        nomeCompleto: master.nome,
        email: master.email,
        especialidades: [],
      },
      accessToken,
      refreshToken,
    };
  }

  // 2) Senão, tenta médico por e-mail/senha
  const medico = await prisma.medico.findFirst({
    where: {
      tenantId: tenant.id,
      email: normalizedEmail,
      ativo: true,
    },
  });

  if (!medico) {
    throw { statusCode: 401, message: 'E-mail ou senha inválidos' };
  }

  const ok = await comparePassword(password, medico.senhaHash);
  if (!ok) {
    throw { statusCode: 401, message: 'E-mail ou senha inválidos' };
  }

  const { accessToken, refreshToken } = await generateTokens(
    medico.id,
    UserRole.MEDICO,
    tenant.id
  );
  await createMedicoSession(prisma, medico.id, refreshToken);

  return {
    user: {
      id: medico.id,
      role: UserRole.MEDICO,
      tenantId: tenant.id,
      nomeCompleto: medico.nomeCompleto,
      profissao: medico.profissao ?? 'Médico',
      crm: medico.crm,
      email: medico.email,
      especialidades: medico.especialidades ?? [],
      vinculo: medico.vinculo ?? null,
    },
    accessToken,
    refreshToken,
  };
};

export const acceptInviteService = async (
  token: string,
  password: string
): Promise<LoginResult> => {
  const tenant = await getDefaultTenant();
  const tokenHash = hashToken(token);

  const senhaHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx: any) => {
    const medico = await tx.medico.findFirst({
      where: {
        tenantId: tenant.id,
        inviteTokenHash: tokenHash,
        inviteExpiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!medico) {
      throw { statusCode: 400, message: 'Convite inválido ou expirado' };
    }

    const updated = await tx.medico.update({
      where: { id: medico.id },
      data: {
        senhaHash,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        inviteAcceptedAt: new Date(),
        ativo: true,
      },
    });

    const { accessToken, refreshToken } = await generateTokens(
      updated.id,
      UserRole.MEDICO,
      tenant.id
    );

    await createMedicoSession(tx, updated.id, refreshToken);
    await createAuditLog(
      {
        acao: 'ACEITAR_CONVITE_MEDICO',
        tenantId: tenant.id,
        medicoId: updated.id,
      },
      tx
    );

    return {
      user: {
        id: updated.id,
        role: UserRole.MEDICO,
        tenantId: tenant.id,
        nomeCompleto: updated.nomeCompleto,
        profissao: updated.profissao ?? 'Médico',
        crm: updated.crm,
        email: updated.email,
        especialidades: updated.especialidades ?? [],
        vinculo: updated.vinculo ?? null,
      },
      accessToken,
      refreshToken,
    };
  });

  try {
    const { notificarBoasVindasMedico } = await import('./notificacao-medico.service');
    await notificarBoasVindasMedico(tenant.id, result.user.id, result.user.nomeCompleto);
  } catch (err) {
    console.error('[notificacao] boas-vindas (convite):', err);
  }

  return result;
};

const PROFISSAO_MEDICO = 'Médico';

export const registerPublicMedicoService = async (
  input: RegisterPublicMedicoInput
) => {
  const tenant = await getDefaultTenant();
  const cpf = input.cpf.replace(/\D/g, '');
  const email = input.email.trim().toLowerCase();
  const profissao = (input.profissao || '').trim();
  const isMedico = profissao === PROFISSAO_MEDICO;

  if (!validateCPF(cpf)) {
    throw { statusCode: 400, message: 'CPF inválido' };
  }

  if (!profissao) {
    throw { statusCode: 400, message: 'Profissão é obrigatória' };
  }

  let crm: string | null = null;
  if (isMedico) {
    const crmNorm = input.crm ? normalizeCRM(input.crm) : '';
    if (!crmNorm || !validateCRM(crmNorm)) {
      throw { statusCode: 400, message: 'CRM inválido' };
    }
    crm = crmNorm;
  }

  // Médico sem especialidades = [Clínica Médica]; senão usa as enviadas (várias permitidas)
  const especialidades = (input.especialidades || []).filter((e) => (e || '').trim()).map((e) => (e || '').trim());
  const especialidadesFinal = isMedico
    ? (especialidades.length > 0 ? especialidades : ['Clínica Médica'])
    : especialidades;

  const [existingByCpf, existingByCrm, existingByEmail] = await Promise.all([
    prisma.medico.findFirst({ where: { tenantId: tenant.id, cpf } }),
    crm
      ? prisma.medico.findFirst({ where: { tenantId: tenant.id, crm } })
      : Promise.resolve(null),
    prisma.medico.findFirst({ where: { tenantId: tenant.id, email } }),
  ]);

  if (existingByCpf) {
    throw { statusCode: 409, message: 'Já existe cadastro com este CPF' };
  }

  if (existingByCrm) {
    throw { statusCode: 409, message: 'Já existe cadastro com este CRM' };
  }

  if (existingByEmail) {
    throw { statusCode: 409, message: 'Já existe cadastro com este e-mail' };
  }

  const senhaHash = await hashPassword(input.password);

  const medico = await prisma.$transaction(async (tx: any) => {
    const created = await tx.medico.create({
      data: {
        tenantId: tenant.id,
        nomeCompleto: input.nomeCompleto.trim(),
        email,
        cpf,
        profissao,
        crm,
        senhaHash,
        especialidades: especialidadesFinal,
        vinculo: 'Associado',
        telefone: input.telefone.trim(),
        ativo: true,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        inviteAcceptedAt: new Date(),
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        crm: true,
        vinculo: true,
      },
    });

    await createAuditLog(
      {
        acao: 'CADASTRO_PUBLICO_MEDICO',
        tenantId: tenant.id,
        medicoId: created.id,
        detalhes: {
          email: created.email,
          crm: created.crm,
          vinculo: created.vinculo ?? null,
        },
      },
      tx
    );

    return created;
  });

  try {
    const { notificarBoasVindasMedico } = await import('./notificacao-medico.service');
    await notificarBoasVindasMedico(tenant.id, medico.id, medico.nomeCompleto);
  } catch (err) {
    console.error('[notificacao] boas-vindas (cadastro público):', err);
  }

  return {
    medico,
    message: 'Cadastro realizado com sucesso. Você já pode fazer login.',
  };
};

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hora

export async function esqueciSenhaService(email: string): Promise<{
  ok: boolean;
  message: string;
  resetLink?: string;
}> {
  const tenant = await getDefaultTenant();
  const normalizedEmail = email.trim().toLowerCase();
  console.log('[esqueci-senha] Solicitação para:', normalizedEmail ? `${normalizedEmail.slice(0, 3)}***@***` : '(vazio)');

  if (!normalizedEmail) {
    return { ok: true, message: 'Se existir uma conta com este e-mail, você receberá um link para redefinir a senha.' };
  }

  // Buscar Master primeiro, depois Médico
  const master = await prisma.usuarioMaster.findFirst({
    where: { tenantId: tenant.id, email: normalizedEmail, ativo: true },
    select: { id: true },
  });
  const medico = !master
    ? await prisma.medico.findFirst({
        where: { tenantId: tenant.id, email: normalizedEmail, ativo: true },
        select: { id: true, telefone: true },
      })
    : null;

  if (!master && !medico) {
    console.log('[esqueci-senha] Nenhuma conta encontrada para este e-mail (nem Master nem Médico).');
    return { ok: true, message: 'Se existir uma conta com este e-mail, você receberá um link para redefinir a senha.' };
  }
  console.log('[esqueci-senha] Conta encontrada:', master ? 'MASTER' : 'MEDICO');

  const tipo = master ? 'MASTER' : 'MEDICO';
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await prisma.$transaction(async (tx: any) => {
    await tx.resetSenhaToken.create({
      data: {
        tenantId: tenant.id,
        email: normalizedEmail,
        tokenHash,
        tipo,
        expiresAt,
      },
    });
  });

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const resetLink = `${frontendUrl}/redefinir-senha?token=${token}`;

  const whatsAppPhone = medico?.telefone ? normalizePhoneForWhatsApp(medico.telefone) : null;
  const sendViaWhatsApp = !!medico && !!whatsAppPhone && hasWhatsAppConfig();

  if (sendViaWhatsApp) {
    try {
      await sendResetPasswordWhatsApp(whatsAppPhone, resetLink);
    } catch (err: any) {
      console.error('[esqueci-senha] Falha ao enviar WhatsApp:', err?.message || err);
      if (process.env.NODE_ENV === 'production') {
        console.error('[esqueci-senha] Link para uso manual:', resetLink);
      }
    }
  } else {
    const sendEmail = async () => {
      if (hasResendConfig()) {
        console.log('[esqueci-senha] Enviando e-mail via Resend para:', normalizedEmail);
        await sendResetPasswordEmailResend(normalizedEmail, resetLink);
        return;
      }
      if (hasSmtpConfig()) {
        console.log('[esqueci-senha] Enviando e-mail via SMTP para:', normalizedEmail);
        await sendResetPasswordEmailSmtp(normalizedEmail, resetLink);
        return;
      }
      throw new Error('Nenhum provedor de e-mail configurado (RESEND_API_KEY ou SMTP)');
    };
    try {
      await sendEmail();
    } catch (err: any) {
      console.error('[esqueci-senha] Falha ao enviar e-mail:', err?.message || err, err?.code || '');
      if (process.env.NODE_ENV === 'production') {
        console.error('[esqueci-senha] Link para uso manual (apague após testar):', resetLink);
      }
    }
  }

  if (process.env.NODE_ENV === 'development' && !sendViaWhatsApp && !hasResendConfig() && !hasSmtpConfig()) {
    console.log('[esqueci-senha] Link de redefinição (dev, e-mail/WhatsApp não configurado):', resetLink);
    return { ok: true, message: 'Se existir uma conta com este e-mail, você receberá um link para redefinir a senha.', resetLink };
  }

  return { ok: true, message: 'Se existir uma conta com este e-mail, você receberá um link para redefinir a senha.' };
}

export async function redefinirSenhaService(token: string, novaSenha: string): Promise<{ ok: boolean; message: string }> {
  const tokenHash = hashToken(token);
  const tenant = await getDefaultTenant();

  return prisma.$transaction(async (tx: any) => {
    const record = await tx.resetSenhaToken.findFirst({
      where: { tokenHash, tenantId: tenant.id },
    });

    if (!record) {
      throw { statusCode: 400, message: 'Link inválido ou expirado. Solicite uma nova redefinição de senha.' };
    }
    if (new Date() > record.expiresAt) {
      await tx.resetSenhaToken.deleteMany({ where: { id: record.id } });
      throw { statusCode: 400, message: 'Link expirado. Solicite uma nova redefinição de senha.' };
    }

    const hashed = await hashPassword(novaSenha);

    if (record.tipo === 'MASTER') {
      await tx.usuarioMaster.updateMany({
        where: { tenantId: tenant.id, email: record.email },
        data: { senhaHash: hashed },
      });
    } else {
      await tx.medico.updateMany({
        where: { tenantId: tenant.id, email: record.email },
        data: { senhaHash: hashed },
      });
    }

    await tx.resetSenhaToken.deleteMany({ where: { id: record.id } });

    return { ok: true, message: 'Senha alterada com sucesso. Faça login com a nova senha.' };
  });
}
