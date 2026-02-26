import { useMemo, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService, Escala } from '../services/admin.service';

interface EscalaFormState {
  contratoAtivoId: string;
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
}

const emptyForm: EscalaFormState = {
  contratoAtivoId: '',
  nome: '',
  descricao: '',
  dataInicio: '',
  dataFim: '',
  ativo: true,
};

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

function dateToInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DEFAULT_GRADES = [
  { id: 'mt', label: 'MT', horario: '07-19', tipo: 'Diurno', regua: ['07:00', '19:00'] },
  { id: 'sn', label: 'SN', horario: '19-07', tipo: 'Noturno', regua: ['19:00', '07:00'] },
];

function getMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function getWeekDates(weekStart: Date): Date[] {
  const out: Date[] = [];
  const m = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    out.push(new Date(m));
    m.setDate(m.getDate() + 1);
  }
  return out;
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDayName(d: Date): string {
  const i = d.getDay();
  const names = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return names[i];
}

/** Primeiras duas palavras do nome para exibir na célula */
function shortName(nomeCompleto: string): string {
  const parts = nomeCompleto.trim().split(/\s+/);
  if (parts.length <= 2) return nomeCompleto.trim();
  return parts.slice(0, 2).join(' ');
}

function formatValorHora(valor: string | number | null | undefined): string {
  if (valor == null || valor === '') return '—';
  const n = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

const Escalas = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const [selectedEscalaId, setSelectedEscalaId] = useState<string>('');
  const [editingEscalaId, setEditingEscalaId] = useState<string | null>(null);
  const [form, setForm] = useState<EscalaFormState>(emptyForm);
  const [medicoIdToAllocate, setMedicoIdToAllocate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [medicoAllocateSearch, setMedicoAllocateSearch] = useState('');
  const [medicoAllocateOpen, setMedicoAllocateOpen] = useState(false);
  const medicoAllocateRef = useRef<HTMLDivElement>(null);
  const [medicoIdToAllocateCell, setMedicoIdToAllocateCell] = useState('');
  const [medicoAllocateCellSearch, setMedicoAllocateCellSearch] = useState('');
  const [medicoAllocateCellOpen, setMedicoAllocateCellOpen] = useState(false);
  const medicoAllocateCellRef = useRef<HTMLDivElement>(null);

  type CellModalState = {
    open: boolean;
    grade?: (typeof DEFAULT_GRADES)[0];
    date?: Date;
    gradeIndex?: number;
    dayIndex?: number;
    medico?: { id: string; nomeCompleto: string; crm: string; telefone?: string | null; email?: string | null } | null;
    plantaoId?: string;
  };
  const [cellModal, setCellModal] = useState<CellModalState>({ open: false });

  useEffect(() => {
    if (!medicoAllocateOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (medicoAllocateRef.current && !medicoAllocateRef.current.contains(e.target as Node)) {
        setMedicoAllocateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [medicoAllocateOpen]);

  useEffect(() => {
    if (!medicoAllocateCellOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (medicoAllocateCellRef.current && !medicoAllocateCellRef.current.contains(e.target as Node)) {
        setMedicoAllocateCellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [medicoAllocateCellOpen]);

  const { data: contratosResp } = useQuery({
    queryKey: ['admin', 'contratos-ativos', 'for-escalas'],
    queryFn: () => adminService.listContratosAtivos({ page: 1, limit: 200 }),
    enabled: isMaster,
  });

  const { data: escalasResp, isLoading: loadingEscalas } = useQuery({
    queryKey: ['admin', 'escalas'],
    queryFn: () => adminService.listEscalas({ page: 1, limit: 200 }),
    enabled: isMaster,
  });

  const { data: medicosResp } = useQuery({
    queryKey: ['admin', 'medicos', 'for-escalas'],
    queryFn: () => adminService.listMedicos({ page: 1, limit: 2000 }),
    enabled: isMaster,
  });

  const { data: alocacoesResp } = useQuery({
    queryKey: ['admin', 'escalas', selectedEscalaId, 'medicos'],
    queryFn: () => adminService.listEscalaMedicos(selectedEscalaId),
    enabled: isMaster && !!selectedEscalaId,
  });

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const { data: plantoesResp } = useQuery({
    queryKey: ['admin', 'escalas', selectedEscalaId, 'plantoes', dateToInput(weekStart), dateToInput(weekEnd)],
    queryFn: () =>
      adminService.listEscalaPlantoes(selectedEscalaId, {
        dataInicio: dateToInput(weekStart),
        dataFim: dateToInput(weekEnd),
      }),
    enabled: isMaster && !!selectedEscalaId,
  });

  const { data: escalaSubgruposResp } = useQuery({
    queryKey: ['admin', 'escalas', selectedEscalaId, 'subgrupos'],
    queryFn: () => adminService.listEscalaSubgrupos(selectedEscalaId),
    enabled: isMaster && !!selectedEscalaId,
  });

  const selectedEscala = useMemo(
    () => (escalasResp?.data || []).find((e: Escala) => e.id === selectedEscalaId),
    [escalasResp?.data, selectedEscalaId]
  );
  const firstSubgrupoId = useMemo(() => {
    const list = escalaSubgruposResp?.data || [];
    const first = list[0];
    return first?.subgrupoId ?? first?.subgrupo?.id ?? '';
  }, [escalaSubgruposResp?.data]);

  const { data: valoresPlantaoResp } = useQuery({
    queryKey: ['admin', 'valores-plantao', selectedEscala?.contratoAtivoId ?? '', firstSubgrupoId],
    queryFn: () =>
      adminService.getValoresPlantao(selectedEscala!.contratoAtivoId, firstSubgrupoId),
    enabled:
      isMaster &&
      !!selectedEscala?.contratoAtivoId &&
      !!firstSubgrupoId,
  });

  const contratos = useMemo(() => contratosResp?.data || [], [contratosResp]);
  const escalas = useMemo(() => escalasResp?.data || [], [escalasResp]);
  const medicos = useMemo(() => medicosResp?.data || [], [medicosResp]);
  const alocacoes = useMemo(() => alocacoesResp?.data || [], [alocacoesResp]);
  const plantoes = useMemo(() => plantoesResp?.data || [], [plantoesResp]);
  const valoresPlantao = useMemo(() => valoresPlantaoResp?.data || [], [valoresPlantaoResp]);

  const valorByGrade = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const v of valoresPlantao) {
      const n = v.valorHora != null && v.valorHora !== '' ? parseFloat(String(v.valorHora)) : null;
      map.set(v.gradeId, Number.isNaN(n as number) ? null : n);
    }
    return map;
  }, [valoresPlantao]);

  const plantaoMap = useMemo(() => {
    const map = new Map<
      string,
      { medico: { id: string; nomeCompleto: string; crm: string; telefone?: string | null; email?: string | null }; plantaoId: string; valorHora: string | null }
    >();
    for (const p of plantoes) {
      const dateStr = p.data.slice(0, 10);
      map.set(`${dateStr}_${p.gradeId}`, {
        medico: {
          id: p.medico.id,
          nomeCompleto: p.medico.nomeCompleto,
          crm: p.medico.crm,
          telefone: p.medico.telefone ?? null,
          email: p.medico.email ?? null,
        },
        plantaoId: p.id,
        valorHora: p.valorHora ?? null,
      });
    }
    return map;
  }, [plantoes]);

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Somente o perfil Master pode gerenciar escalas.</p>
      </div>
    );
  }

  const invalidateEscalas = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'escalas'] });
  };

  const invalidateAlocacoes = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'escalas', selectedEscalaId, 'medicos'] });
  };

  const invalidatePlantoes = () => {
    queryClient.invalidateQueries({
      queryKey: ['admin', 'escalas', selectedEscalaId, 'plantoes'],
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingEscalaId(null);
    setError(null);
  };

  const startEdit = (escala: Escala) => {
    setEditingEscalaId(escala.id);
    setForm({
      contratoAtivoId: escala.contratoAtivoId,
      nome: escala.nome,
      descricao: escala.descricao || '',
      dataInicio: toDateInput(escala.dataInicio),
      dataFim: toDateInput(escala.dataFim),
      ativo: escala.ativo,
    });
  };

  const submitEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction(true);
    setError(null);
    try {
      const payload = {
        contratoAtivoId: form.contratoAtivoId,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        ativo: form.ativo,
      };
      if (!payload.nome || !payload.contratoAtivoId || !payload.dataInicio || !payload.dataFim) {
        throw new Error('Preencha contrato, nome, data inicial e data final.');
      }

      if (editingEscalaId) {
        await adminService.updateEscala(editingEscalaId, payload);
      } else {
        await adminService.createEscala(payload);
      }

      resetForm();
      await invalidateEscalas();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar escala');
    } finally {
      setLoadingAction(false);
    }
  };

  const deleteEscala = async (escala: Escala) => {
    const ok = window.confirm(`Excluir escala "${escala.nome}"?`);
    if (!ok) return;
    setLoadingAction(true);
    try {
      await adminService.deleteEscala(escala.id);
      if (selectedEscalaId === escala.id) {
        setSelectedEscalaId('');
      }
      if (editingEscalaId === escala.id) {
        resetForm();
      }
      await invalidateEscalas();
    } finally {
      setLoadingAction(false);
    }
  };

  const alocarMedico = async () => {
    if (!selectedEscalaId || !medicoIdToAllocate) return;
    setLoadingAction(true);
    setError(null);
    try {
      await adminService.alocarMedicoEscala(selectedEscalaId, { medicoId: medicoIdToAllocate });
      setMedicoIdToAllocate('');
      setMedicoAllocateSearch('');
      setMedicoAllocateOpen(false);
      await invalidateAlocacoes();
      await invalidateEscalas();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao alocar médico');
    } finally {
      setLoadingAction(false);
    }
  };

  const removerAlocacao = async (medicoId: string) => {
    if (!selectedEscalaId) return;
    setLoadingAction(true);
    try {
      await adminService.removerMedicoEscala(selectedEscalaId, medicoId);
      await invalidateAlocacoes();
      await invalidateEscalas();
    } finally {
      setLoadingAction(false);
    }
  };

  const alocarMedicoNoPlantao = async () => {
    if (!selectedEscalaId || !cellModal.grade || !cellModal.date || !medicoIdToAllocateCell) return;
    setLoadingAction(true);
    setError(null);
    try {
      await adminService.createEscalaPlantao(selectedEscalaId, {
        data: dateToInput(cellModal.date),
        gradeId: cellModal.grade.id,
        medicoId: medicoIdToAllocateCell,
        valorHora: cellModal.grade ? valorByGrade.get(cellModal.grade.id) ?? null : null,
      });
      setMedicoIdToAllocateCell('');
      setMedicoAllocateCellSearch('');
      setMedicoAllocateCellOpen(false);
      invalidatePlantoes();
      setCellModal((m) => ({ ...m, open: false }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atribuir plantão');
    } finally {
      setLoadingAction(false);
    }
  };

  const removerPlantaoDaCelula = async () => {
    if (!selectedEscalaId || !cellModal.plantaoId) return;
    setLoadingAction(true);
    try {
      await adminService.removerEscalaPlantao(selectedEscalaId, cellModal.plantaoId);
      invalidatePlantoes();
      setCellModal((m) => ({ ...m, open: false }));
    } finally {
      setLoadingAction(false);
    }
  };

  const medicoParaReplicar = cellModal.medico?.id ?? medicoIdToAllocateCell;
  const alocacaoParaValor = useMemo(() => {
    if (!cellModal.medico?.id) return null;
    return alocacoes.find((a) => a.medicoId === cellModal.medico!.id) ?? null;
  }, [alocacoes, cellModal.medico?.id]);

  const plantaoSlotValor = useMemo(() => {
    if (!cellModal.date || !cellModal.grade) return null;
    const key = `${dateToInput(cellModal.date)}_${cellModal.grade.id}`;
    const slot = plantaoMap.get(key);
    if (slot?.valorHora == null || slot.valorHora === '') return null;
    const n = parseFloat(String(slot.valorHora));
    return Number.isNaN(n) ? null : n;
  }, [cellModal.date, cellModal.grade, plantaoMap]);

  const replicarMedicoNaSemana = async () => {
    if (!selectedEscalaId || !cellModal.grade || !medicoParaReplicar) return;
    setLoadingAction(true);
    setError(null);
    const valorHora = cellModal.grade ? valorByGrade.get(cellModal.grade.id) ?? null : null;
    try {
      const dias = getWeekDates(weekStart);
      for (const d of dias) {
        await adminService.createEscalaPlantao(selectedEscalaId, {
          data: dateToInput(d),
          gradeId: cellModal.grade.id,
          medicoId: medicoParaReplicar,
          valorHora,
        });
      }
      setMedicoIdToAllocateCell('');
      setMedicoAllocateCellSearch('');
      invalidatePlantoes();
      setCellModal((m) => ({ ...m, open: false }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao replicar');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-viva-500 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-viva-900 mb-1">Escalas</h2>
          <p className="text-gray-600">Cadastre escalas, associe contratos ativos e aloque médicos.</p>
        </div>
        <Link to="/subgrupos-equipes" className="btn btn-secondary inline-flex items-center gap-2">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
          Gerenciar Subgrupos e Equipes
        </Link>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-4">{editingEscalaId ? 'Editar escala' : 'Nova escala'}</h3>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submitEscala}>
          <select
            className="input"
            value={form.contratoAtivoId}
            onChange={(e) => setForm((prev) => ({ ...prev, contratoAtivoId: e.target.value }))}
          >
            <option value="">Selecione um contrato ativo</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Nome da escala"
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
          />
          <input
            className="input"
            type="date"
            value={form.dataInicio}
            onChange={(e) => setForm((prev) => ({ ...prev, dataInicio: e.target.value }))}
          />
          <input
            className="input"
            type="date"
            value={form.dataFim}
            onChange={(e) => setForm((prev) => ({ ...prev, dataFim: e.target.value }))}
          />
          <textarea
            className="input md:col-span-2 min-h-[90px]"
            placeholder="Descrição (opcional)"
            value={form.descricao}
            onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-viva-900">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
            />
            Escala ativa
          </label>

          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}

          <div className="md:col-span-2 flex gap-2">
            <button className="btn btn-primary" type="submit" disabled={loadingAction}>
              {editingEscalaId ? 'Salvar alterações' : 'Criar escala'}
            </button>
            {editingEscalaId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-4">Escalas cadastradas</h3>
        {loadingEscalas ? (
          <p className="text-sm text-gray-600">Carregando escalas...</p>
        ) : escalas.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhuma escala cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {escalas.map((escala) => (
              <div
                key={escala.id}
                className={`border rounded-xl p-3 ${
                  selectedEscalaId === escala.id ? 'border-viva-900 bg-viva-50' : 'border-viva-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    className="text-left"
                    onClick={() => setSelectedEscalaId((prev) => (prev === escala.id ? '' : escala.id))}
                  >
                    <p className="font-semibold text-viva-900">{escala.nome}</p>
                    <p className="text-xs text-gray-600">
                      Contrato: {escala.contratoAtivo?.nome || '-'} | {toDateInput(escala.dataInicio)} até{' '}
                      {toDateInput(escala.dataFim)} | Alocados: {escala._count?.alocacoes || 0}
                    </p>
                  </button>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={() => startEdit(escala)}>
                      Editar
                    </button>
                    <button className="btn btn-secondary" onClick={() => deleteEscala(escala)}>
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEscalaId && (
        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-4">Alocação de médicos na escala</h3>
          <div className="flex gap-2 mb-4 flex-wrap items-start">
            <div ref={medicoAllocateRef} className="relative flex-1 min-w-[240px] max-w-md">
              <input
                type="text"
                className="input w-full"
                placeholder="Digite para pesquisar ou selecione um médico"
                value={
                  medicoIdToAllocate && medicos.length > 0
                    ? medicoAllocateOpen
                      ? medicoAllocateSearch
                      : (medicos.find((m) => m.id === medicoIdToAllocate)?.nomeCompleto ?? '') +
                        ' (' +
                        (medicos.find((m) => m.id === medicoIdToAllocate)?.crm ?? '') +
                        ')'
                    : medicoAllocateSearch
                }
                onChange={(e) => {
                  setMedicoAllocateSearch(e.target.value);
                  setMedicoAllocateOpen(true);
                  if (!e.target.value) setMedicoIdToAllocate('');
                }}
                onFocus={() => setMedicoAllocateOpen(true)}
              />
              {medicoAllocateOpen && (
                <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-viva-200 bg-white shadow-lg py-1">
                  {(() => {
                    const allocatedIds = new Set(alocacoes.map((a) => a.medicoId));
                    const searchLower = medicoAllocateSearch.trim().toLowerCase();
                    const filtered = medicos.filter((m) => {
                      if (allocatedIds.has(m.id)) return false;
                      if (!searchLower) return true;
                      const nome = (m.nomeCompleto ?? '').toLowerCase();
                      const crm = (m.crm ?? '').toLowerCase();
                      return nome.includes(searchLower) || crm.includes(searchLower);
                    });
                    return filtered.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-gray-500">Nenhum médico encontrado</li>
                    ) : (
                      filtered.map((m) => (
                        <li
                          key={m.id}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-viva-100 text-viva-900"
                          onClick={() => {
                            setMedicoIdToAllocate(m.id);
                            setMedicoAllocateSearch('');
                            setMedicoAllocateOpen(false);
                          }}
                        >
                          {m.nomeCompleto} ({m.crm})
                        </li>
                      ))
                    );
                  })()}
                </ul>
              )}
            </div>
            <button className="btn btn-primary" onClick={alocarMedico} disabled={loadingAction}>
              Alocar
            </button>
          </div>

          {alocacoes.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum médico alocado.</p>
          ) : (
            <div className="space-y-2">
              {alocacoes.map((a) => (
                <div key={a.id} className="border border-viva-200 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-viva-900">{a.medico.nomeCompleto}</p>
                    <p className="text-xs text-gray-600">
                      {a.medico.crm} | {a.medico.email || '-'}
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => removerAlocacao(a.medicoId)}>
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedEscalaId && (
        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-4">Visualização semanal</h3>
          <p className="text-sm text-gray-600 mb-4">
            Grade da semana. MT = plantão diurno (07h–19h), SN = plantão noturno (19h–07h). Os médicos exibidos são os alocados nesta escala (distribuição ilustrativa por dia/turno).
          </p>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-viva-800 bg-viva-100 hover:bg-viva-200 transition"
                onClick={() => setWeekStart((d) => { const m = getMonday(new Date(d)); m.setDate(m.getDate() - 7); return m; })}
              >
                ← Semana anterior
              </button>
              <span className="text-sm font-medium text-viva-800">
                Semana de {formatDayShort(weekStart)}
              </span>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-viva-800 bg-viva-100 hover:bg-viva-200 transition"
                onClick={() => setWeekStart((d) => { const m = getMonday(new Date(d)); m.setDate(m.getDate() + 7); return m; })}
              >
                Próxima semana →
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-viva-200">
            <div className="min-w-[800px]">
              <div className="bg-viva-100/60 border-b border-viva-200">
                <div className="flex">
                  <div className="w-[140px] min-w-[140px] shrink-0 py-3 px-3 text-center text-sm font-bold text-viva-800 border-r border-viva-200">
                    Grade
                  </div>
                  {getWeekDates(weekStart).map((d, i) => (
                    <div
                      key={i}
                      className="w-[130px] min-w-[130px] shrink-0 py-3 px-2 text-center border-r border-viva-200 last:border-r-0"
                    >
                      <div className="text-sm font-semibold text-viva-900">{formatDayName(d)}</div>
                      <div className="text-xs text-viva-700">{formatDayShort(d)}</div>
                      <div className="mt-2 flex justify-center gap-1">
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-viva-200/80 text-viva-700 hover:bg-viva-300"
                          title="Configurar plantões deste dia"
                        >
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286 1.048c-1.372-.836-2.942.734-2.106 2.106a1.532 1.532 0 01-1.048 2.286C3.57 7.2 3 8.407 3 9.5s.57 2.3 1.23 2.7a1.532 1.532 0 011.05 2.29c-.837 1.37.734 2.94 2.11 2.11a1.53 1.53 0 012.28 1.05c.6.66 1.81 1.23 2.92 1.23s2.3-.57 2.7-1.23a1.53 1.53 0 012.29-1.05 2.17 2.17 0 002.11-2.11 1.53 1.53 0 011.05-2.28c.66-.6 1.23-1.62 1.23-2.7s-.57-2.3-1.23-2.7z" clipRule="evenodd" /></svg>
                        </span>
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 text-green-700"
                          title="Visível no app dos profissionais"
                        >
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-viva-100">
                {DEFAULT_GRADES.map((grade, gradeIndex) => (
                  <div key={grade.id} className="flex min-h-[72px]">
                    <div className="w-[140px] min-w-[140px] shrink-0 border-r border-viva-200 bg-viva-50/50 p-2 flex flex-col justify-center">
                      <div className="text-sm font-semibold text-viva-900">{grade.label}</div>
                      <div className="text-xs text-viva-700">{grade.horario}</div>
                      <div className="text-[10px] text-viva-600">{grade.tipo}</div>
                      <div className="mt-1 flex gap-1 text-[10px] text-viva-500">
                        {grade.regua?.map((h, i) => (
                          <span key={i}>{h}</span>
                        ))}
                      </div>
                    </div>
                    {getWeekDates(weekStart).map((d, dayIndex) => {
                      const dateStr = dateToInput(d);
                      const slotKey = `${dateStr}_${grade.id}`;
                      const plantaoSlot = plantaoMap.get(slotKey);
                      const medico = plantaoSlot?.medico ?? (() => {
                        const n = alocacoes.length;
                        const aloc = n > 0 ? alocacoes[(gradeIndex * 7 + dayIndex) % n] : null;
                        return aloc?.medico ?? null;
                      })();
                      const tooltip = medico
                        ? `${medico.nomeCompleto}\n${medico.telefone || medico.email || ''}\n${grade.horario}`
                        : 'Sem alocação';
                      return (
                        <div
                          key={dayIndex}
                          role="button"
                          tabIndex={0}
                          className="w-[130px] min-w-[130px] shrink-0 border-r border-viva-100 last:border-r-0 p-2 flex items-center justify-center bg-white hover:bg-viva-50/50 transition cursor-pointer"
                          title={tooltip}
                          onClick={() => {
                            setMedicoIdToAllocateCell('');
                            setMedicoAllocateCellSearch('');
                            setMedicoAllocateCellOpen(false);
                            setCellModal({
                              open: true,
                              grade,
                              date: d,
                              gradeIndex,
                              dayIndex,
                              medico: medico ? { id: medico.id, nomeCompleto: medico.nomeCompleto, crm: medico.crm, telefone: medico.telefone ?? null, email: medico.email ?? null } : null,
                              plantaoId: plantaoSlot?.plantaoId,
                            });
                          }}
                        >
                          {medico ? (
                            <div className="text-center">
                              <div className="text-sm font-medium text-viva-900 truncate" title={medico.nomeCompleto}>
                                {shortName(medico.nomeCompleto)}
                              </div>
                              <div className="text-[10px] text-viva-600">{grade.horario}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {cellModal.open && cellModal.grade && cellModal.date && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setCellModal((m) => ({ ...m, open: false }))}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-viva-200 bg-viva-50/60">
              <h4 className="text-base font-bold text-viva-900 flex items-center gap-2 flex-wrap">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-viva-200 text-viva-800">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                </span>
                <span>
                  {cellModal.grade.label} - {cellModal.grade.tipo}
                </span>
              </h4>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-viva-200 text-viva-700"
                onClick={() => setCellModal((m) => ({ ...m, open: false }))}
                aria-label="Fechar"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
            <div className="px-4 py-3 text-sm text-viva-700 border-b border-viva-100">
              <span className="inline-flex items-center gap-1">
                <svg className="h-4 w-4 text-viva-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                {formatDayShort(cellModal.date)} - {formatDayName(cellModal.date)} · {cellModal.grade.horario}
              </span>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-viva-500">
                  Plantão: {cellModal.grade.label} ({cellModal.grade.regua?.join('–')})
                </span>
                {(valorByGrade.get(cellModal.grade.id) != null || plantaoSlotValor != null || alocacaoParaValor?.valorHora != null) && (
                  <span className="text-xs font-medium text-viva-700">
                    Valor do plantão: {formatValorHora(plantaoSlotValor ?? valorByGrade.get(cellModal.grade.id) ?? alocacaoParaValor?.valorHora)}
                  </span>
                )}
              </div>
            </div>
            <div className="px-4 py-4 overflow-y-auto flex-1">
              <div className="flex gap-2 text-[10px] text-viva-500 mb-3">
                {cellModal.grade.regua?.map((h, i) => (
                  <span key={i}>{h}</span>
                ))}
              </div>
              {cellModal.medico ? (
                <div className="border border-viva-200 rounded-lg p-3 mb-4">
                  <p className="font-semibold text-viva-900">{cellModal.medico.nomeCompleto}</p>
                  <p className="text-xs text-viva-600">CRM: {cellModal.medico.crm}</p>
                  {(cellModal.medico.telefone || cellModal.medico.email) && (
                    <p className="text-xs text-viva-600">
                      {cellModal.medico.telefone || cellModal.medico.email}
                    </p>
                  )}
                  <p className="text-xs text-viva-500 mt-1">{cellModal.grade.horario}</p>
                  {(plantaoSlotValor != null || valorByGrade.get(cellModal.grade.id) != null || alocacaoParaValor?.valorHora != null) && (
                    <p className="text-xs font-medium text-viva-700 mt-1">
                      Valor do plantão: {formatValorHora(plantaoSlotValor ?? valorByGrade.get(cellModal.grade.id) ?? alocacaoParaValor?.valorHora)}
                    </p>
                  )}
                  {cellModal.plantaoId && (
                    <button
                      type="button"
                      className="btn btn-secondary mt-2"
                      onClick={removerPlantaoDaCelula}
                      disabled={loadingAction}
                    >
                      Remover deste plantão
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-4">Sem profissional atribuído a este plantão.</p>
              )}

              <div className="mt-4">
                <p className="text-xs text-viva-600 mb-3">
                  O valor do plantão é definido em <Link to="/valores-plantao" className="font-semibold text-viva-800 underline hover:text-viva-900">Valores Hora/Plantão</Link> (Administração). Ao alocar ou replicar, o valor configurado para {cellModal.grade.label} será aplicado.
                </p>
                <h4 className="text-sm font-bold text-viva-900 mb-2">Atribuir médico a este plantão</h4>
                <div className="flex gap-2 mb-2 flex-wrap items-start">
                  <div ref={medicoAllocateCellRef} className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Digite para pesquisar ou selecione um médico"
                      value={
                        medicoIdToAllocateCell && medicos.length > 0
                          ? medicoAllocateCellOpen
                            ? medicoAllocateCellSearch
                            : (medicos.find((m) => m.id === medicoIdToAllocateCell)?.nomeCompleto ?? '') +
                              ' (' +
                              (medicos.find((m) => m.id === medicoIdToAllocateCell)?.crm ?? '') +
                              ')'
                          : medicoAllocateCellSearch
                      }
                      onChange={(e) => {
                        setMedicoAllocateCellSearch(e.target.value);
                        setMedicoAllocateCellOpen(true);
                        if (!e.target.value) setMedicoIdToAllocateCell('');
                      }}
                      onFocus={() => setMedicoAllocateCellOpen(true)}
                    />
                    {medicoAllocateCellOpen && (
                      <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-viva-200 bg-white shadow-lg py-1">
                        {(() => {
                          const searchLower = medicoAllocateCellSearch.trim().toLowerCase();
                          const filtered = medicos.filter((m) => {
                            if (!searchLower) return true;
                            const nome = (m.nomeCompleto ?? '').toLowerCase();
                            const crm = (m.crm ?? '').toLowerCase();
                            return nome.includes(searchLower) || crm.includes(searchLower);
                          });
                          return filtered.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-gray-500">Nenhum médico encontrado</li>
                          ) : (
                            filtered.map((m) => (
                              <li
                                key={m.id}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-viva-100 text-viva-900"
                                onClick={() => {
                                  setMedicoIdToAllocateCell(m.id);
                                  setMedicoAllocateCellSearch('');
                                  setMedicoAllocateCellOpen(false);
                                }}
                              >
                                {m.nomeCompleto} ({m.crm})
                              </li>
                            ))
                          );
                        })()}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={alocarMedicoNoPlantao}
                    disabled={loadingAction || !medicoIdToAllocateCell}
                  >
                    Alocar
                  </button>
                </div>
                <p className="text-xs text-viva-600 mb-4">
                  O médico ficará atribuído a este dia e turno ({cellModal.grade.label} – {formatDayShort(cellModal.date)}).
                </p>

                {(medicoParaReplicar || cellModal.medico) && (
                  <div className="mt-4 pt-4 border-t border-viva-200">
                    <h4 className="text-sm font-bold text-viva-900 mb-2">Repetir para outros dias</h4>
                    <p className="text-xs text-viva-600 mb-2">
                      Aplica o médico {cellModal.medico ? cellModal.medico.nomeCompleto : (medicos.find((m) => m.id === medicoIdToAllocateCell)?.nomeCompleto ?? 'selecionado')} e o valor do plantão no turno {cellModal.grade.label} em todos os 7 dias desta semana.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary w-full sm:w-auto"
                      onClick={replicarMedicoNaSemana}
                      disabled={loadingAction || !medicoParaReplicar}
                    >
                      {loadingAction ? 'Aplicando...' : `Repetir médico e valor para todos os dias (${cellModal.grade.label})`}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-viva-200 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCellModal((m) => ({ ...m, open: false }))}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Escalas;
