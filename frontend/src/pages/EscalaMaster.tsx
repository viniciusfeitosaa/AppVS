import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useMasterEscopo } from '../context/MasterEscopoContext';
import {
  adminService,
  type EscalaPlantao,
  type Equipe,
  type TipoPlantaoConfig,
} from '../services/admin.service';

type GradeColDef = {
  id: string;
  label: string;
  horario: string;
  tipo: string;
  regua: [string, string];
};

const FALLBACK_GRADES: GradeColDef[] = [
  { id: 'mt', label: 'MT', horario: '07-19', tipo: 'Diurno', regua: ['07:00', '19:00'] },
  { id: 'sn', label: 'SN', horario: '19-07', tipo: 'Noturno', regua: ['19:00', '07:00'] },
];

const MAX_AVATARS = 3;

function dateToInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function tipoPlantaoToGradeCol(t: TipoPlantaoConfig): GradeColDef {
  return {
    id: t.id,
    label: t.nome.length > 12 ? `${t.nome.slice(0, 10)}…` : t.nome,
    horario: `${t.horaInicio.slice(0, 5)}-${t.horaFim.slice(0, 5)}`,
    tipo: t.nome,
    regua: [t.horaInicio.slice(0, 5), t.horaFim.slice(0, 5)] as [string, string],
  };
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

type PlantaoSlot = {
  plantaoId: string;
  medico: EscalaPlantao['medico'];
};

const EscalaMaster = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';
  const {
    contratoId,
    subgrupoId,
    setContratoId,
    setSubgrupoId,
    setEquipeId,
  } = useMasterEscopo();

  const [gradeMonthStart, setGradeMonthStart] = useState(() => startOfMonth(new Date()));
  const [buscaEquipe, setBuscaEquipe] = useState('');

  const gradeMonthEnd = useMemo(() => endOfMonth(gradeMonthStart), [gradeMonthStart]);
  const dataInicio = dateToInput(gradeMonthStart);
  const dataFim = dateToInput(gradeMonthEnd);

  const { data: contratosResp } = useQuery({
    queryKey: ['admin', 'contratos-ativos', 'escala-master'],
    queryFn: () => adminService.listContratosAtivos({ page: 1, limit: 200 }),
    enabled: isMaster,
  });

  const { data: subgruposResp } = useQuery({
    queryKey: ['admin', 'subgrupos', 'escala-master'],
    queryFn: () => adminService.listSubgrupos(),
    enabled: isMaster,
  });

  const { data: equipesResp, isFetching: loadingEquipes } = useQuery({
    queryKey: ['admin', 'equipes', subgrupoId || 'none', 'escala-master'],
    queryFn: () => adminService.listEquipes({ subgrupoId }),
    enabled: isMaster && !!subgrupoId,
  });

  const { data: tiposResp } = useQuery({
    queryKey: ['admin', 'tipos-plantao', contratoId, 'escala-master'],
    queryFn: () => adminService.listTiposPlantao(contratoId),
    enabled: isMaster && !!contratoId,
  });

  const contratos = useMemo(() => contratosResp?.data ?? [], [contratosResp]);
  const subgrupos = useMemo(() => subgruposResp?.data ?? [], [subgruposResp]);

  const subgruposDoContrato = useMemo(() => {
    if (!contratoId) return [];
    return subgrupos.filter(
      (s) =>
        s.usaEscala !== false &&
        (s.contratoSubgrupos ?? []).some((cs) => cs.contratoAtivo?.id === contratoId)
    );
  }, [subgrupos, contratoId]);

  useEffect(() => {
    if (!contratoId || !subgrupoId) return;
    if (subgrupos.length === 0) return;
    const ok = subgruposDoContrato.some((s) => s.id === subgrupoId);
    if (!ok) {
      setSubgrupoId('');
      setEquipeId('');
    }
  }, [contratoId, subgrupoId, subgrupos, subgruposDoContrato, setSubgrupoId, setEquipeId]);

  const equipes = useMemo((): Equipe[] => {
    const list = equipesResp?.data ?? [];
    return list
      .filter((e) => e.ativo !== false)
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [equipesResp]);

  const equipesFiltradas = useMemo(() => {
    const q = buscaEquipe.trim().toLowerCase();
    if (!q) return equipes;
    return equipes.filter((e) => e.nome.toLowerCase().includes(q));
  }, [equipes, buscaEquipe]);

  const plantaoQueries = useQueries({
    queries: equipes.map((eq) => ({
      queryKey: ['admin', 'equipes', eq.id, 'plantoes-month', dataInicio, dataFim, 'escala-master'],
      queryFn: () => adminService.listEquipePlantoes(eq.id, { dataInicio, dataFim }),
      enabled: isMaster && !!subgrupoId && equipes.length > 0,
    })),
  });

  const loadingPlantoes = plantaoQueries.some((q) => q.isFetching || q.isLoading);

  const allPlantoesByEquipe = useMemo(() => {
    const map = new Map<string, EscalaPlantao[]>();
    equipes.forEach((eq, i) => {
      map.set(eq.id, plantaoQueries[i]?.data?.data ?? []);
    });
    return map;
  }, [equipes, plantaoQueries]);

  const gradesForGrid = useMemo((): GradeColDef[] => {
    const tipos = tiposResp?.data ?? [];
    if (tipos.length > 0) {
      return tipos.map(tipoPlantaoToGradeCol);
    }
    const byId = new Map<string, GradeColDef>();
    for (const fg of FALLBACK_GRADES) byId.set(fg.id, { ...fg });
    for (const plantoes of allPlantoesByEquipe.values()) {
      for (const p of plantoes) {
        const gid = String(p.gradeId);
        if (byId.has(gid)) continue;
        const low = gid.toLowerCase();
        const fb = low === 'mt' || low === 'sn' ? FALLBACK_GRADES.find((g) => g.id === low) : undefined;
        if (fb) {
          byId.set(gid, { ...fb, id: gid });
        } else {
          byId.set(gid, {
            id: gid,
            label: gid.length > 10 ? `${gid.slice(0, 8)}…` : gid,
            horario: '—',
            tipo: 'Turno',
            regua: ['—', '—'] as [string, string],
          });
        }
      }
    }
    return Array.from(byId.values());
  }, [tiposResp?.data, allPlantoesByEquipe]);

  /** chave: equipeId_YYYY-MM-DD_gradeId → slots */
  const plantaoMap = useMemo(() => {
    const map = new Map<string, PlantaoSlot[]>();
    for (const [equipeId, plantoes] of allPlantoesByEquipe.entries()) {
      for (const p of plantoes) {
        if (!p.medico?.id) continue;
        const dateStr = String(p.data).slice(0, 10);
        const key = `${equipeId}_${dateStr}_${p.gradeId}`;
        const list = map.get(key) ?? [];
        if (!list.some((s) => s.medico.id === p.medico.id)) {
          list.push({ plantaoId: p.id, medico: p.medico });
        }
        map.set(key, list);
      }
    }
    return map;
  }, [allPlantoesByEquipe]);

  const subgrupoNome = useMemo(
    () => subgrupos.find((s) => s.id === subgrupoId)?.nome ?? 'Subgrupo',
    [subgrupos, subgrupoId]
  );
  const contratoNome = useMemo(
    () => contratos.find((c) => c.id === contratoId)?.nome ?? '—',
    [contratos, contratoId]
  );

  const mesLabel = gradeMonthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const dayCount = gradeMonthEnd.getDate();
  const dayLetters = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  if (!isMaster) {
    return (
      <div className="p-6 text-center text-viva-700">
        Acesso restrito à equipe master.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 bg-white rounded-lg border border-viva-200/80 flex flex-col overflow-hidden min-h-0">
        <div className="pb-3 border-b border-viva-200 px-4 sm:px-5 flex-shrink-0">
          <div className="my-3">
            <p className="font-semibold text-viva-900 text-lg font-display">Escala Master</p>
            <p className="text-sm text-viva-600">Visão macro das equipes do subgrupo (somente leitura)</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
            <div>
              <label htmlFor="escala-master-contrato" className="block text-xs font-medium text-viva-600 mb-1">
                Contrato
              </label>
              <select
                id="escala-master-contrato"
                value={contratoId}
                onChange={(e) => {
                  setContratoId(e.target.value);
                  setSubgrupoId('');
                  setEquipeId('');
                }}
                className="w-full py-2 px-3 text-sm border border-viva-200 rounded-lg outline-none bg-viva-50/50 focus:ring-2 focus:ring-viva-500/30 focus:border-viva-500"
              >
                <option value="">Selecione um contrato</option>
                {contratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="escala-master-subgrupo" className="block text-xs font-medium text-viva-600 mb-1">
                Subgrupo
              </label>
              <select
                id="escala-master-subgrupo"
                value={subgrupoId}
                disabled={!contratoId}
                onChange={(e) => {
                  setSubgrupoId(e.target.value);
                  setEquipeId('');
                }}
                className="w-full py-2 px-3 text-sm border border-viva-200 rounded-lg outline-none bg-viva-50/50 focus:ring-2 focus:ring-viva-500/30 focus:border-viva-500 disabled:opacity-60"
              >
                <option value="">{contratoId ? 'Selecione um subgrupo' : 'Selecione o contrato primeiro'}</option>
                {subgruposDoContrato.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {subgrupoId ? (
            <div className="mt-3 max-w-md relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none"
                fill="currentColor"
                viewBox="0 0 512 512"
                aria-hidden
              >
                <path d="M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2 128-128 128z" />
              </svg>
              <input
                type="search"
                placeholder="Buscar equipe"
                value={buscaEquipe}
                onChange={(e) => setBuscaEquipe(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-viva-200 rounded-lg outline-none bg-viva-50/50 focus:ring-2 focus:ring-viva-500/30 focus:border-viva-500"
              />
            </div>
          ) : null}
        </div>

        {!contratoId || !subgrupoId ? (
          <div className="p-6 text-center text-viva-700">
            Selecione contrato e subgrupo para ver a grade macro das equipes.
          </div>
        ) : (
          <>
            <div
              className="flex items-center p-4 justify-between shrink-0 text-white"
              style={{ background: 'rgb(37, 111, 255)' }}
            >
              <div>
                <p className="font-semibold text-white font-display">{subgrupoNome}</p>
                <p className="text-white/90 text-sm">{contratoNome}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-white font-display capitalize">{mesLabel}</p>
                <div className="flex gap-2 mt-1 justify-end">
                  <button
                    type="button"
                    className="text-white/90 hover:underline text-sm"
                    onClick={() =>
                      setGradeMonthStart((d) => {
                        const x = new Date(d);
                        x.setMonth(x.getMonth() - 1);
                        return startOfMonth(x);
                      })
                    }
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    className="text-white/90 hover:underline text-sm"
                    onClick={() =>
                      setGradeMonthStart((d) => {
                        const x = new Date(d);
                        x.setMonth(x.getMonth() + 1);
                        return startOfMonth(x);
                      })
                    }
                  >
                    Próximo →
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden p-3 flex-1 flex min-h-0 bg-gradient-to-b from-viva-100/35 via-white to-viva-50/20">
              {loadingEquipes || loadingPlantoes ? (
                <div className="flex-1 flex items-center justify-center text-viva-700 text-sm">Carregando plantões…</div>
              ) : equipes.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-viva-700 text-sm">
                  Este subgrupo não possui equipes.
                </div>
              ) : equipesFiltradas.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-viva-700 text-sm">
                  Nenhuma equipe corresponde à busca.
                </div>
              ) : gradesForGrid.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-viva-700 text-sm">
                  Nenhum turno configurado para este contrato.
                </div>
              ) : (
                <div className="relative flex-1 flex flex-col overflow-y-auto overflow-x-auto min-w-0">
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr>
                        <th className="text-center border border-viva-200 p-1.5 font-semibold text-viva-800 font-display w-0 whitespace-nowrap">
                          Equipe
                        </th>
                        <th className="text-center border border-viva-200 p-1.5 font-semibold text-viva-800 font-display w-0 whitespace-nowrap">
                          Turno
                        </th>
                        {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => {
                          const d = new Date(gradeMonthStart.getFullYear(), gradeMonthStart.getMonth(), day);
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          return (
                            <th
                              key={day}
                              className={`text-center border p-1 min-w-[32px] ${
                                isWeekend ? 'bg-viva-200/60 border-viva-300' : 'border-viva-200'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span>{dayLetters[d.getDay()]}</span>
                                <span className="w-full h-px bg-viva-200" />
                                <span>{day}</span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {equipesFiltradas.map((equipe) =>
                        gradesForGrid.map((grade, gradeSubIndex) => (
                          <tr
                            key={`${equipe.id}-${grade.id}`}
                            className={gradeSubIndex === gradesForGrid.length - 1 ? 'tr-last' : ''}
                          >
                            {gradeSubIndex === 0 ? (
                              <td
                                className="border border-viva-200 p-1.5 align-top bg-white"
                                rowSpan={gradesForGrid.length}
                              >
                                <p className="font-medium text-viva-900 text-xs whitespace-nowrap">{equipe.nome}</p>
                              </td>
                            ) : null}
                            <td className="text-center border border-viva-200 p-1 text-viva-700 text-xs whitespace-nowrap">
                              <span className="font-medium">{grade.label}</span> - {grade.regua[0]} até {grade.regua[1]}
                            </td>
                            {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => {
                              const d = new Date(gradeMonthStart.getFullYear(), gradeMonthStart.getMonth(), day);
                              const dateStr = dateToInput(d);
                              const key = `${equipe.id}_${dateStr}_${grade.id}`;
                              const slots = plantaoMap.get(key) ?? [];
                              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                              const visible = slots.slice(0, MAX_AVATARS);
                              const extra = slots.length - visible.length;
                              const title = slots.map((s) => s.medico.nomeCompleto).join(', ');
                              return (
                                <td
                                  key={day}
                                  title={title || undefined}
                                  className={`border p-0 min-w-[32px] cursor-default ${
                                    isWeekend ? 'bg-viva-200/40 border-viva-300' : 'border-viva-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-center min-h-[40px] px-0.5 gap-0.5 flex-wrap">
                                    {visible.map((slot) => (
                                      <div
                                        key={slot.plantaoId}
                                        className="w-[26px] h-[26px] rounded-full overflow-hidden border-2 border-viva-600 shadow-sm shrink-0"
                                      >
                                        <img
                                          className="w-full h-full object-cover"
                                          alt={slot.medico.nomeCompleto}
                                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                            slot.medico.nomeCompleto
                                          )}&background=F1F2F6&color=256F3F&bold=true&size=256`}
                                        />
                                      </div>
                                    ))}
                                    {extra > 0 ? (
                                      <div
                                        className="w-[26px] h-[26px] rounded-full border-2 border-viva-600 bg-[#F1F2F6] text-viva-900 shadow-sm flex items-center justify-center text-[10px] font-semibold shrink-0"
                                        title={title}
                                      >
                                        +{extra}
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EscalaMaster;
