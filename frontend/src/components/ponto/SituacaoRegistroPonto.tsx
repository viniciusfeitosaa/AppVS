export const isJustificadoSemPonto = (origem?: string | null) => origem === 'JUSTIFICADO_SEM_PONTO';

export const BadgeJustificadoSemPonto = () => (
  <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-xs font-medium">
    Sem ponto — justificado
  </span>
);

type SituacaoRegistroPontoProps = {
  origem?: string | null;
  atrasado?: boolean;
  minutosAtraso?: number | null;
};

export const SituacaoRegistroPonto = ({ origem, atrasado, minutosAtraso }: SituacaoRegistroPontoProps) => {
  if (isJustificadoSemPonto(origem)) {
    return <BadgeJustificadoSemPonto />;
  }
  if (atrasado) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
        Atrasado ({minutosAtraso ?? 0} min)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">
      No horário
    </span>
  );
};

export const situacaoRegistroPontoTexto = ({
  origem,
  atrasado,
  minutosAtraso,
}: SituacaoRegistroPontoProps) => {
  if (isJustificadoSemPonto(origem)) return 'Sem ponto — justificado';
  if (atrasado) return `Atrasado (${minutosAtraso ?? 0} min)`;
  return 'No horário';
};

export type FaceSituacao = 'CONFERE' | 'EM_ANALISE' | 'DIVERGENCIA' | 'SEM_BIOMETRIA' | null | undefined;

const FACE_BADGE: Record<string, { label: string; cls: string }> = {
  CONFERE: { label: 'Rosto reconhecido', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EM_ANALISE: { label: 'Conferindo rosto…', cls: 'bg-viva-50 text-viva-700 border-viva-200' },
  DIVERGENCIA: { label: 'Rosto não reconhecido — em revisão', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  SEM_BIOMETRIA: { label: 'Sem foto de referência', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export const BadgeFaceSituacao = ({ situacao }: { situacao: FaceSituacao }) => {
  const b = situacao ? FACE_BADGE[situacao] : null;
  if (!b) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${b.cls}`}>
      {b.label}
    </span>
  );
};

const FACE_PIOR_PRIMEIRO = ['SPOOF_SUSPEITO', 'DIVERGENTE', 'SEM_ROSTO', 'INCERTO', 'ERRO', 'PENDENTE', 'SEM_BIOMETRIA', 'CONFERE'];

const FACE_TEXTO_MASTER: Record<string, string> = {
  SPOOF_SUSPEITO: 'Possível foto de foto/tela',
  DIVERGENTE: 'Rosto divergente',
  SEM_ROSTO: 'Rosto não detectado',
  INCERTO: 'Rosto incerto',
  ERRO: 'Falha na verificação',
  PENDENTE: 'Verificando',
  SEM_BIOMETRIA: 'Sem foto de referência',
  CONFERE: 'Rosto confere',
};

/** Resumo para o Master: revisão manual prevalece; senão, o pior status entre entrada e saída. */
export const faceResumoMasterTexto = (
  faceStatus?: string | null,
  faceCheckoutStatus?: string | null,
  faceRevisao?: string | null
): string => {
  if (faceRevisao === 'CONFIRMADO_MEDICO') return 'Confirmado pela coordenação';
  if (faceRevisao === 'FRAUDE_SUSPEITA') return 'Suspeita de fraude';
  const st = [faceStatus, faceCheckoutStatus].filter((s): s is string => !!s && s !== 'SEM_FOTO');
  const pior = FACE_PIOR_PRIMEIRO.find((s) => st.includes(s));
  return pior ? FACE_TEXTO_MASTER[pior] : '—';
};
