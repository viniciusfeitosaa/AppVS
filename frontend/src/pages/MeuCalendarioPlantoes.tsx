import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { notify } from '../lib/notificationEmitter';
import { pontoService } from '../services/ponto.service';
import { fixMojibake } from '../utils/validation.util';

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const gradeShort = (g: string) => ((g || '').toLowerCase() === 'sn' ? 'SN' : 'MT');

const faixaGrade = (g: string) => ((g || '').toLowerCase() === 'sn' ? '19h–07h' : '07h–19h');

/** MT vs SN na mesma família viva, com leve contraste entre turnos. */
const plantaoChipClasses = (g: string) => {
  const sn = (g || '').toLowerCase() === 'sn';
  return sn
    ? 'bg-viva-200/60 text-viva-950 border-viva-400/50'
    : 'bg-viva-100/95 text-viva-900 border-viva-200/80';
};

const HORARIOS_POR_GRADE: Record<string, string> = {
  mt: '07h às 19h',
  sn: '19h às 07h',
};

const MINUTOS_ANTES_INICIO_PARA_TROCA = 10;

function inicioDoPlantao(dataStr: string, gradeId: string): Date {
  const d = new Date(dataStr + 'T00:00:00');
  const g = (gradeId || '').toLowerCase();
  if (g === 'sn') {
    d.setHours(19, 0, 0, 0);
    return d;
  }
  d.setHours(7, 0, 0, 0);
  return d;
}

function fimDoPlantao(dataStr: string, gradeId: string): Date {
  const d = new Date(dataStr + 'T00:00:00');
  const g = (gradeId || '').toLowerCase();
  if (g === 'sn') {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    next.setHours(7, 0, 0, 0);
    return next;
  }
  d.setHours(19, 0, 0, 0);
  return d;
}

function canTrocarPlantao(dataStr: string, gradeId: string): boolean {
  const now = new Date();
  const inicio = inicioDoPlantao(dataStr, gradeId);
  const limite = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_TROCA * 60 * 1000);
  return now < limite;
}

function isPlantaoAindaFuturo(dataStr: string, gradeId: string): boolean {
  const now = new Date();
  const fim = fimDoPlantao(dataStr, gradeId);
  return now < fim;
}

const faixaPorGrade = (gradeId: string) =>
  HORARIOS_POR_GRADE[(gradeId || '').toLowerCase()] ?? '07h às 19h';

function labelDiaCompleto(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

type PlantaoCal = {
  id: string;
  data: string;
  gradeId: string;
  escalaId: string;
  escalaNome: string | null;
  permiteTrocaPlantao?: boolean;
};

const MeuCalendarioPlantoes = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMedico = user?.role === 'MEDICO';
  const [view, setView] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });

  const { data: equipesResp } = useQuery({
    queryKey: ['ponto', 'equipes-calendario'],
    queryFn: () => pontoService.listMinhasEquipesCalendario(),
    enabled: isMedico,
  });
  const equipes = equipesResp?.data ?? [];

  // null = mostrar todas as equipes
  const [selectedEquipeIds, setSelectedEquipeIds] = useState<string[] | null>(null);
  useEffect(() => {
    // Se o usuário abrir a tela e ainda não escolheu explicitamente, mantemos "todas".
    // Ao mesmo tempo, se o backend retornar 0 equipes, deixamos seleção explícita vazia.
    if (equipes.length === 0 && selectedEquipeIds === null) {
      setSelectedEquipeIds([]);
    }
  }, [equipes.length, selectedEquipeIds]);

  const equipeKey = selectedEquipeIds === null ? 'all' : [...selectedEquipeIds].sort().join(',');

  const { data, isLoading } = useQuery({
    queryKey: ['ponto', 'meus-plantoes-calendario', view.ano, view.mes, equipeKey],
    queryFn: () =>
      pontoService.listMeusPlantoesCalendario(view.ano, view.mes, selectedEquipeIds === null ? undefined : selectedEquipeIds),
    enabled: isMedico,
  });

  const plantoes = (data?.data ?? []) as PlantaoCal[];
  const byDay = useMemo(() => {
    const m = new Map<string, PlantaoCal[]>();
    for (const p of plantoes) {
      const k = p.data.slice(0, 10);
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return m;
  }, [plantoes]);

  const { gridDays, monthLabel } = useMemo(() => {
    const { ano, mes } = view;
    const first = new Date(ano, mes - 1, 1);
    const last = new Date(ano, mes, 0);
    const daysInMonth = last.getDate();
    const startWeekday = first.getDay();
    const cells: { day: number | null; key: string }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, key: `pad-${ano}-${mes}-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dk = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, key: dk });
    }
    const label = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { gridDays: cells, monthLabel: label };
  }, [view]);

  const toggleEquipeChip = (equipeId: string) => {
    const allIds = equipes.map((e: any) => e.id).filter(Boolean) as string[];

    if (selectedEquipeIds === null) {
      // quando está em "todas", um toque mostra só a equipe clicada (mais previsível no celular)
      setSelectedEquipeIds([equipeId]);
      return;
    }

    const has = selectedEquipeIds.includes(equipeId);
    const next = has ? selectedEquipeIds.filter((id) => id !== equipeId) : [...selectedEquipeIds, equipeId];

    // Sem seleção explícita útil: volta para "Todas" em vez de ficar sem filtro (evita mismatch UI/API).
    if (next.length === 0) {
      setSelectedEquipeIds(null);
      return;
    }

    if (next.length === allIds.length) {
      setSelectedEquipeIds(null); // voltou para "todas"
      return;
    }

    setSelectedEquipeIds(next);
  };

  const [dayModalKey, setDayModalKey] = useState<string | null>(null);
  const [showTrocaModal, setShowTrocaModal] = useState(false);
  const [trocaEscalaId, setTrocaEscalaId] = useState<string | null>(null);
  const [trocaPlantaoId, setTrocaPlantaoId] = useState<string | null>(null);
  const [trocaStep, setTrocaStep] = useState<1 | 2>(1);
  const [selectedColegaId, setSelectedColegaId] = useState<string | null>(null);

  const resetTrocaModal = () => {
    setShowTrocaModal(false);
    setTrocaStep(1);
    setSelectedColegaId(null);
    setTrocaEscalaId(null);
    setTrocaPlantaoId(null);
  };

  const abrirTrocaParaPlantao = (p: PlantaoCal) => {
    setDayModalKey(null);
    setTrocaEscalaId(p.escalaId);
    setTrocaPlantaoId(p.id);
    setShowTrocaModal(true);
    setTrocaStep(1);
    setSelectedColegaId(null);
  };

  const trocaMutation = useMutation({
    mutationFn: () =>
      pontoService.solicitarTrocaPlantao({
        plantaoId: trocaPlantaoId!,
        medicoDestinoId: selectedColegaId!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medico', 'notificacoes'] });
      queryClient.invalidateQueries({ queryKey: ['ponto', 'proximos-plantoes'] });
      queryClient.invalidateQueries({ queryKey: ['ponto', 'meus-plantoes-calendario'] });
      resetTrocaModal();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      notify({
        kind: 'error',
        title: 'Não foi possível',
        message: msg ?? 'Tente novamente.',
        source: 'ponto',
      });
    },
  });

  const { data: colegasResp } = useQuery({
    queryKey: ['ponto', 'equipe-colegas', trocaEscalaId],
    queryFn: () => pontoService.listEquipeColegas(trocaEscalaId!),
    enabled: !!user && isMedico && showTrocaModal && !!trocaEscalaId,
  });
  const colegasList = (colegasResp?.data ?? colegasResp ?? []) as Array<{
    id: string;
    nomeCompleto: string;
    crm?: string | null;
  }>;
  const selectedColega = selectedColegaId ? colegasList.find((c) => c.id === selectedColegaId) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showTrocaModal) {
        setShowTrocaModal(false);
        setTrocaStep(1);
        setSelectedColegaId(null);
        setTrocaEscalaId(null);
        setTrocaPlantaoId(null);
      } else if (dayModalKey) {
        setDayModalKey(null);
      }
    };
    if (dayModalKey || showTrocaModal) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [dayModalKey, showTrocaModal]);

  useEffect(() => {
    setDayModalKey(null);
  }, [view.ano, view.mes]);

  const prevMonth = () => {
    setView((v) => {
      let { ano, mes } = v;
      mes -= 1;
      if (mes < 1) {
        mes = 12;
        ano -= 1;
      }
      return { ano, mes };
    });
  };

  const nextMonth = () => {
    setView((v) => {
      let { ano, mes } = v;
      mes += 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
      return { ano, mes };
    });
  };

  if (!isMedico) {
    return (
      <div className="card border-l-4 border-amber-500">
        <p className="text-sm text-viva-800 font-serif">Esta área é para profissionais.</p>
        <Link to="/dashboard" className="btn btn-secondary text-sm mt-3 inline-block">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-1 sm:px-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-viva-600 font-display">Escala</p>
        <h1 className="text-xl md:text-2xl font-bold text-viva-900 font-display tracking-tight">
          Calendário de plantões
        </h1>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-[var(--app-border)] bg-gradient-to-br from-white via-viva-50/35 to-white p-4 shadow-[var(--card-shadow)] sm:p-6 stagger-1">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-viva-200/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-viva-100/40 blur-2xl"
        />

        <div className="relative">
          <div className="mb-5 border-b border-viva-200/60 pb-5">
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-viva-600 font-display">
              Equipes para visualizar
            </h2>
            {equipes.length === 0 ? (
              <p className="text-xs text-viva-600 font-serif">Nenhuma equipe vinculada para filtrar.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedEquipeIds(null)}
                  className={`min-h-[32px] rounded-xl border px-2.5 py-1 text-[10px] font-semibold leading-none transition font-display active:scale-[0.98] ${
                    selectedEquipeIds === null
                      ? 'border-viva-800 bg-viva-900 text-white shadow-sm'
                      : 'border-viva-200 bg-white/90 text-viva-600 hover:border-viva-300 hover:bg-viva-50 hover:text-viva-800'
                  }`}
                >
                  Todas
                </button>
                {equipes.map((e: any) => {
                  const active =
                    selectedEquipeIds === null ? true : selectedEquipeIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEquipeChip(e.id)}
                      className={`min-h-[32px] max-w-full rounded-xl border px-2.5 py-1 text-[10px] font-semibold leading-snug transition font-display active:scale-[0.98] ${
                        active
                          ? 'border-viva-800 bg-viva-900 text-white shadow-sm'
                          : 'border-viva-200 bg-white/90 text-viva-700 hover:border-viva-300 hover:bg-viva-50'
                      }`}
                    >
                      {fixMojibake(e.nome)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mb-4 flex items-center gap-2 sm:mb-5 sm:gap-3">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-viva-500 transition hover:bg-viva-50 hover:text-viva-900"
              aria-label="Mês anterior"
            >
              <span aria-hidden>←</span>
            </button>
            <h2 className="min-w-0 flex-1 text-center text-sm font-medium capitalize tracking-tight text-viva-900 sm:text-base">
              {monthLabel}
            </h2>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-viva-500 transition hover:bg-viva-50 hover:text-viva-900"
              aria-label="Próximo mês"
            >
              <span aria-hidden>→</span>
            </button>
          </div>

          {isLoading ? (
            <p className="py-14 text-center text-sm text-viva-600 font-serif">Carregando calendário…</p>
          ) : (
            <>
              <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0">
                <div className="min-w-[min(100%,36rem)] sm:min-w-0">
                  <div className="grid grid-cols-7 gap-px text-center text-[9px] font-semibold uppercase tracking-wider text-viva-600 sm:gap-1 sm:text-[10px] sm:tracking-wide">
                    {WEEK_DAYS.map((d) => (
                      <div key={d} className="rounded-md bg-viva-100/70 py-1.5 text-viva-800 sm:py-2">
                        <span className="sm:hidden">{d.slice(0, 1)}</span>
                        <span className="hidden sm:inline">{d}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-px sm:mt-2 sm:gap-1">
                    {gridDays.map((cell) => {
                      if (cell.day === null) {
                        return (
                          <div
                            key={cell.key}
                            className="min-h-[58px] rounded-md bg-viva-50/50 min-w-0 sm:min-h-[84px] sm:rounded-lg"
                          />
                        );
                      }
                      const list = byDay.get(cell.key) ?? [];
                      const t = new Date();
                      const isToday =
                        t.getFullYear() === view.ano &&
                        t.getMonth() + 1 === view.mes &&
                        t.getDate() === cell.day;
                      return (
                        <button
                          type="button"
                          key={cell.key}
                          onClick={() => setDayModalKey(cell.key)}
                          className={`text-left min-h-[58px] rounded-md border p-0.5 flex flex-col gap-0.5 min-w-0 transition sm:min-h-[84px] sm:rounded-lg sm:p-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-viva-400/60 focus:ring-offset-1 ${
                            isToday
                              ? 'border-viva-500 bg-viva-50/90 ring-1 ring-viva-300/50'
                              : 'border-viva-200/70 bg-white hover:border-viva-300/80 hover:bg-viva-50/30'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold tabular-nums shrink-0 sm:text-[11px] ${
                              isToday ? 'text-viva-900' : 'text-viva-600'
                            }`}
                          >
                            {cell.day}
                          </span>
                          <div className="flex flex-col gap-0.5 mt-auto overflow-hidden min-h-0">
                            {list.map((p) => (
                              <span
                                key={p.id}
                                title={`${fixMojibake(p.escalaNome || 'Escala')} · ${faixaGrade(p.gradeId)}`}
                                className={`truncate rounded px-0.5 py-0.5 text-[8px] font-semibold leading-tight border sm:px-1 sm:text-[9px] ${plantaoChipClasses(p.gradeId)}`}
                              >
                                {gradeShort(p.gradeId)} · {fixMojibake(p.escalaNome || '—')}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {plantoes.length === 0 && (
                <p className="mt-4 text-center text-xs text-viva-600 font-serif">
                  Nenhum plantão seu neste mês nesta visualização.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {dayModalKey && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDayModalKey(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dia-plantao-titulo"
          >
            <h3 id="dia-plantao-titulo" className="text-lg font-semibold text-viva-900 font-display capitalize">
              {labelDiaCompleto(dayModalKey)}
            </h3>
            {(byDay.get(dayModalKey) ?? []).length === 0 ? (
              <p className="text-sm text-viva-600 font-serif">Nenhum plantão seu neste dia.</p>
            ) : (
              <ul className="space-y-3">
                {(byDay.get(dayModalKey) ?? []).map((p) => {
                  const podeContrato = p.permiteTrocaPlantao !== false;
                  const noPrazo = canTrocarPlantao(p.data, p.gradeId);
                  const mostrarTrocar = podeContrato && noPrazo;
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl border border-viva-200/80 bg-viva-50/40 p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-viva-900">{fixMojibake(p.escalaNome || 'Escala')}</p>
                        <p className="text-xs text-viva-600 mt-1">
                          {gradeShort(p.gradeId)} · {faixaPorGrade(p.gradeId)}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-1">
                        {mostrarTrocar ? (
                          <button
                            type="button"
                            className="btn btn-secondary text-sm"
                            onClick={() => abrirTrocaParaPlantao(p)}
                          >
                            Trocar plantão
                          </button>
                        ) : (
                          <span className="text-xs text-viva-600 text-right sm:max-w-[11rem]">
                            {!podeContrato
                              ? 'Troca não habilitada neste contrato.'
                              : isPlantaoAindaFuturo(p.data, p.gradeId)
                                ? 'Período de troca encerrado'
                                : 'Plantão já passou'}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex justify-end pt-1">
              <button type="button" className="btn btn-secondary" onClick={() => setDayModalKey(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrocaModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50" onClick={resetTrocaModal}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-viva-900 font-display">
              {trocaStep === 1 ? 'Trocar plantão' : 'Confirmar troca'}
            </h3>
            {trocaStep === 1 ? (
              <>
                <p className="text-sm text-viva-700">Com qual profissional da equipe você deseja trocar?</p>
                <select
                  value={selectedColegaId ?? ''}
                  onChange={(e) => setSelectedColegaId(e.target.value || null)}
                  className="input w-full py-2"
                >
                  <option value="">Selecione um profissional</option>
                  {colegasList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {fixMojibake(c.nomeCompleto)}
                      {c.crm ? ` — ${c.crm}` : ''}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn btn-secondary" onClick={resetTrocaModal}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!selectedColegaId}
                    onClick={() => setTrocaStep(2)}
                  >
                    Confirmar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-viva-700">
                  Deseja confirmar a troca de plantão com{' '}
                  <strong>{selectedColega ? fixMojibake(selectedColega.nomeCompleto) : '—'}?</strong>
                </p>
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn btn-secondary" onClick={() => setTrocaStep(1)}>
                    Voltar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={trocaMutation.isPending || !trocaPlantaoId || !selectedColegaId}
                    onClick={() => trocaMutation.mutate()}
                  >
                    {trocaMutation.isPending ? 'Enviando…' : 'Confirmar troca'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeuCalendarioPlantoes;
