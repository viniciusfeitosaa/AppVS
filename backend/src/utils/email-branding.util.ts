/**
 * Elementos visuais partilhados entre e-mails transacionais (redefinição de senha, DocuSeal, etc.).
 */

export function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function getOrgDisplayName(): string {
  return (process.env.ORG_DISPLAY_NAME || process.env.SMTP_FROM_NAME || 'COOPVITTA').trim() || 'COOPVITTA';
}

export function getEmailTagline(): string {
  return (
    process.env.ORG_EMAIL_TAGLINE ||
    'Cooperativa de Trabalho dos Profissionais Assistenciais à Vida e à Saúde'
  ).trim();
}

/** Base URL do SPA React (rotas como /, /redefinir-senha, /ativar-conta). */
export function getFrontendAppBaseUrl(): string {
  const appUrl = process.env.FRONTEND_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/$/, '');
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  if (frontendUrl) return frontendUrl.replace(/\/$/, '');
  // Dev local com landing + Vite: app em :3000/app (não o default antigo :5173)
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000/app';
  }
  return 'http://localhost:5173';
}

/** Logo: EMAIL_LOGO_URL ou frontend + /assets/logo-coopvitta.png */
export function getEmailLogoUrl(): string {
  const raw = (process.env.FRONTEND_URL || process.env.FRONTEND_APP_URL || 'https://app.coopvitta.cloud').trim();
  let origin = raw;
  try {
    origin = new URL(raw).origin;
  } catch {
    origin = raw.replace(/\/$/, '');
  }
  const custom = process.env.EMAIL_LOGO_URL?.trim();
  if (custom) {
    if (/^https?:\/\//i.test(custom)) return custom;
    const normalizedPath = custom.startsWith('/') ? custom : `/${custom}`;
    return `${origin}${normalizedPath}`;
  }
  const prefix = (process.env.FRONTEND_ASSET_PREFIX || '').replace(/\/$/, '');
  return `${origin}${prefix}/assets/logo-coopvitta.png`;
}

function orgDisplayName(): string {
  return getOrgDisplayName();
}

/**
 * Corpo do convite DocuSeal: só texto + Markdown mínimo (`**negrito**`, links `[texto](url)`).
 * O DocuSeal converte isto em HTML com sanitização estrita — sem imagens nem HTML complexo.
 * Variáveis: {{submitter.name}}, {{submitter.link}}, {{template.name}}.
 */
export function buildDocusealInviteEmailBody(variant: 'first' | 'second'): string {
  const org = orgDisplayName();
  const year = new Date().getFullYear();
  const rodape = [
    `© ${year} ${org} · mensagem automática`,
    'Para aceder ao documento, confirme o código enviado ao seu e-mail (verificação de identidade).',
    'Dúvidas? Responda a este e-mail.',
  ].join('\n');

  if (variant === 'first') {
    return [
      `Olá {{submitter.name}},`,
      '',
      `A **${org}** enviou-lhe um documento para **assinatura eletrónica avançada**. Para sua segurança, será solicitado um **código de verificação** enviado a este endereço de e-mail antes de abrir o documento.`,
      '',
      '**Documento**',
      '{{template.name}}',
      '',
      '[Assinar documento]({{submitter.link}})',
      '',
      'Ligação direta (copiar se precisar):',
      '{{submitter.link}}',
      '',
      'Se não está à espera deste pedido, **não utilize o link** e contacte-nos.',
      '',
      'Com os melhores cumprimentos,',
      `**Equipe ${org}**`,
      '',
      rodape,
    ].join('\n');
  }

  return [
    `Olá {{submitter.name}},`,
    '',
    `**Outro signatário já assinou.** Falta a sua parte para concluir o documento da **${org}**. Será solicitado um **código de verificação** por e-mail antes do acesso.`,
    '',
    '**Documento**',
    '{{template.name}}',
    '',
    '[Continuar assinatura]({{submitter.link}})',
    '',
    'Ligação direta (copiar se precisar):',
    '{{submitter.link}}',
    '',
    'Com os melhores cumprimentos,',
    `**Equipe ${org}**`,
    '',
    rodape,
  ].join('\n');
}

