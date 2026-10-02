const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;

export const OFFLINE_IDADE_MAXIMA_MS = 24 * HORA;
export const OFFLINE_REVISAR_ATRASO_MS = 12 * HORA;
export const OFFLINE_REVISAR_DESVIO_MS = 10 * MINUTO;
const FOLGA_FUTURO_MS = 5 * MINUTO;

export interface InstanteOffline {
  /** Horário da captura no relógio do servidor. */
  instante: Date;
  /** Servidor − aparelho no momento do envio. */
  desvioMs: number;
  atrasoMs: number;
  revisar: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isClientUuidValido(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/**
 * O aparelho informa quando capturou e quando enviou, ambos no próprio relógio.
 * A diferença entre o envio e a chegada corrige um relógio adiantado/atrasado.
 */
export function resolverInstanteOffline(params: {
  capturadoEm: string | undefined;
  enviadoEm: string | undefined;
  agora?: Date;
}): InstanteOffline {
  const agora = params.agora ?? new Date();
  const capturado = params.capturadoEm ? new Date(params.capturadoEm) : null;
  const enviado = params.enviadoEm ? new Date(params.enviadoEm) : null;
  if (!capturado || Number.isNaN(capturado.getTime()) || !enviado || Number.isNaN(enviado.getTime())) {
    throw { statusCode: 400, message: 'Horário de captura do ponto offline inválido.' };
  }
  if (capturado.getTime() > enviado.getTime() + FOLGA_FUTURO_MS) {
    throw { statusCode: 400, message: 'Horário de captura posterior ao envio.' };
  }

  const desvioMs = agora.getTime() - enviado.getTime();
  const instante = new Date(capturado.getTime() + desvioMs);
  const atrasoMs = agora.getTime() - instante.getTime();

  if (atrasoMs > OFFLINE_IDADE_MAXIMA_MS) {
    throw {
      statusCode: 422,
      message: 'Ponto offline com mais de 24 horas não pode ser enviado. Registre uma justificativa de ponto.',
    };
  }

  return {
    instante,
    desvioMs,
    atrasoMs,
    revisar: atrasoMs > OFFLINE_REVISAR_ATRASO_MS || Math.abs(desvioMs) > OFFLINE_REVISAR_DESVIO_MS,
  };
}
