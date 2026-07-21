export type EmailMensagemStatus = 'RASCUNHO' | 'ENVIADO' | 'FALHA';

export type EmailMensagem = {
  id: string;
  assunto: string;
  corpoHtml: string | null;
  corpoTexto: string | null;
  destinatarios: string[];
  status: EmailMensagemStatus;
  erroEnvio: string | null;
  enviadoEm: string | null;
  createdAt: string;
  updatedAt: string;
  criadoPor: { id: string; nome: string; email: string } | null;
};

export type SmtpProviderInfo = {
  configurado: boolean;
  provedor: 'maddy' | 'smtp' | 'resend' | 'nenhum';
  host: string | null;
  porta: number | null;
  remetente: string | null;
  tlsServername: string | null;
  usuario: string | null;
};

export type EmailPainelResumo = {
  rascunhos: number;
  enviados: number;
  falhas: number;
  total: number;
  smtpConfigurado: boolean;
  smtp?: SmtpProviderInfo;
};

export type SmtpTesteResultado = SmtpProviderInfo & {
  conexao: { ok: boolean; mensagem: string; latenciaMs?: number };
};

export type CreateEmailMensagemPayload = {
  assunto: string;
  corpoTexto?: string;
  corpoHtml?: string;
  destinatarios: string[];
};

export type EmailPainelTab = 'visao-geral' | 'novo' | 'historico';
