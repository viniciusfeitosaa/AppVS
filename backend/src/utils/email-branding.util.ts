/**
 * Elementos visuais partilhados entre e-mails transacionais (redefinição de senha, DocuSeal, etc.).
 */

export function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Logo: EMAIL_LOGO_URL ou frontend + /assets/logo.png (igual ao e-mail de redefinir senha). */
export function getEmailLogoUrl(): string {
  const raw = (process.env.FRONTEND_URL || process.env.FRONTEND_APP_URL || 'https://sejavivasaude.com.br').trim();
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
  return `${origin}${prefix}/assets/logo.png`;
}

/**
 * Corpo do convite DocuSeal: só texto + Markdown mínimo (`**negrito**`, links `[texto](url)`).
 * O DocuSeal converte isto em HTML com sanitização estrita — sem imagens nem HTML complexo.
 * Variáveis: {{submitter.name}}, {{submitter.link}}, {{template.name}}.
 */
export function buildDocusealInviteEmailBody(variant: 'first' | 'second'): string {
  const year = new Date().getFullYear();
  const rodape = [`© ${year} Viva Saúde · mensagem automática`, 'Dúvidas? Responda a este e-mail.'].join(
    '\n'
  );

  if (variant === 'first') {
    return [
      `Olá {{submitter.name}},`,
      '',
      'A **Viva Saúde** enviou-lhe um documento para **assinatura eletrónica**. Pode rever e assinar na ligação segura abaixo — **não é necessário instalar** nenhuma aplicação.',
      '',
      '**Documento**',
      '{{template.name}}',
      '',
      '[Assinar documento]({{submitter.link}})',
      '',
      'Ligação direta (copiar se precisar):',
      '{{submitter.link}}',
      '',
      'Se não está à espera deste pedido, pode **ignorar** esta mensagem.',
      '',
      'Com os melhores cumprimentos,',
      '**Equipe Viva Saúde**',
      '',
      rodape,
    ].join('\n');
  }

  return [
    `Olá {{submitter.name}},`,
    '',
    '**Outro signatário já assinou.** Falta a sua parte para concluir o documento da **Viva Saúde**. Use a ligação segura abaixo — **sem instalação** de software.',
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
    '**Equipe Viva Saúde**',
    '',
    rodape,
  ].join('\n');
}

