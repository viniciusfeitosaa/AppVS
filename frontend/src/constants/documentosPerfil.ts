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

export type DocumentoPerfilField = (typeof DOCUMENTOS_PERFIL_FIELDS)[number];

export const DOCUMENTO_LABEL_BY_FIELD: Record<DocumentoPerfilField, string> = {
  cedulaIdentidadeCrm: 'Cédula de Identidade de Médico (CRM)',
  certidaoRegularidadeFiscalCrm: 'Certidão de Regularidade Fiscal no Conselho Regional',
  comprovanteEnderecoResidencia: 'Comprovante de Endereço / Residência',
  dadosBancariosPfPix: 'Dados bancários pessoa física e chave PIX',
  declaracaoRegularidadeContribuinteIndividual:
    'Declaração de Regularidade de Contribuinte Individual (gov.com)',
  diploma: 'Diploma',
  documentoAssinaturaDigital: 'Documento com Assinatura Digital',
  rqeRegistroQualificacao: 'RQE - Registro de Qualificação',
  rgCpfOuCnh: 'RG/CPF ou CNH',
  tituloEspecialista: 'Título - Especialista',
};

export const DOCUMENTO_TIPO_BY_FIELD: Record<DocumentoPerfilField, string> = {
  cedulaIdentidadeCrm: 'CEDULA_IDENTIDADE_CRM',
  certidaoRegularidadeFiscalCrm: 'CERTIDAO_REGULARIDADE_FISCAL_CRM',
  comprovanteEnderecoResidencia: 'COMPROVANTE_ENDERECO',
  dadosBancariosPfPix: 'DADOS_BANCARIOS_PF_PIX',
  declaracaoRegularidadeContribuinteIndividual: 'DECLARACAO_REGULARIDADE_CONTRIBUINTE_INDIVIDUAL',
  diploma: 'DIPLOMA',
  documentoAssinaturaDigital: 'DOCUMENTO_ASSINATURA_DIGITAL',
  rqeRegistroQualificacao: 'RQE',
  rgCpfOuCnh: 'RG_CPF_OU_CNH',
  tituloEspecialista: 'TITULO_ESPECIALISTA',
};
