import type { FaceVerifyResult } from '../services/face-client.service';

export type FaceStatusDecidido = 'CONFERE' | 'INCERTO' | 'DIVERGENTE' | 'SPOOF_SUSPEITO' | 'SEM_ROSTO';

export interface FaceLimiares {
  match: number;
  review: number;
  liveness: number;
}

/** Status que entram na fila de revisão do Master. */
export const FACE_STATUS_REVISAO = ['INCERTO', 'DIVERGENTE', 'SPOOF_SUSPEITO', 'SEM_ROSTO', 'ERRO'] as const;

export function decidirFaceStatus(
  r: Pick<FaceVerifyResult, 'faces' | 'similarity' | 'liveness'>,
  limiares: FaceLimiares
): FaceStatusDecidido {
  if (r.faces !== 1 || r.similarity == null) return 'SEM_ROSTO';
  const live = r.liveness?.score;
  if (live != null && live < limiares.liveness) return 'SPOOF_SUSPEITO';
  if (r.similarity >= limiares.match) return 'CONFERE';
  if (r.similarity >= limiares.review) return 'INCERTO';
  return 'DIVERGENTE';
}

export type FaceSituacaoMedico = 'CONFERE' | 'EM_ANALISE' | 'DIVERGENCIA' | 'SEM_BIOMETRIA' | null;

/** Selo mostrado ao médico (sem scores); pior caso entre check-in e checkout. */
export function situacaoFaceParaMedico(
  checkin: string | null | undefined,
  checkout: string | null | undefined,
  revisao: string | null | undefined
): FaceSituacaoMedico {
  const st = [checkin, checkout].filter((s): s is string => !!s && s !== 'SEM_FOTO');
  if (st.length === 0) return null;
  if (revisao === 'CONFIRMADO_MEDICO') return 'CONFERE';
  if (revisao === 'FRAUDE_SUSPEITA') return 'DIVERGENCIA';
  if (st.some((s) => ['INCERTO', 'DIVERGENTE', 'SPOOF_SUSPEITO', 'SEM_ROSTO'].includes(s))) return 'DIVERGENCIA';
  if (st.some((s) => s === 'PENDENTE' || s === 'ERRO')) return 'EM_ANALISE';
  if (st.some((s) => s === 'SEM_BIOMETRIA')) return 'SEM_BIOMETRIA';
  return 'CONFERE';
}

const MOTIVOS_CADASTRO: Record<string, string> = {
  NENHUM_ROSTO: 'Não encontramos um rosto na foto. Centralize o rosto na moldura e tente novamente.',
  MULTIPLOS_ROSTOS: 'Apareceu mais de uma pessoa na foto. Fique sozinho(a) no enquadramento.',
  ROSTO_PEQUENO: 'Seu rosto ficou pequeno na foto. Aproxime o celular.',
  FOTO_ESCURA: 'A foto ficou escura. Procure um lugar mais iluminado.',
  FOTO_CLARA_DEMAIS: 'A foto ficou clara demais. Evite luz forte atrás ou de frente para a câmera.',
  FOTO_BORRADA: 'A foto ficou borrada. Segure o celular firme e tente de novo.',
  SPOOF_SUSPEITO: 'A foto parece ter sido tirada de uma tela ou papel. Use a câmera frontal com seu rosto real.',
};

export function mensagemMotivoCadastroFace(motivo: string | null | undefined): string {
  return (motivo && MOTIVOS_CADASTRO[motivo]) || 'Não foi possível usar esta foto. Tente novamente com boa luz e o rosto centralizado.';
}
