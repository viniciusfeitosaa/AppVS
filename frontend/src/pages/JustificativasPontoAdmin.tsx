import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '../lib/notificationEmitter';
import {
  adminService,
  type JustificativaAusenciaAdminItem,
  type StatusJustificativaAusenciaAdmin,
} from '../services/admin.service';

type HistoricoFiltro = 'TODAS' | 'ACEITA' | 'RECUSADA';

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toDatetimeLocalValue = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromDatetimeLocalValue = (local: string) => new Date(local).toISOString();

const statusLabel: Record<StatusJustificativaAusenciaAdmin, string> = {
  PENDENTE: 'Pendente',
  ACEITA: 'Aceita',
  RECUSADA: 'Recusada',
};

const statusClass: Record<StatusJustificativaAusenciaAdmin, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  ACEITA: 'bg-emerald-100 text-emerald-800',
  RECUSADA: 'bg-red-100 text-red-800',
};

const nomeMedico = (j: JustificativaAusenciaAdminItem) =>
  j.medico?.nomeCompleto?.trim() || 'Profissional';

const JustificativasPontoAdmin = () => {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entrada, setEntrada] = useState('');
  const [saida, setSaida] = useState('');
  const [comentario, setComentario] = useState('');
  const [historicoFiltro, setHistoricoFiltro] = useState<HistoricoFiltro>('TODAS');
  const [actionError, setActionError] = useState<string | null>(null);

  const pendentesQuery = useQuery({
    queryKey: ['admin', 'justificativas-ausencia', 'PENDENTE'],
    queryFn: async () => {
      const r = await adminService.listJustificativasAusencia({ status: 'PENDENTE' });
      return r.data ?? [];
    },
  });

  const historicoQuery = useQuery({
    queryKey: ['admin', 'justificativas-ausencia', 'historico', historicoFiltro],
    queryFn: async () => {
      if (historicoFiltro === 'TODAS') {
        const r = await adminService.listJustificativasAusencia();
        return (r.data ?? []).filter((j) => j.status === 'ACEITA' || j.status === 'RECUSADA');
      }
      const r = await adminService.listJustificativasAusencia({ status: historicoFiltro });
      return r.data ?? [];
    },
  });

  const pendentes = pendentesQuery.data ?? [];
  const historico = historicoQuery.data ?? [];
  const selected = pendentes.find((j) => j.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setEntrada('');
      setSaida('');
      setComentario('');
      return;
    }
    setEntrada(toDatetimeLocalValue(selected.horarioAlegadoEntrada));
    setSaida(toDatetimeLocalValue(selected.horarioAlegadoSaida));
    setComentario('');
    setActionError(null);
  }, [selected]);

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'justificativas-ausencia'] });
  };

  const aceitarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Nenhuma justificativa selecionada');
      if (!entrada || !saida) throw new Error('Informe entrada e saída alegadas');
      return adminService.aceitarJustificativaAusencia(selectedId, {
        horarioAlegadoEntrada: fromDatetimeLocalValue(entrada),
        horarioAlegadoSaida: fromDatetimeLocalValue(saida),
      });
    },
    onSuccess: async (res) => {
      setActionError(null);
      setSelectedId(null);
      notify({
        kind: 'success',
        title: 'Justificativa aceita',
        message: res.message || 'Registro de ponto justificado criado.',
        source: 'ponto',
      });
      await invalidateAll();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setActionError(err.response?.data?.error || err.message || 'Não foi possível aceitar.');
    },
  });

  const recusarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Nenhuma justificativa selecionada');
      const c = comentario.trim();
      return adminService.recusarJustificativaAusencia(
        selectedId,
        c ? { comentario: c } : {}
      );
    },
    onSuccess: async (res) => {
      setActionError(null);
      setSelectedId(null);
      notify({
        kind: 'info',
        title: 'Justificativa recusada',
        message: res.message || 'O profissional será notificado.',
        source: 'ponto',
      });
      await invalidateAll();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setActionError(err.response?.data?.error || err.message || 'Não foi possível recusar.');
    },
  });

  const busy = aceitarMutation.isPending || recusarMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-viva-600 mb-2 font-display">
          Administração
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-viva-900 font-display leading-tight mb-2">
          Justificativas de ponto
        </h1>
        <p className="text-viva-700 font-serif text-base">
          Analise pedidos de ausência de ponto: ajuste horários alegados, aceite ou recuse.
        </p>
      </div>

      {actionError && (
        <div className="card border-l-4 border-red-400 bg-red-50/50 p-4">
          <p className="text-xs text-red-700 font-medium">{actionError}</p>
        </div>
      )}

      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-viva-900">Pendentes</h2>
          <p className="text-xs text-viva-600 mt-1">
            Selecione um pedido para revisar horários alegados e decidir.
          </p>
        </div>

        {pendentesQuery.isLoading ? (
          <p className="text-sm text-viva-700">Carregando pendentes...</p>
        ) : pendentes.length === 0 ? (
          <p className="text-sm text-viva-700">Nenhuma justificativa pendente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-viva-700 border-b">
                  <th className="py-2 pr-4">Médico</th>
                  <th className="py-2 pr-4">Plantão</th>
                  <th className="py-2 pr-4">Oficial</th>
                  <th className="py-2 pr-4">Alegado</th>
                  <th className="py-2 pr-4">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map((j) => {
                  const active = j.id === selectedId;
                  return (
                    <tr
                      key={j.id}
                      className={`border-b last:border-b-0 align-top cursor-pointer ${
                        active ? 'bg-viva-50' : 'hover:bg-viva-50/60'
                      }`}
                      onClick={() => setSelectedId(j.id)}
                    >
                      <td className="py-2 pr-4 text-viva-900">
                        <span className="font-medium">{nomeMedico(j)}</span>
                        {j.medico?.crm ? (
                          <span className="block text-xs text-viva-600">CRM {j.medico.crm}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-viva-900">
                        {formatDate(j.escalaPlantao?.data ?? j.horarioOficialInicio)}
                        <span className="block text-xs text-viva-600">
                          {j.escala?.nome ?? 'Escala'}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-viva-900 whitespace-nowrap">
                        {formatDateTime(j.horarioOficialInicio)}
                        <span className="block text-xs text-viva-600">
                          até {formatDateTime(j.horarioOficialFim)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-viva-900 whitespace-nowrap">
                        {formatDateTime(j.horarioAlegadoEntrada)}
                        <span className="block text-xs text-viva-600">
                          até {formatDateTime(j.horarioAlegadoSaida)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-viva-900 max-w-xs">
                        <p className="line-clamp-3 font-serif text-xs">{j.motivo}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-bold text-viva-900">Decisão</h2>
            <p className="text-xs text-viva-600 mt-1">
              {nomeMedico(selected)} · {formatDate(selected.escalaPlantao?.data ?? selected.horarioOficialInicio)} ·{' '}
              {selected.escala?.nome ?? 'Escala'}
            </p>
          </div>

          <div className="rounded-xl border border-viva-100 bg-viva-50/40 p-3 text-xs text-viva-700 space-y-1">
            <p>
              <span className="font-semibold text-viva-800">Oficial:</span>{' '}
              {formatDateTime(selected.horarioOficialInicio)} — {formatDateTime(selected.horarioOficialFim)}
            </p>
            <p className="font-serif whitespace-pre-wrap">
              <span className="font-semibold text-viva-800 font-sans">Motivo:</span> {selected.motivo}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="adminEntradaAlegada" className="block text-sm font-semibold text-viva-800 mb-1">
                Entrada alegada
              </label>
              <input
                id="adminEntradaAlegada"
                type="datetime-local"
                className="input w-full"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor="adminSaidaAlegada" className="block text-sm font-semibold text-viva-800 mb-1">
                Saída alegada
              </label>
              <input
                id="adminSaidaAlegada"
                type="datetime-local"
                className="input w-full"
                value={saida}
                onChange={(e) => setSaida(e.target.value)}
                required
                disabled={busy}
              />
            </div>
          </div>

          <div>
            <label htmlFor="comentarioRecusa" className="block text-sm font-semibold text-viva-800 mb-1">
              Comentário (recusa)
            </label>
            <textarea
              id="comentarioRecusa"
              className="w-full rounded-xl border border-viva-200 bg-white px-3 py-2 text-sm text-viva-900 font-serif min-h-[80px] resize-y"
              placeholder="Opcional ao recusar — visível para o profissional"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={2000}
              rows={3}
              disabled={busy}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 border-t border-viva-100">
            <button
              type="button"
              className="btn text-sm border border-viva-300 bg-white text-viva-800"
              onClick={() => setSelectedId(null)}
              disabled={busy}
            >
              Fechar
            </button>
            <button
              type="button"
              className="btn text-sm border border-red-300 bg-red-50 text-red-800"
              onClick={() => recusarMutation.mutate()}
              disabled={busy}
            >
              {recusarMutation.isPending ? 'Recusando...' : 'Recusar'}
            </button>
            <button
              type="button"
              className="btn btn-primary text-sm"
              onClick={() => aceitarMutation.mutate()}
              disabled={busy || !entrada || !saida}
            >
              {aceitarMutation.isPending ? 'Aceitando...' : 'Aceitar'}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-viva-900">Histórico</h2>
            <p className="text-xs text-viva-600 mt-1">Justificativas aceitas ou recusadas.</p>
          </div>
          <div>
            <label htmlFor="filtroHistorico" className="block text-xs font-semibold text-viva-800 mb-1">
              Filtrar status
            </label>
            <select
              id="filtroHistorico"
              className="rounded-xl border border-viva-200 bg-white px-3 py-2 text-sm"
              value={historicoFiltro}
              onChange={(e) => setHistoricoFiltro(e.target.value as HistoricoFiltro)}
            >
              <option value="TODAS">Aceitas e recusadas</option>
              <option value="ACEITA">Somente aceitas</option>
              <option value="RECUSADA">Somente recusadas</option>
            </select>
          </div>
        </div>

        {historicoQuery.isLoading ? (
          <p className="text-sm text-viva-700">Carregando histórico...</p>
        ) : historico.length === 0 ? (
          <p className="text-sm text-viva-700">Nenhum registro no histórico com este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-viva-700 border-b">
                  <th className="py-2 pr-4">Médico</th>
                  <th className="py-2 pr-4">Plantão</th>
                  <th className="py-2 pr-4">Alegado</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Decidido em</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((j) => (
                  <tr key={j.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 pr-4 text-viva-900">{nomeMedico(j)}</td>
                    <td className="py-2 pr-4 text-viva-900">
                      {formatDate(j.escalaPlantao?.data ?? j.horarioOficialInicio)}
                      <span className="block text-xs text-viva-600">{j.escala?.nome ?? 'Escala'}</span>
                    </td>
                    <td className="py-2 pr-4 text-viva-900 whitespace-nowrap">
                      {formatDateTime(j.horarioAlegadoEntrada)} — {formatDateTime(j.horarioAlegadoSaida)}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[j.status]}`}
                      >
                        {statusLabel[j.status]}
                      </span>
                      {j.status === 'RECUSADA' && j.comentarioMaster ? (
                        <p className="text-xs text-viva-600 mt-1 font-serif">{j.comentarioMaster}</p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-viva-900">{formatDateTime(j.decididoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default JustificativasPontoAdmin;
