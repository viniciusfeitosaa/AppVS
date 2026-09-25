import { DocumentoPerfilTipo } from '@prisma/client';

export const DOCUMENTOS_PERFIL_FIELDS = [
  'cedulaIdentidadeCrm',
  'certidaoRegularidadeFiscalCrm',
  'comprovanteEnderecoResidencia',
  'dadosBancariosPfPix',
  'declaracaoRegularidadeContribuinteIndividual',
  'diploma',
  'documentoAssinaturaDigital',
  'rqeRegistroQualificacao',
  'rgCpfOuCnh',
  'tituloEspecialista',
] as const;

export type DocumentoPerfilFieldName = (typeof DOCUMENTOS_PERFIL_FIELDS)[number];

export const DOCUMENTO_TIPO_BY_FIELD: Record<DocumentoPerfilFieldName, DocumentoPerfilTipo> = {
  cedulaIdentidadeCrm: DocumentoPerfilTipo.CEDULA_IDENTIDADE_CRM,
  certidaoRegularidadeFiscalCrm: DocumentoPerfilTipo.CERTIDAO_REGULARIDADE_FISCAL_CRM,
  comprovanteEnderecoResidencia: DocumentoPerfilTipo.COMPROVANTE_ENDERECO,
  dadosBancariosPfPix: DocumentoPerfilTipo.DADOS_BANCARIOS_PF_PIX,
  declaracaoRegularidadeContribuinteIndividual:
    DocumentoPerfilTipo.DECLARACAO_REGULARIDADE_CONTRIBUINTE_INDIVIDUAL,
  diploma: DocumentoPerfilTipo.DIPLOMA,
  documentoAssinaturaDigital: DocumentoPerfilTipo.DOCUMENTO_ASSINATURA_DIGITAL,
  rqeRegistroQualificacao: DocumentoPerfilTipo.RQE,
  rgCpfOuCnh: DocumentoPerfilTipo.RG_CPF_OU_CNH,
  tituloEspecialista: DocumentoPerfilTipo.TITULO_ESPECIALISTA,
};

export const DOCUMENTO_FIELD_BY_TIPO: Record<DocumentoPerfilTipo, DocumentoPerfilFieldName> = {
  [DocumentoPerfilTipo.CEDULA_IDENTIDADE_CRM]: 'cedulaIdentidadeCrm',
  [DocumentoPerfilTipo.CERTIDAO_REGULARIDADE_FISCAL_CRM]: 'certidaoRegularidadeFiscalCrm',
  [DocumentoPerfilTipo.COMPROVANTE_ENDERECO]: 'comprovanteEnderecoResidencia',
  [DocumentoPerfilTipo.DADOS_BANCARIOS_PF_PIX]: 'dadosBancariosPfPix',
  [DocumentoPerfilTipo.DECLARACAO_REGULARIDADE_CONTRIBUINTE_INDIVIDUAL]:
    'declaracaoRegularidadeContribuinteIndividual',
  [DocumentoPerfilTipo.DIPLOMA]: 'diploma',
  [DocumentoPerfilTipo.DOCUMENTO_ASSINATURA_DIGITAL]: 'documentoAssinaturaDigital',
  [DocumentoPerfilTipo.RQE]: 'rqeRegistroQualificacao',
  [DocumentoPerfilTipo.RG_CPF_OU_CNH]: 'rgCpfOuCnh',
  [DocumentoPerfilTipo.TITULO_ESPECIALISTA]: 'tituloEspecialista',
};

export const DOCUMENTO_LABEL_BY_TIPO: Record<DocumentoPerfilTipo, string> = {
  [DocumentoPerfilTipo.CEDULA_IDENTIDADE_CRM]:
    'Documento do conselho profissional (cédula ou registro — CRM, COREN, CRP, etc.)',
  [DocumentoPerfilTipo.CERTIDAO_REGULARIDADE_FISCAL_CRM]:
    'Certidão de Regularidade Fiscal no Conselho Regional',
  [DocumentoPerfilTipo.COMPROVANTE_ENDERECO]: 'Comprovante de Endereço / Residência',
  [DocumentoPerfilTipo.DADOS_BANCARIOS_PF_PIX]: 'Dados bancários pessoa física e chave PIX',
  [DocumentoPerfilTipo.DECLARACAO_REGULARIDADE_CONTRIBUINTE_INDIVIDUAL]:
    'Declaração de Regularidade de Contribuinte Individual (gov.com)',
  [DocumentoPerfilTipo.DIPLOMA]: 'Diploma',
  [DocumentoPerfilTipo.DOCUMENTO_ASSINATURA_DIGITAL]: 'Documento com Assinatura Digital',
  [DocumentoPerfilTipo.RQE]: 'RQE - Registro de Qualificação',
  [DocumentoPerfilTipo.RG_CPF_OU_CNH]: 'RG/CPF ou CNH',
  [DocumentoPerfilTipo.TITULO_ESPECIALISTA]: 'Título - Especialista',
};

/** Campos multipart cujo ficheiro tem data de validade controlada na plataforma. */
export const DOCUMENTOS_PERFIL_COM_VALIDADE = [
  'cedulaIdentidadeCrm',
  'certidaoRegularidadeFiscalCrm',
  'comprovanteEnderecoResidencia',
  'declaracaoRegularidadeContribuinteIndividual',
  'rqeRegistroQualificacao',
] as const satisfies readonly DocumentoPerfilFieldName[];

export type DocumentoPerfilComValidade = (typeof DOCUMENTOS_PERFIL_COM_VALIDADE)[number];

export const DOCUMENTO_TIPOS_COM_VALIDADE: DocumentoPerfilTipo[] = DOCUMENTOS_PERFIL_COM_VALIDADE.map(
  (f) => DOCUMENTO_TIPO_BY_FIELD[f]
);

export function documentoExigeValidadeField(field: DocumentoPerfilFieldName): boolean {
  return (DOCUMENTOS_PERFIL_COM_VALIDADE as readonly string[]).includes(field);
}

export function documentoExigeValidadeTipo(tipo: DocumentoPerfilTipo): boolean {
  return DOCUMENTO_TIPOS_COM_VALIDADE.includes(tipo);
}

/** Prefixo dos campos de data no multipart: validadeEm__cedulaIdentidadeCrm */
export const VALIDADE_FIELD_PREFIX = 'validadeEm__';

/** Dias restantes ≤ este valor → status PROXIMO. */
export const DOCUMENTO_VALIDADE_DIAS_ALERTA = 30;

export type StatusValidadeDocumento = 'OK' | 'PROXIMO' | 'VENCIDO' | 'SEM_DATA' | 'NAO_APLICA';

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Interpreta `YYYY-MM-DD` (ou ISO) como data UTC sem hora. */
export function parseValidadeEmDate(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(y, mo - 1, day));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== day) return null;
  return d;
}

export function formatValidadeEmIsoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function diasAteValidade(validadeEm: Date, hoje = new Date()): number {
  const a = startOfUtcDay(hoje).getTime();
  const b = startOfUtcDay(validadeEm).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function statusValidadeDocumento(
  tipo: DocumentoPerfilTipo,
  validadeEm: Date | null | undefined,
  hoje = new Date()
): StatusValidadeDocumento {
  if (!documentoExigeValidadeTipo(tipo)) return 'NAO_APLICA';
  if (!validadeEm) return 'SEM_DATA';
  const dias = diasAteValidade(validadeEm, hoje);
  if (dias < 0) return 'VENCIDO';
  if (dias <= DOCUMENTO_VALIDADE_DIAS_ALERTA) return 'PROXIMO';
  return 'OK';
}

export function parseDocumentoValidadesFromBody(
  body: unknown
): Partial<Record<DocumentoPerfilFieldName, string>> {
  const out: Partial<Record<DocumentoPerfilFieldName, string>> = {};
  if (!body || typeof body !== 'object') return out;
  const rec = body as Record<string, unknown>;
  for (const field of DOCUMENTOS_PERFIL_FIELDS) {
    const raw = rec[`${VALIDADE_FIELD_PREFIX}${field}`];
    if (typeof raw === 'string' && raw.trim()) {
      out[field] = raw.trim().slice(0, 10);
    }
  }
  return out;
}

export function piorStatusValidade(
  statuses: StatusValidadeDocumento[]
): StatusValidadeDocumento | null {
  if (statuses.includes('VENCIDO')) return 'VENCIDO';
  if (statuses.includes('PROXIMO')) return 'PROXIMO';
  if (statuses.includes('SEM_DATA')) return 'SEM_DATA';
  if (statuses.includes('OK')) return 'OK';
  return null;
}
