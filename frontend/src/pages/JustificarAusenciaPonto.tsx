import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '../lib/notificationEmitter';
import {
  pontoService,
  type PlantaoElegivelJustificativa,
  type StatusJustificativaAusencia,
} from '../services/ponto.service';

const DECLARACAO =
  'Você está declarando que não bateu o ponto corretamente neste plantão.';

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

const formatTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', {
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

const statusLabel: Record<StatusJustificativaAusencia, string> = {
  PENDENTE: 'Pendente',
  ACEITA: 'Aceita',
  RECUSADA: 'Recusada',
};

const statusClass: Record<StatusJustificativaAusencia, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  ACEITA: 'bg-emerald-100 text-emerald-800',
  RECUSADA: 'bg-red-100 text-red-800',
};

const JustificarAusenciaPonto = () => {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtroSituacao, setFiltroSituacao] = useState<'TODOS' | 'NENHUM' | 'SO_ENTRADA'>('TODOS');
  const [entrada, setEntrada] = useState('');
  const [saida, setSaida] = useState('');
  const [motivo, setMotivo] = useState('');

  const elegiveisQuery = useQuery({
    queryKey: ['ponto', 'justificativas-ausencia', 'eligiveis'],
    queryFn: () => pontoService.listPlantoesElegiveisJustificativa(),
  });

  const escalasQuery = useQuery({
    queryKey: ['ponto', 'minhas-escalas'],
    queryFn: () => pontoService.listMinhasEscalas(),
  });

  const minhasQuery = useQuery({
    queryKey: ['ponto', 'justificativas-ausencia', 'minhas'],
    queryFn: () => pontoService.listMinhasJustificativas(),
  });

  const elegiveis = elegiveisQuery.data?.data ?? [];
  const minhas = minhasQuery.data?.data ?? [];

  const contagemSituacao = useMemo(() => {
    let nenhum = 0;
    let soEntrada = 0;
    for (const p of elegiveis) {
      if (p.situacaoPonto === 'SO_ENTRADA') soEntrada += 1;
      else nenhum += 1;
    }
    return { todos: elegiveis.length, nenhum, soEntrada };
  }, [elegiveis]);

  const elegiveisFiltrados = useMemo(() => {
    if (filtroSituacao === 'TODOS') return elegiveis;
    return elegiveis.filter((p) => (p.situacaoPonto ?? 'NENHUM') === filtroSituacao);
  }, [elegiveis, filtroSituacao]);

  const escalaNomeById = useMemo(() => {
    const map = new Map<string, string>();
    const raw = escalasQuery.data?.data;
    const list = Array.isArray(raw) ? raw : [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const nested =
        'escala' in item
          ? (item as { escala?: { id?: string; nome?: string } }).escala
          : null;
      const flat = item as { id?: string; nome?: string };
      const id = nested?.id ?? flat.id;
      const nome = nested?.nome ?? flat.nome;
      if (id && nome) map.set(id, nome);
    }
    return map;
  }, [escalasQuery.data]);

  const selected: PlantaoElegivelJustificativa | null = useMemo(
    () => elegiveis.find((p) => p.id === selectedId) ?? null,
    [elegiveis, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setEntrada('');
      setSaida('');
      return;
    }
    setEntrada(toDatetimeLocalValue(selected.horarioOficialInicio));
    setSaida(toDatetimeLocalValue(selected.horarioOficialFim));
    setMotivo('');
  }, [selected]);

  useEffect(() => {
    if (!selectedId) return;
    const id = window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [selectedId]);

  const criarMutation = useMutation({
    mutationFn: () =>
      pontoService.criarJustificativaAusencia({
        escalaPlantaoId: selectedId!,
        horarioAlegadoEntrada: fromDatetimeLocalValue(entrada),
        horarioAlegadoSaida: fromDatetimeLocalValue(saida),
        motivo: motivo.trim(),
      }),
    onSuccess: (resp) => {
      notify({
        kind: 'success',
        title: 'Justificativa enviada',
        message: resp.message ?? 'Pedido enviado para análise.',
        source: 'ponto',
      });
      setSelectedId(null);
      setMotivo('');
      setEntrada('');
      setSaida('');
      void queryClient.invalidateQueries({ queryKey: ['ponto', 'justificativas-ausencia'] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      notify({
        kind: 'error',
        title: 'Não foi possível enviar',
        message: msg ?? 'Tente novamente.',
        source: 'ponto',
      });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      notify({
        kind: 'warning',
        title: 'Selecione um plantão',
        message: 'Escolha um plantão elegível na lista.',
        source: 'ponto',
      });
      return;
    }
    if (!entrada || !saida) {
      notify({
        kind: 'warning',
        title: 'Horários obrigatórios',
        message: 'Informe entrada e saída alegadas.',
        source: 'ponto',
      });
      return;
    }
    if (motivo.trim().length < 10) {
      notify({
        kind: 'warning',
        title: 'Motivo curto',
        message: 'O motivo deve ter no mínimo 10 caracteres.',
        source: 'ponto',
      });
      return;
    }
    criarMutation.mutate();
  };

  const nomeEscala = (escalaId: string) => escalaNomeById.get(escalaId) ?? 'Escala';

  const labelPontoBatido = (p: PlantaoElegivelJustificativa) => {
    if (p.situacaoPonto === 'SO_ENTRADA' && p.checkInAt) {
      return `Entrada ${formatTime(p.checkInAt)} · sem saída`;
    }
    if (p.situacaoPonto === 'SO_ENTRADA') {
      return 'Só entrada · sem saída';
    }
    return 'Nenhum';
  };

  const abas: Array<{ id: typeof filtroSituacao; label: string; count: number }> = [
    { id: 'TODOS', label: 'Todos', count: contagemSituacao.todos },
    { id: 'NENHUM', label: 'Nenhum ponto', count: contagemSituacao.nenhum },
    { id: 'SO_ENTRADA', label: 'Só entrada', count: contagemSituacao.soEntrada },
  ];

  return (
    <div className="space-y-6">
      <div className="card dashboard-hero py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-viva-600 mb-2 font-display">
          Ponto eletrônico
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-viva-900 font-display leading-tight mb-2">
          Justificar ausência de ponto
        </h1>
        <p className="text-viva-700 font-serif text-base">
          Informe o plantão sem ponto completo e os horários trabalhados para análise do Master.
        </p>
      </div>

      <div className="card border-l-4 border-amber-400 bg-amber-50/40">
        <p className="text-sm font-medium text-viva-900 font-serif">{DECLARACAO}</p>
      </div>

      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-viva-900">Plantões elegíveis</h2>
          <p className="text-xs text-viva-600 mt-1">
            Sem ponto fechado no dia; pedidos pendentes ou já aceitos não aparecem.
          </p>
        </div>

        {elegiveisQuery.isLoading ? (
          <p className="text-sm text-viva-700">Carregando plantões...</p>
        ) : elegiveis.length === 0 ? (
          <p className="text-sm text-viva-700">Nenhum plantão elegível no momento.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por ponto batido">
              {abas.map((aba) => {
                const active = filtroSituacao === aba.id;
                return (
                  <button
                    key={aba.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-viva-800 text-white'
                        : 'border border-viva-200 bg-white text-viva-800 hover:bg-viva-50'
                    }`}
                    onClick={() => setFiltroSituacao(aba.id)}
                  >
                    {aba.label}
                    <span className={`ml-1.5 tabular-nums ${active ? 'text-viva-100' : 'text-viva-500'}`}>
                      {aba.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {elegiveisFiltrados.length === 0 ? (
              <p className="text-sm text-viva-700">Nenhum plantão neste filtro.</p>
            ) : (
              <div className="max-h-[min(40vh,320px)] overflow-y-auto overflow-x-auto rounded-lg border border-viva-100">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="text-left text-viva-700 border-b">
                      <th className="py-2 px-3">Data</th>
                      <th className="py-2 px-3">Escala</th>
                      <th className="py-2 px-3">Horário oficial</th>
                      <th className="py-2 px-3">Ponto batido</th>
                      <th className="py-2 px-3">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elegiveisFiltrados.map((p) => {
                      const active = p.id === selectedId;
                      return (
                        <tr
                          key={p.id}
                          className={`border-b last:border-b-0 ${active ? 'bg-viva-50/80' : ''}`}
                        >
                          <td className="py-2 px-3 text-viva-900 font-medium">{formatDate(p.data)}</td>
                          <td className="py-2 px-3 text-viva-900">{nomeEscala(p.escalaId)}</td>
                          <td className="py-2 px-3 text-viva-900">
                            {formatDateTime(p.horarioOficialInicio)} — {formatDateTime(p.horarioOficialFim)}
                          </td>
                          <td className="py-2 px-3 text-viva-900">
                            <span
                              className={
                                p.situacaoPonto === 'SO_ENTRADA'
                                  ? 'text-amber-800'
                                  : 'text-viva-700'
                              }
                            >
                              {labelPontoBatido(p)}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <button
                              type="button"
                              className={`btn text-sm ${active ? 'btn-primary' : 'border border-viva-300 bg-white text-viva-800'}`}
                              onClick={() => setSelectedId(p.id)}
                            >
                              {active ? 'Selecionado' : 'Justificar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <form
          ref={formRef}
          className="card space-y-4 scroll-mt-4 lg:scroll-mt-6"
          onSubmit={handleSubmit}
        >
          <div>
            <h2 className="text-lg font-bold text-viva-900">Formulário da justificativa</h2>
            <p className="text-xs text-viva-600 mt-1">
              {formatDate(selected.data)} · {nomeEscala(selected.escalaId)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="horarioEntrada" className="block text-sm font-semibold text-viva-800 mb-1">
                Entrada alegada
              </label>
              <input
                id="horarioEntrada"
                type="datetime-local"
                className="input w-full"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="horarioSaida" className="block text-sm font-semibold text-viva-800 mb-1">
                Saída alegada
              </label>
              <input
                id="horarioSaida"
                type="datetime-local"
                className="input w-full"
                value={saida}
                onChange={(e) => setSaida(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="motivoJustificativa" className="block text-sm font-semibold text-viva-800 mb-1">
              Motivo
            </label>
            <textarea
              id="motivoJustificativa"
              className="w-full rounded-xl border border-viva-200 bg-white px-3 py-2 text-sm text-viva-900 font-serif min-h-[96px] resize-y"
              placeholder="Descreva por que o ponto não foi batido corretamente (mín. 10 caracteres)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={2000}
              rows={4}
              required
            />
            <p className="text-[10px] text-viva-500 mt-1">{motivo.trim().length}/2000 · mínimo 10 caracteres</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 border-t border-viva-100">
            <button
              type="button"
              className="btn text-sm border border-viva-300 bg-white text-viva-800"
              onClick={() => setSelectedId(null)}
              disabled={criarMutation.isPending}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary text-sm" disabled={criarMutation.isPending}>
              {criarMutation.isPending ? 'Enviando...' : 'Enviar justificativa'}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-viva-900">Minhas justificativas</h2>
          <p className="text-xs text-viva-600 mt-1">Acompanhe o status dos pedidos enviados.</p>
        </div>

        {minhasQuery.isLoading ? (
          <p className="text-sm text-viva-700">Carregando justificativas...</p>
        ) : minhas.length === 0 ? (
          <p className="text-sm text-viva-700">Você ainda não enviou justificativas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-viva-700 border-b">
                  <th className="py-2 pr-4">Plantão</th>
                  <th className="py-2 pr-4">Escala</th>
                  <th className="py-2 pr-4">Alegado</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {minhas.map((j) => (
                  <tr key={j.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 pr-4 text-viva-900">
                      {formatDate(j.escalaPlantao?.data ?? j.horarioOficialInicio)}
                    </td>
                    <td className="py-2 pr-4 text-viva-900">{j.escala?.nome ?? nomeEscala(j.escalaId)}</td>
                    <td className="py-2 pr-4 text-viva-900">
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
                    <td className="py-2 pr-4 text-viva-900">{formatDateTime(j.createdAt)}</td>
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

export default JustificarAusenciaPonto;
