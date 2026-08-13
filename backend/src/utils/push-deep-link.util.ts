/** Mapa tipo de NotificacaoMedico → rota do frontend (basename /app). */
export function pathForNotificacaoTipo(tipo: string): string {
  switch (tipo) {
    case 'EQUIPE_VINCULO':
    case 'SUBGRUPO_VINCULO':
    case 'BOAS_VINDAS':
    case 'AVISO_ADMIN':
      return '/dashboard';
    case 'ESCALA_NOVA':
    case 'ESCALA_EQUIPE_VINCULO':
      return '/escalas';
    case 'TROCA_PLANTAO_SOLICITADA':
      return '/meu-calendario-plantoes';
    case 'DOCUMENTO_NOVO':
      return '/documentos';
    case 'VAGA_NOVA':
      return '/vagas';
    case 'JUSTIFICATIVA_PONTO_ACEITA':
    case 'JUSTIFICATIVA_PONTO_RECUSADA':
      return '/historico-pontos';
    default:
      return '/dashboard';
  }
}
