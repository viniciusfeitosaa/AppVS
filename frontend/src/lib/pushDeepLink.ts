/** Mapa tipo NotificacaoMedico → rota React (basename /app). */
export function pathForPushTipo(tipo: string | undefined | null): string {
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
    default:
      return '/dashboard';
  }
}
