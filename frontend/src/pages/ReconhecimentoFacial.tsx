import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FotoFacialProtegida } from '../components/biometria/FotoFacialProtegida';
import {
  adminService,
  type BiometriaFacialAdmin,
  type DivergenciaFacialAdmin,
  type FaceStatusPonto,
} from '../services/admin.service';

type Aba = 'divergencias' | 'biometrias';

const STATUS_FACE: Record<FaceStatusPonto, { label: string; cls: string }> = {
  PENDENTE: { label: 'Verificando', cls: 'bg-viva-50 text-viva-700 border-viva-200' },
  CONFERE: { label: 'Confere', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INCERTO: { label: 'Incerto', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  DIVERGENTE: { label: 'Divergente', cls: 'bg-red-50 text-red-700 border-red-200' },
  SPOOF_SUSPEITO: { label: 'Possível foto de foto/tela', cls: 'bg-red-50 text-red-700 border-red-200' },
  SEM_ROSTO: { label: 'Rosto não detectado', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  SEM_BIOMETRIA: { label: 'Sem foto de referência', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  SEM_FOTO: { label: 'Sem foto', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  ERRO: { label: 'Falha na verificação', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const STATUS_BIOMETRIA: Record<BiometriaFacialAdmin['status'], string> = {
  PENDENTE_APROVACAO: 'Aguardando aprovação',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
};

const fmtDataHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

const fmtAtraso = (de: string, ate: string) => {
  const min = Math.max(0, Math.round((new Date(ate).getTime() - new Date(de).getTime()) / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
};

const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);

const BadgeStatus = ({ status }: { status: FaceStatusPonto | null }) => {
  if (!status) return <span className="text-[10px] text-viva-500">—</span>;
  const s = STATUS_FACE[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
};

const CardDivergencia = ({ r, onRevisado }: { r: DivergenciaFacialAdmin; onRevisado: () => void }) => {
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (decisao: 'CONFIRMADO_MEDICO' | 'FRAUDE_SUSPEITA') =>
      adminService.revisarFacePonto(r.id, decisao, obs.trim() || undefined),
    onSuccess: () => onRevisado(),
    onError: (e: any) => setErro(e.response?.data?.error || 'Não foi possível salvar a revisão.'),
  });

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-viva-900 font-display">{r.medico.nomeCompleto}</p>
          <p className="text-[11px] text-viva-600">
            {r.medico.crm ? `CRM ${r.medico.crm} · ` : ''}
            {r.escala?.nome ?? 'Ponto sem escala'}
          </p>
        </div>
        {r.faceRevisao && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              r.faceRevisao === 'CONFIRMADO_MEDICO' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {r.faceRevisao === 'CONFIRMADO_MEDICO' ? 'Confirmado: é o médico' : 'Suspeita de fraude'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FotoFacialProtegida
          tipo="biometria"
          id={r.faceBiometriaId}
          legenda={`Referência${r.biometriaStatus ? ` (${STATUS_BIOMETRIA[r.biometriaStatus].toLowerCase()})` : ''}`}
        />
        <FotoFacialProtegida tipo="checkin" id={r.temFotoCheckin ? r.id : null} legenda="Entrada" />
        <FotoFacialProtegida tipo="checkout" id={r.temFotoCheckout ? r.id : null} legenda="Saída" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-viva-700">
        <div className="rounded-lg bg-viva-50/70 border border-viva-200/60 p-2 space-y-1">
          <p className="font-semibold text-viva-800">Entrada · {fmtDataHora(r.checkInAt)}</p>
          <BadgeStatus status={r.faceStatus} />
          <p>
            Semelhança {fmtPct(r.faceSimilaridade)} · Prova de vida {fmtPct(r.faceLiveness)}
          </p>
        </div>
        <div className="rounded-lg bg-viva-50/70 border border-viva-200/60 p-2 space-y-1">
          <p className="font-semibold text-viva-800">Saída · {fmtDataHora(r.checkOutAt)}</p>
          <BadgeStatus status={r.faceCheckoutStatus} />
          <p>
            Semelhança {fmtPct(r.faceCheckoutSimilaridade)} · Prova de vida {fmtPct(r.faceCheckoutLiveness)}
          </p>
        </div>
      </div>

      {(r.offlineCheckin || r.offlineCheckout) && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-2 text-[11px] text-sky-900 space-y-0.5">
          <p className="font-semibold">
            Registrado sem internet
            {r.offlineCheckin && r.offlineCheckout ? ' (entrada e saída)' : r.offlineCheckin ? ' (entrada)' : ' (saída)'}
            {r.offlineRevisar ? ' · em revisão' : ''}
          </p>
          {r.offlineCheckin && r.checkinSincronizadoEm && (
            <p>Entrada enviada em {fmtDataHora(r.checkinSincronizadoEm)} ({fmtAtraso(r.checkInAt, r.checkinSincronizadoEm)} depois)</p>
          )}
          {r.offlineCheckout && r.checkoutSincronizadoEm && r.checkOutAt && (
            <p>Saída enviada em {fmtDataHora(r.checkoutSincronizadoEm)} ({fmtAtraso(r.checkOutAt, r.checkoutSincronizadoEm)} depois)</p>
          )}
          {r.offlineDesvioRelogioMs != null && Math.abs(r.offlineDesvioRelogioMs) >= 60_000 && (
            <p>
              Relógio do aparelho {r.offlineDesvioRelogioMs > 0 ? 'atrasado' : 'adiantado'} em{' '}
              {Math.round(Math.abs(r.offlineDesvioRelogioMs) / 60_000)} min (horário já corrigido)
            </p>
          )}
        </div>
      )}

      {r.faceRevisao ? (
        <p className="text-[11px] text-viva-600">
          Revisado em {fmtDataHora(r.faceRevisaoEm)}
          {r.faceRevisaoObs ? ` — ${r.faceRevisaoObs}` : ''}
        </p>
      ) : (
        <>
          <textarea
            className="w-full rounded-xl border border-viva-200 bg-white px-3 py-2 text-xs text-viva-900 min-h-[56px]"
            placeholder="Observação (obrigatória para suspeita de fraude)"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            maxLength={500}
          />
          {erro && <p className="text-[11px] text-red-700">{erro}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn text-xs border border-red-300 bg-white text-red-700"
              disabled={mutation.isPending}
              onClick={() => {
                setErro(null);
                if (!obs.trim()) {
                  setErro('Descreva o motivo da suspeita de fraude.');
                  return;
                }
                mutation.mutate('FRAUDE_SUSPEITA');
              }}
            >
              Suspeita de fraude
            </button>
            <button
              type="button"
              className="btn btn-primary text-xs"
              disabled={mutation.isPending}
              onClick={() => {
                setErro(null);
                mutation.mutate('CONFIRMADO_MEDICO');
              }}
            >
              {mutation.isPending ? 'Salvando…' : 'É o médico'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const CardBiometria = ({ b, onRevisado }: { b: BiometriaFacialAdmin; onRevisado: () => void }) => {
  const [motivo, setMotivo] = useState('');
  const [rejeitando, setRejeitando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (decisao: 'APROVADA' | 'REJEITADA') =>
      adminService.revisarBiometriaFacial(b.id, decisao, decisao === 'REJEITADA' ? motivo.trim() : undefined),
    onSuccess: () => onRevisado(),
    onError: (e: any) => setErro(e.response?.data?.error || 'Não foi possível salvar.'),
  });

  return (
    <div className="card space-y-3">
      <div className="grid grid-cols-[120px_1fr] gap-3 items-start">
        <FotoFacialProtegida tipo="biometria" id={b.id} legenda="Foto de referência" />
        <div className="space-y-1 text-[11px] text-viva-700">
          <p className="text-sm font-bold text-viva-900 font-display">{b.medico.nomeCompleto}</p>
          {b.medico.crm && <p>CRM {b.medico.crm}</p>}
          <p>Enviada em {fmtDataHora(b.createdAt)}</p>
          <p>Prova de vida {fmtPct(b.livenessScore)}</p>
          <p className="font-semibold text-viva-800">{STATUS_BIOMETRIA[b.status]}</p>
          {b.motivoRejeicao && <p className="text-red-700">Motivo: {b.motivoRejeicao}</p>}
        </div>
      </div>
      {b.status === 'PENDENTE_APROVACAO' && (
        <>
          {rejeitando && (
            <textarea
              className="w-full rounded-xl border border-viva-200 bg-white px-3 py-2 text-xs text-viva-900 min-h-[56px]"
              placeholder="Motivo (o médico verá esta mensagem). Ex.: rosto cortado, foto escura, outra pessoa."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
            />
          )}
          {erro && <p className="text-[11px] text-red-700">{erro}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn text-xs border border-red-300 bg-white text-red-700"
              disabled={mutation.isPending}
              onClick={() => {
                setErro(null);
                if (!rejeitando) {
                  setRejeitando(true);
                  return;
                }
                if (!motivo.trim()) {
                  setErro('Informe o motivo da rejeição.');
                  return;
                }
                mutation.mutate('REJEITADA');
              }}
            >
              {rejeitando ? 'Confirmar rejeição' : 'Rejeitar'}
            </button>
            <button
              type="button"
              className="btn btn-primary text-xs"
              disabled={mutation.isPending}
              onClick={() => {
                setErro(null);
                mutation.mutate('APROVADA');
              }}
            >
              {mutation.isPending ? 'Salvando…' : 'Aprovar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const ReconhecimentoFacial = () => {
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<Aba>('divergencias');
  const [revisados, setRevisados] = useState(false);
  const [statusBio, setStatusBio] = useState<BiometriaFacialAdmin['status']>('PENDENTE_APROVACAO');

  const divergenciasQuery = useQuery({
    queryKey: ['admin', 'divergencias-faciais', revisados],
    queryFn: () => adminService.listDivergenciasFaciais({ revisados, dias: 90 }),
    enabled: aba === 'divergencias',
  });

  const biometriasQuery = useQuery({
    queryKey: ['admin', 'biometrias-faciais', statusBio],
    queryFn: () => adminService.listBiometriasFaciais(statusBio),
    enabled: aba === 'biometrias',
  });

  const divergencias = divergenciasQuery.data?.data ?? [];
  const biometrias = biometriasQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="card dashboard-hero py-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-viva-600 mb-2 font-display">
          Ponto eletrônico
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-viva-900 font-display mb-2">Reconhecimento facial</h1>
        <p className="text-viva-700 font-serif text-sm">
          Revise os pontos em que o rosto não conferiu com a foto de referência e aprove as fotos de referência
          enviadas pelos médicos. Nenhum ponto é bloqueado automaticamente.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn text-sm ${aba === 'divergencias' ? 'btn-primary' : 'border border-viva-300 bg-white text-viva-800'}`}
          onClick={() => setAba('divergencias')}
        >
          Divergências
        </button>
        <button
          type="button"
          className={`btn text-sm ${aba === 'biometrias' ? 'btn-primary' : 'border border-viva-300 bg-white text-viva-800'}`}
          onClick={() => setAba('biometrias')}
        >
          Fotos de referência
        </button>
      </div>

      {aba === 'divergencias' ? (
        <div className="space-y-4">
          <label className="inline-flex items-center gap-2 text-xs text-viva-700">
            <input type="checkbox" checked={revisados} onChange={(e) => setRevisados(e.target.checked)} />
            Mostrar já revisados (últimos 90 dias)
          </label>
          {divergenciasQuery.isLoading ? (
            <p className="text-xs text-viva-600">Carregando…</p>
          ) : divergenciasQuery.isError ? (
            <p className="text-xs text-red-700">Não foi possível carregar as divergências.</p>
          ) : divergencias.length === 0 ? (
            <div className="card text-xs text-viva-600">Nenhuma divergência {revisados ? 'no período' : 'pendente'}.</div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {divergencias.map((r) => (
                <CardDivergencia
                  key={r.id}
                  r={r}
                  onRevisado={() => queryClient.invalidateQueries({ queryKey: ['admin', 'divergencias-faciais'] })}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <select
            className="input text-sm max-w-xs"
            value={statusBio}
            onChange={(e) => setStatusBio(e.target.value as BiometriaFacialAdmin['status'])}
          >
            <option value="PENDENTE_APROVACAO">Aguardando aprovação</option>
            <option value="APROVADA">Aprovadas</option>
            <option value="REJEITADA">Rejeitadas</option>
          </select>
          {biometriasQuery.isLoading ? (
            <p className="text-xs text-viva-600">Carregando…</p>
          ) : biometriasQuery.isError ? (
            <p className="text-xs text-red-700">Não foi possível carregar as fotos de referência.</p>
          ) : biometrias.length === 0 ? (
            <div className="card text-xs text-viva-600">Nenhuma foto nesta situação.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {biometrias.map((b) => (
                <CardBiometria
                  key={b.id}
                  b={b}
                  onRevisado={() => queryClient.invalidateQueries({ queryKey: ['admin', 'biometrias-faciais'] })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReconhecimentoFacial;
