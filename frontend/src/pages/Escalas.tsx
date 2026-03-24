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
  ativo: false,
};

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

/** Datas padrão para nova escala (início do ano atual até fim do próximo). O usuário não define período. */
const getDefaultScaleDates = () => {
  const ano = new Date().getFullYear();
  return { dataInicio: `${ano}-01-01`, dataFim: `${ano + 1}-12-31` };
};

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
  /** Primeiro dia do mês exibido na grade mensal (layout principal da escala). */
  const [gradeMonthStart, setGradeMonthStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  /** Modal do formulário Nova escala / Editar escala. */
  const [escalaFormModalOpen, setEscalaFormModalOpen] = useState(false);
  const [medicoAllocateSearch, setMedicoAllocateSearch] = useState('');
  const [medicoAllocateOpen, setMedicoAllocateOpen] = useState(false);
  const medicoAllocateRef = useRef<HTMLDivElement>(null);
  const [medicoIdToAllocateCell, setMedicoIdToAllocateCell] = useState('');
  const [medicoAllocateCellSearch, setMedicoAllocateCellSearch] = useState('');
  const [medicoAllocateCellOpen, setMedicoAllocateCellOpen] = useState(false);
  const medicoAllocateCellRef = useRef<HTMLDivElement>(null);

  /** 'grupos' = primeira tela (Lista de subgrupos e equipes); 'escalas' = escalas + grade */
  const [viewEscalas, setViewEscalas] = useState<'grupos' | 'escalas'>('grupos');
  const [searchGrupos, setSearchGrupos] = useState('');
  /** Subgrupo selecionado na Lista de grupos; ao clicar, exibe as equipes desse subgrupo (ou mensagem se não tiver). */
  const [selectedSubgrupoId, setSelectedSubgrupoId] = useState<string | null>(null);
  /** Equipe selecionada: ao clicar, abre o painel lateral (menu) da equipe. */
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null);
  /** Aba ativa no painel lateral da equipe. */
  const [equipePanelTab, setEquipePanelTab] = useState<'calendario' | 'editar' | 'membros' | 'historico' | 'relatorio'>('calendario');
  /** Mês/ano exibido no calendário do painel da equipe. */
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
  /** Dia clicado no calendário: abre o painel "Plantões do dia". */
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{ year: number; month: number; day: number } | null>(null);
  /** Aba no painel Plantões do dia: Dinâmica ou Fixa. */
  const [plantaoViewMode, setPlantaoViewMode] = useState<'dinamica' | 'fixa'>('dinamica');
  /** Ano exibido na aba "Editar escala" do painel da equipe. */
  const [editarEscalaYear, setEditarEscalaYear] = useState(() => new Date().getFullYear());
  /** Busca por profissional na grade da escala (filtra linhas da tabela). */
  const [gradeBuscaProfissional, setGradeBuscaProfissional] = useState('');

  type CellModalState = {
    open: boolean;
    grade?: (typeof DEFAULT_GRADES)[0];
    date?: Date;
    gradeIndex?: number;
    dayIndex?: number;
    medico?: { id: string; nomeCompleto: string; crm: string; telefone?: string | null; email?: string | null } | null;
    plantaoId?: string;
    /** true quando a célula clicada pertence à linha "Plantão Vago" (divulgar vagas). */
    isPlantaoVagoRow?: boolean;
  };
  const [cellModal, setCellModal] = useState<CellModalState>({ open: false });
  const [plantaoVagoVagas, setPlantaoVagoVagas] = useState(0);
  const [plantaoVagoSlots, setPlantaoVagoSlots] = useState<Record<string, number>>({});
  const [pendingPlantaoKey, setPendingPlantaoKey] = useState<string | null>(null);
  const [confirmClearVagas, setConfirmClearVagas] = useState<{ open: boolean; key?: string; label?: string }>(
    { open: false }
  );
  useEffect(() => {
    if (cellModal.open && cellModal.isPlantaoVagoRow) setPlantaoVagoVagas(0);
  }, [cellModal.open, cellModal.isPlantaoVagoRow]);

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

  const { data: subgruposResp } = useQuery({
    queryKey: ['admin', 'subgrupos'],
    queryFn: () => adminService.listSubgrupos(),
    enabled: isMaster,
  });
  const { data: equipesResp } = useQuery({
    queryKey: ['admin', 'equipes', 'todos'],
    queryFn: () => adminService.listEquipes(),
    enabled: isMaster,
  });

  const plantoesDiaDateStr = useMemo(() => {
    if (!selectedCalendarDay) return '';
    const { year, month, day } = selectedCalendarDay;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }, [selectedCalendarDay]);

  const { data: equipePlantoesDiaResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId ?? '', 'plantoes', plantoesDiaDateStr],
    queryFn: () =>
      adminService.listEquipePlantoes(selectedEquipeId!, {
        dataInicio: plantoesDiaDateStr,
        dataFim: plantoesDiaDateStr,
      }),
    enabled: isMaster && !!selectedEquipeId && !!plantoesDiaDateStr,
  });

  const { data: equipeEscalasResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId ?? '', 'escalas'],
    queryFn: () => adminService.listEscalasByEquipe(selectedEquipeId!),
    enabled: isMaster && !!selectedEquipeId,
  });
  const { data: escalaEquipesResp } = useQuery({
    queryKey: ['admin', 'escalas', selectedEscalaId, 'equipes'],
    queryFn: () => adminService.listEscalaEquipes(selectedEscalaId),
    enabled: isMaster && !!selectedEscalaId,
  });
  const equipeIdParaGrade = useMemo(() => {
    if (selectedEquipeId) return selectedEquipeId;
    const list = escalaEquipesResp?.data ?? [];
    const first = list[0] as { equipeId?: string; equipe?: { id: string } } | undefined;
    return first?.equipeId ?? first?.equipe?.id ?? '';
  }, [selectedEquipeId, escalaEquipesResp?.data]);
  const { data: equipeMedicosResp } = useQuery({
    queryKey: ['admin', 'equipes', equipeIdParaGrade, 'medicos'],
    queryFn: () => adminService.listEquipeMedicos(equipeIdParaGrade),
    enabled: isMaster && !!equipeIdParaGrade,
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

  const gradeMonthEnd = useMemo(() => {
    const d = new Date(gradeMonthStart.getFullYear(), gradeMonthStart.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [gradeMonthStart]);

  const { data: plantoesMonthResp } = useQuery({
    queryKey: ['admin', 'escalas', selectedEscalaId, 'plantoes-month', dateToInput(gradeMonthStart), dateToInput(gradeMonthEnd)],
    queryFn: () =>
      adminService.listEscalaPlantoes(selectedEscalaId, {
        dataInicio: dateToInput(gradeMonthStart),
        dataFim: dateToInput(gradeMonthEnd),
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

  /** Na view "escalas", se houver só uma escala, já abre direto a grade (evita lista + clique). */
  useEffect(() => {
    if (viewEscalas !== 'escalas' || escalas.length !== 1 || selectedEscalaId) return;
    setSelectedEscalaId(escalas[0].id);
  }, [viewEscalas, escalas, selectedEscalaId]);

  const medicos = useMemo(() => medicosResp?.data || [], [medicosResp]);
  const subgrupos = useMemo(() => subgruposResp?.data || [], [subgruposResp]);
  const equipes = useMemo(() => equipesResp?.data || [], [equipesResp]);

  const searchGruposLower = searchGrupos.trim().toLowerCase();
  /** Na página Escalas: só subgrupos vinculados a contratos que usam escala (plantões). */
  const subgruposComEscala = useMemo(
    () =>
      subgrupos.filter((s) =>
        (s.contratoSubgrupos ?? []).some((cs) => cs.contratoAtivo?.usaEscala === true)
      ),
    [subgrupos]
  );
  const subgruposFiltrados = useMemo(() => {
    const base = subgruposComEscala;
    if (!searchGruposLower) return base;
    return base.filter((s) => s.nome.toLowerCase().includes(searchGruposLower));
  }, [subgruposComEscala, searchGruposLower]);
  const equipesFiltradas = useMemo(() => {
    if (!searchGruposLower) return equipes;
    return equipes.filter(
      (e) =>
        e.nome.toLowerCase().includes(searchGruposLower) ||
        (e.subgrupo?.nome ?? '').toLowerCase().includes(searchGruposLower)
    );
  }, [equipes, searchGruposLower]);

  /** Equipes do subgrupo selecionado (só preenchido quando selectedSubgrupoId está setado). */
  const equipesDoSubgrupoSelecionado = useMemo(() => {
    if (!selectedSubgrupoId) return [];
    return equipes.filter(
      (e) => e.subgrupoId === selectedSubgrupoId || e.subgrupo?.id === selectedSubgrupoId
    );
  }, [equipes, selectedSubgrupoId]);

  const selectedSubgrupo = useMemo(
    () => (selectedSubgrupoId ? subgrupos.find((s) => s.id === selectedSubgrupoId) : null),
    [subgrupos, selectedSubgrupoId]
  );

  const selectedEquipe = useMemo(
    () => (selectedEquipeId ? equipes.find((e) => e.id === selectedEquipeId) : null),
    [equipes, selectedEquipeId]
  );
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

  const plantoesMonth = useMemo(() => plantoesMonthResp?.data || [], [plantoesMonthResp]);
  const plantaoMapMonth = useMemo(() => {
    const map = new Map<
      string,
      { medico: { id: string; nomeCompleto: string; crm: string; telefone?: string | null; email?: string | null }; plantaoId: string; valorHora: string | null }
    >();
    for (const p of plantoesMonth) {
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
  }, [plantoesMonth]);

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400 stagger-1">
        <h2 className="text-lg font-bold text-viva-900 mb-2 font-display">Acesso restrito</h2>
        <p className="text-sm text-viva-700 font-serif">Somente o perfil Master pode gerenciar escalas.</p>
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
    queryClient.invalidateQueries({
      queryKey: ['admin', 'escalas', selectedEscalaId, 'plantoes-month'],
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingEscalaId(null);
    setEscalaFormModalOpen(false);
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

  if (viewEscalas === 'grupos') {
    const equipePanelTabs: { id: typeof equipePanelTab; label: string }[] = [
      { id: 'calendario', label: 'Calendário' },
      { id: 'editar', label: 'Editar escala' },
      { id: 'membros', label: 'Membros' },
      { id: 'historico', label: 'Histórico' },
      { id: 'relatorio', label: 'Relatório' },
    ];
    return (
      <>
      <div className="flex flex-col h-full">
        <div className="flex-1 bg-white rounded-lg border border-viva-200/80 flex flex-col overflow-hidden">
          <div className="pb-4 border-b border-viva-200 px-4 sm:px-5 flex-shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3 my-3">
              <p className="font-semibold text-viva-900 text-lg">Lista de grupos</p>
              <button
                type="button"
                className="btn btn-primary inline-flex items-center gap-2"
                onClick={() => setViewEscalas('escalas')}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M7 2v4M17 2v4M3 10h18M8 14h8M8 18h5" /></svg>
                Escalas e grades
              </button>
            </div>
            <div className="relative flex items-center gap-2">
              <svg className="absolute left-3 h-5 w-5 text-gray-500 pointer-events-none" fill="currentColor" viewBox="0 0 512 512"><path d="M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9 0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128 128 0 70.7-57.2 128-128 128z" /></svg>
              <input
                type="text"
                placeholder="Procurar grupo"
                value={searchGrupos}
                onChange={(e) => setSearchGrupos(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-base border border-viva-200 rounded-lg outline-none bg-viva-50/50 focus:ring-2 focus:ring-viva-500/30 focus:border-viva-500"
              />
              <Link
                to="/subgrupos-equipes"
                className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-lg bg-viva-100 hover:bg-viva-200 text-viva-800 transition"
                title="Criar subgrupo ou equipe"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </Link>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {subgruposFiltrados.length === 0 ? (
              <div className="p-6 text-center text-viva-700">
                {searchGrupos.trim()
                  ? 'Nenhum subgrupo encontrado para esta busca.'
                  : subgruposComEscala.length === 0 && subgrupos.length > 0
                    ? 'Nenhum subgrupo vinculado a contratos que usam escalas. Vincule subgrupos aos contratos em Contratos ativos (e marque "Usar escalas").'
                    : 'Nenhum subgrupo cadastrado. Use o botão + para criar em Subgrupos e Equipes.'}
              </div>
            ) : (
              <>
                <div>
                  <h2 className="sticky top-0 px-4 py-3 bg-white border-b border-viva-100 text-lg font-bold text-viva-800 shadow-sm z-10">Subgrupos</h2>
                  <div className="flex flex-col gap-0 p-4">
                    {subgruposFiltrados.map((s) => {
                      const countEquipes = s._count?.equipes ?? 0;
                      const isSelected = selectedSubgrupoId === s.id;
                      const contratosComEscala = (s.contratoSubgrupos ?? [])
                        .filter((cs) => cs.contratoAtivo?.usaEscala)
                        .map((cs) => cs.contratoAtivo.nome);
                      const contratosLabel =
                        contratosComEscala.length === 0
                          ? ''
                          : contratosComEscala.length === 1
                            ? `Contrato: ${contratosComEscala[0]}`
                            : `Contratos: ${contratosComEscala.join(', ')}`;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSubgrupoId(isSelected ? null : s.id)}
                          className={`flex items-stretch gap-2 p-3 rounded-lg w-full transition text-left border-b border-viva-100 last:border-b-0 ${isSelected ? 'bg-viva-100 ring-2 ring-viva-500/30' : 'hover:bg-viva-50/80'}`}
                        >
                          <div className="w-1.5 rounded-md bg-viva-500 flex-shrink-0 self-stretch" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-viva-900 truncate">{s.nome}</p>
                            <p className="text-sm text-viva-600">
                              {countEquipes} equipe(s) · {s._count?.escalaSubgrupos ?? 0} escala(s)
                              {contratosLabel ? ` · ${contratosLabel}` : ''}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedSubgrupoId && selectedSubgrupo && (
                  <div>
                    <h2 className="sticky top-0 px-4 py-3 bg-white border-b border-viva-100 text-lg font-bold text-viva-800 shadow-sm z-10">
                      Equipes de {selectedSubgrupo.nome}
                    </h2>
                    <div className="flex flex-col gap-0 p-4">
                      {equipesDoSubgrupoSelecionado.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="text-viva-700 mb-3">Este subgrupo não possui equipe associada ainda.</p>
                          <Link
                            to="/subgrupos-equipes"
                            state={{ subgrupoId: selectedSubgrupoId }}
                            className="text-sm font-semibold text-viva-600 hover:text-viva-800 underline"
                          >
                            Ir para Subgrupos e Equipes para adicionar
                          </Link>
                        </div>
                      ) : (
                        equipesDoSubgrupoSelecionado.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => { setSelectedEquipeId(e.id); setEquipePanelTab('calendario'); }}
                            className="flex items-stretch gap-2 p-3 rounded-lg w-full hover:bg-viva-50/80 transition text-left border-b border-viva-100 last:border-b-0"
                          >
                            <div className="w-1.5 rounded-md bg-viva-500 flex-shrink-0 self-stretch" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-viva-900 truncate">{e.nome}</p>
                              <p className="text-sm text-viva-600">{e.subgrupo?.nome ?? 'Sem subgrupo'}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {selectedEquipeId && selectedEquipe && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setSelectedEquipeId(null)}
            aria-hidden="true"
          />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            <div className="bg-viva-600 flex-shrink-0">
              <div className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setSelectedEquipeId(null)}
                  className="p-2 rounded-lg text-white hover:bg-viva-500 transition"
                  aria-label="Fechar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-semibold truncate">{selectedEquipe.nome}</h2>
                  <p className="text-viva-100 text-sm truncate">{selectedEquipe.subgrupo?.nome ?? 'Sem subgrupo'}</p>
                </div>
                <Link
                  to="/subgrupos-equipes"
                  className="p-2 rounded-lg text-white hover:bg-viva-500 transition"
                  aria-label="Mais opções"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /><circle cx="12" cy="5" r="1" /></svg>
                </Link>
              </div>
            </div>
            <div className="flex items-center overflow-x-auto border-b border-viva-200 flex-shrink-0">
              {equipePanelTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEquipePanelTab(tab.id)}
                  className={`flex flex-col items-center flex-1 min-w-[4.5rem] py-3 text-xs transition ${equipePanelTab === tab.id ? 'bg-viva-50 text-viva-700 border-b-2 border-viva-500 font-semibold' : 'text-gray-500 hover:bg-viva-50/50 hover:text-viva-600'}`}
                >
                  {tab.id === 'calendario' && <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
                  {tab.id === 'editar' && <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>}
                  {tab.id === 'membros' && <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                  {tab.id === 'historico' && <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
                  {tab.id === 'relatorio' && <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {equipePanelTab === 'calendario' && (() => {
                const equipeEscalas = equipeEscalasResp?.data ?? [];
                const equipeSemEscala = equipeEscalas.length === 0;
                const carregandoEscalas = !!selectedEquipeId && equipeEscalasResp === undefined;
                if (carregandoEscalas) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-viva-700">
                      <p className="text-sm">Carregando...</p>
                    </div>
                  );
                }
                if (equipeSemEscala) {
                  return (
                    <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center py-8 px-4 text-center">
                      <div className="rounded-full bg-amber-100 p-4 mb-4">
                        <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                      <h3 className="text-lg font-semibold text-viva-900 mb-2">Nenhuma escala vinculada</h3>
                      <p className="text-sm text-gray-600 mb-4">O subgrupo desta equipe ainda não possui escala. Crie uma escala e vincule o subgrupo e a equipe para visualizar o calendário.</p>
                      <Link
                        to="/subgrupos-equipes"
                        state={{
                          subgrupoId: selectedEquipe?.subgrupoId ?? selectedEquipe?.subgrupo?.id ?? '',
                          equipeId: selectedEquipeId ?? '',
                        }}
                        className="btn btn-primary"
                      >
                        Criar escala e vincular
                      </Link>
                    </div>
                  );
                }
                const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                const year = calendarViewDate.getFullYear();
                const month = calendarViewDate.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDate = new Date(year, month + 1, 0).getDate();
                const startOffset = firstDay.getDay();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                const isPastDay = (day: number) => {
                  const d = new Date(year, month, day);
                  d.setHours(0, 0, 0, 0);
                  return d.getTime() < today.getTime();
                };
                const cells: (number | null)[] = [];
                for (let i = 0; i < startOffset; i++) cells.push(null);
                for (let d = 1; d <= lastDate; d++) cells.push(d);
                while (cells.length < 42) cells.push(null);
                return (
                  <div className="w-full max-w-sm mx-auto">
                    <div className="flex flex-col w-full bg-white rounded-lg border border-viva-100 overflow-hidden">
                      <header className="flex items-center justify-between p-4 border-b border-viva-100">
                        <button
                          type="button"
                          onClick={() => setCalendarViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
                          className="p-2 rounded-lg text-viva-800 hover:bg-viva-100 transition"
                          aria-label="Mês anterior"
                        >
                          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="w-6 h-6"><path fill="none" d="M0 0h24v24H0V0z" /><path d="M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" /></svg>
                        </button>
                        <div className="flex flex-row gap-2">
                          <span className="text-lg font-semibold text-viva-900">{monthNames[month]}</span>
                          <span className="text-lg font-semibold text-gray-400">{year}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCalendarViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
                          className="p-2 rounded-lg text-viva-800 hover:bg-viva-100 transition"
                          aria-label="Próximo mês"
                        >
                          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="w-6 h-6"><path fill="none" d="M0 0h24v24H0V0z" /><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" /></svg>
                        </button>
                      </header>
                      <div className="grid grid-cols-7 px-3 text-center text-viva-700 my-2 text-sm font-medium">
                        <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5 px-3 pb-4">
                        {cells.map((day, idx) => (
                          <div key={idx} className="w-full aspect-square relative">
                            {day === null ? (
                              <div className="w-full h-full" />
                            ) : (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedCalendarDay({ year, month, day })}
                                onKeyDown={(e) => e.key === 'Enter' && setSelectedCalendarDay({ year, month, day })}
                                className={`flex items-center justify-center w-full h-full rounded-lg cursor-pointer transition ${
                                  isToday(day)
                                    ? 'bg-gray-200 border-2 border-white ring-4 ring-viva-500 font-bold text-gray-900'
                                    : isPastDay(day)
                                      ? 'bg-gray-200 opacity-50 text-gray-400 font-medium'
                                      : 'bg-gray-200 hover:bg-gray-300 font-medium text-gray-900'
                                }`}
                              >
                                <span>{day}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {equipePanelTab === 'editar' && (() => {
                const equipeEscalas = equipeEscalasResp?.data ?? [];
                const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                const getEscalaForMonth = (year: number, month1Based: number): Escala | null => {
                  // Considera que uma escala vale para o intervalo entre dataInicio e dataFim.
                  // Se esse intervalo inclui qualquer dia do mês em questão, ela é a escala daquele mês.
                  const firstDay = new Date(year, month1Based - 1, 1);
                  const lastDay = new Date(year, month1Based, 0);
                  for (const e of equipeEscalas) {
                    const inicio = new Date(e.dataInicio);
                    const fim = new Date(e.dataFim);
                    if (inicio <= lastDay && fim >= firstDay) return e;
                  }
                  return null;
                };
                return (
                  <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                    <p className="text-xl text-center my-2 font-display font-semibold text-viva-900">Gerenciamento de escalas</p>
                    <div className="flex flex-row my-2 items-center border border-viva-200 rounded-xl p-3 justify-between mb-3">
                      <button
                        type="button"
                        onClick={() => setEditarEscalaYear((y) => y - 1)}
                        className="p-2 rounded-lg text-viva-600 hover:bg-viva-100 transition-colors"
                        aria-label="Ano anterior"
                      >
                        <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M257.5 445.1l-22.2 22.2c-9.4 9.4-24.6 9.4-33.9 0L7 273c-9.4-9.4-9.4-24.6 0-33.9L201.4 44.7c9.4-9.4 24.6-9.4 33.9 0l22.2 22.2c9.5 9.5 9.3 25-.4 34.3L136.6 216H424c13.3 0 24 10.7 24 24v32c0 13.3-10.7 24-24 24H136.6l120.5 114.8c9.8 9.3 10 24.8.4 34.3z" /></svg>
                      </button>
                      <span className="text-lg font-semibold text-viva-900 font-display">{editarEscalaYear}</span>
                      <button
                        type="button"
                        onClick={() => setEditarEscalaYear((y) => y + 1)}
                        className="p-2 rounded-lg text-viva-600 hover:bg-viva-100 transition-colors"
                        aria-label="Próximo ano"
                      >
                        <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M190.5 66.9l22.2-22.2c9.4-9.4 24.6-9.4 33.9 0L441 239c9.4 9.4 9.4 24.6 0 33.9L246.6 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.2-22.2c-9.5-9.5-9.3-25 .4-34.3L311.4 296H24c-13.3 0-24-10.7-24-24v-32c0-13.3 10.7-24 24-24h287.4L190.9 101.2c-9.8-9.3-10-24.8-.4-34.3z" /></svg>
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((month1Based) => {
                        const escala = getEscalaForMonth(editarEscalaYear, month1Based);

                        // Regra de status:
                        // - Sem escala: nenhuma escala cobre este mês
                        // - Publicada: existe escala ATIVA e este mês é o mês atualmente aberto na grade (gradeMonthStart)
                        // - Em rascunho: existe escala mas ainda não foi publicada para este mês
                        let status: 'Sem escala' | 'Em rascunho' | 'Publicada' = 'Sem escala';
                        let statusColor = 'text-gray-500';
                        if (escala) {
                          const isMesGradeAtual =
                            gradeMonthStart.getFullYear() === editarEscalaYear &&
                            gradeMonthStart.getMonth() === month1Based - 1;
                          if (escala.ativo && isMesGradeAtual) {
                            status = 'Publicada';
                            statusColor = 'text-viva-600';
                          } else {
                            status = 'Em rascunho';
                            statusColor = 'text-amber-600';
                          }
                        }
                        const now = new Date();
                        const isMesAtual = editarEscalaYear === now.getFullYear() && month1Based === now.getMonth() + 1;
                        return (
                          <div
                            key={month1Based}
                            className={`flex w-full p-3 items-center border-b border-viva-100 last:border-b-0 ${isMesAtual ? 'bg-viva-100/80 ring-1 ring-viva-400/50' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-lg font-semibold text-viva-900 font-display">
                                {monthNames[month1Based - 1]}
                                {isMesAtual && <span className="ml-2 text-xs font-normal text-viva-600">(mês atual)</span>}
                              </p>
                              <p className={`text-sm ${statusColor}`}>{status}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setViewEscalas('escalas');
                                const firstDay = new Date(editarEscalaYear, month1Based - 1, 1);
                                firstDay.setHours(0, 0, 0, 0);
                                setGradeMonthStart(firstDay);
                                if (escala) {
                                  setSelectedEscalaId(escala.id);
                                } else {
                                  // Nenhuma escala para este mês ainda: apenas abrimos a view de escalas
                                  // com o mês correto selecionado; o usuário pode criar uma nova escala.
                                  setSelectedEscalaId('');
                                }
                              }}
                              className="btn btn-secondary text-sm shrink-0"
                            >
                              Editar escala
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {equipePanelTab === 'membros' && (() => {
                const equipeMedicos = equipeMedicosResp?.data ?? [];
                const equipeEscalas = equipeEscalasResp?.data ?? [];
                const escalaAtualDaEquipe = selectedEscalaId && equipeEscalas.some((e: { id: string }) => e.id === selectedEscalaId);
                const alocadosIds = escalaAtualDaEquipe ? new Set(alocacoes.map((a: { medicoId: string }) => a.medicoId)) : new Set<string>();
                return (
                  <div className="py-2">
                    <p className="font-medium text-viva-900 mb-3">Membros da equipe</p>
                    {!selectedEquipeId ? (
                      <p className="text-sm text-gray-500">Selecione uma equipe para ver os profissionais.</p>
                    ) : equipeMedicos.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum profissional vinculado a esta equipe.</p>
                    ) : (
                      <ul className="space-y-2">
                        {equipeMedicos.map((em: { id: string; medicoId: string; medico?: { nomeCompleto: string; crm?: string | null } }) => (
                          <li
                            key={em.id}
                            className="flex items-center justify-between border border-viva-200 rounded-lg px-3 py-2 bg-white"
                          >
                            <div>
                              <p className="font-medium text-viva-900 text-sm">{em.medico?.nomeCompleto ?? '—'}</p>
                              {em.medico?.crm && (
                                <p className="text-xs text-viva-600">CRM: {em.medico.crm}</p>
                              )}
                            </div>
                            {escalaAtualDaEquipe && alocadosIds.has(em.medicoId) && (
                              <span className="text-[10px] font-medium text-viva-600 bg-viva-100 px-2 py-0.5 rounded">Alocado na escala</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}
              {equipePanelTab === 'historico' && (() => {
                const historico: {
                  id: string;
                  data: Date;
                  tipo: 'alocacao' | 'plantao';
                  titulo: string;
                  descricao: string;
                }[] = [];

                // Alocações na escala (médicos vinculados à escala)
                for (const a of alocacoes as { id: string; medicoId: string; medico: { nomeCompleto: string; crm: string | null }; createdAt?: string }[]) {
                  if (!a.createdAt) continue;
                  historico.push({
                    id: `aloc-${a.id}`,
                    data: new Date(a.createdAt),
                    tipo: 'alocacao',
                    titulo: `Médico alocado na escala`,
                    descricao: `${a.medico.nomeCompleto} (${a.medico.crm ?? 'CRM não informado'})`,
                  });
                }

                // Plantões do mês (escala x dia x turno)
                for (const p of plantoesMonth as {
                  id: string;
                  data: string;
                  gradeId: string;
                  medico: { nomeCompleto: string; crm: string };
                }[]) {
                  const d = new Date(p.data);
                  const grade = DEFAULT_GRADES.find((g) => g.id === p.gradeId);
                  historico.push({
                    id: `plantao-${p.id}`,
                    data: d,
                    tipo: 'plantao',
                    titulo: `Plantão ${grade?.label ?? ''} atribuído`,
                    descricao: `${p.medico.nomeCompleto} (${p.medico.crm}) · ${formatDayShort(d)} · ${grade?.horario ?? ''}`,
                  });
                }

                historico.sort((a, b) => b.data.getTime() - a.data.getTime());

                if (historico.length === 0) {
                  return (
                    <div className="text-center py-8 text-viva-700">
                      <p className="font-medium mb-1">Histórico da escala</p>
                      <p className="text-sm">Nenhuma atividade registrada nesta escala até o momento.</p>
                    </div>
                  );
                }

                return (
                  <div className="py-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-viva-600 font-display mb-4">
                      Histórico da escala
                    </p>
                    <ul className="space-y-3">
                      {historico.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 rounded-xl border border-viva-200/70 bg-viva-50/40 px-3 py-2.5"
                        >
                          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-viva-200 text-viva-800 text-xs font-display">
                            {item.tipo === 'alocacao' ? 'AL' : 'PL'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-viva-600 font-serif">
                              {item.data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-sm font-medium text-viva-900 font-display leading-tight">
                              {item.titulo}
                            </p>
                            <p className="text-xs text-viva-700 font-serif mt-0.5">
                              {item.descricao}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
              {equipePanelTab === 'relatorio' && (
                <div className="text-center py-8 text-viva-700">
                  <p className="font-medium mb-1">Relatório</p>
                  <p className="text-sm">Em breve: relatórios da equipe.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {selectedCalendarDay && (() => {
        const { year, month, day } = selectedCalendarDay;
        const selDate = new Date(year, month, day);
        const weekStart = new Date(selDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekDates: Date[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + i);
          weekDates.push(d);
        }
        const dayNamesShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const isSelectedDay = (d: Date) => d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const isPastDay = (d: Date) => {
          const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          return dStart.getTime() < todayStart.getTime();
        };
        const goPrevWeek = () => {
          const d = new Date(year, month, day);
          d.setDate(d.getDate() - 7);
          setSelectedCalendarDay({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() });
        };
        const goNextWeek = () => {
          const d = new Date(year, month, day);
          d.setDate(d.getDate() + 7);
          setSelectedCalendarDay({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() });
        };
        return (
          <>
            <div
              className="fixed inset-0 bg-black/30 z-[60]"
              onClick={() => setSelectedCalendarDay(null)}
              aria-hidden="true"
            />
            <div className="flex flex-col fixed right-0 top-0 h-screen bg-white shadow-lg z-[70] transition-transform w-full sm:w-[650px] rounded-tl-lg rounded-tr-lg">
              <div className="p-5 flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center border-b py-4 border-gray-200 flex-shrink-0">
                  <h2 className="text-xl font-semibold text-gray-800">Plantões do dia</h2>
                  <button
                    type="button"
                    onClick={() => setSelectedCalendarDay(null)}
                    className="p-1 rounded text-gray-500 hover:text-gray-700 hover:scale-110 transition-transform"
                    aria-label="Fechar"
                  >
                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 352 512" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z" /></svg>
                  </button>
                </div>
                <div className="flex items-center gap-3 p-3 my-2 flex-shrink-0 font-display">
                  <button type="button" onClick={goPrevWeek} className="p-2 rounded-xl text-viva-600 hover:bg-viva-100 transition-colors" aria-label="Semana anterior">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6l6 6" /></svg>
                  </button>
                  <div className="flex flex-1 justify-center gap-2">
                    {weekDates.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedCalendarDay({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() })}
                        className={`flex flex-col items-center justify-center min-w-[12%] py-2 rounded-xl transition-all duration-200 ${
                          isPastDay(d)
                            ? 'bg-gray-300 text-gray-600 cursor-default'
                            : isSelectedDay(d)
                              ? 'bg-viva-600 text-white border-2 border-white shadow-[0_0_0_2px] shadow-viva-500'
                              : 'bg-viva-500 text-white/95 hover:bg-viva-600 hover:text-white'
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">{dayNamesShort[d.getDay()]}</span>
                        <span className="text-base font-bold tabular-nums mt-0.5">{d.getDate()}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={goNextWeek} className="p-2 rounded-xl text-viva-600 hover:bg-viva-100 transition-colors" aria-label="Próxima semana">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6l-6 6" /></svg>
                  </button>
                </div>
                <hr className="border-gray-200 flex-shrink-0" />
                <div className="w-full flex justify-center flex-shrink-0 py-2">
                  <div className="relative w-64 h-10 bg-gray-100 rounded-lg flex items-center">
                    <div
                      className={`absolute top-0 bottom-0 w-1/2 rounded-lg transition-transform duration-300 ${plantaoViewMode === 'dinamica' ? 'translate-x-0' : 'translate-x-full'}`}
                      style={{ background: 'rgb(37, 111, 255)' }}
                    />
                    <button type="button" onClick={() => setPlantaoViewMode('dinamica')} className={`w-1/2 z-10 text-center text-sm font-medium transition-colors duration-300 py-2 rounded-l-lg ${plantaoViewMode === 'dinamica' ? 'text-white' : 'text-gray-700'}`}>Dinâmica</button>
                    <button type="button" onClick={() => setPlantaoViewMode('fixa')} className={`w-1/2 z-10 text-center text-sm font-medium transition-colors duration-300 py-2 rounded-r-lg ${plantaoViewMode === 'fixa' ? 'text-white' : 'text-gray-700'}`}>Fixa</button>
                  </div>
                </div>
                <hr className="border-gray-200 flex-shrink-0" />
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <div className="flex-1 overflow-auto">
                    {(() => {
                      const plantoesDia = equipePlantoesDiaResp?.data ?? [];
                      const horarioLabel = (g: (typeof DEFAULT_GRADES)[0]) =>
                        `${g.regua[0].replace(':', 'h')} às ${g.regua[1].replace(':', 'h')}`;
                      return DEFAULT_GRADES.map((grade) => {
                        const alocados = plantoesDia.filter((p) => p.gradeId === grade.id);
                        return (
                          <div key={grade.id} className="rounded-xl overflow-hidden my-2">
                            <div className="p-4 text-white uppercase font-bold text-lg bg-viva-500 font-display">
                              <p>{grade.label} - {horarioLabel(grade)}</p>
                            </div>
                            <div className="w-full flex flex-wrap gap-2 border border-viva-200 rounded-b-xl p-2 bg-white">
                              {alocados.length === 0 ? (
                                <p className="text-sm text-viva-600 py-2 font-serif">Nenhum profissional alocado</p>
                              ) : (
                                alocados.map((p) => (
                                  <div key={p.id} className="relative cursor-pointer flex flex-col items-center" title={p.medico.nomeCompleto}>
                                    <img
                                      alt={p.medico.nomeCompleto}
                                      className="w-14 h-14 rounded-full bg-viva-100 object-cover border-2 border-viva-200"
                                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.medico.nomeCompleto)}&background=F1F2F6&color=1C1F24&bold=true&size=256`}
                                    />
                                    <span className="text-xs font-medium text-viva-800 mt-1 text-center line-clamp-2 max-w-[5rem]">{shortName(p.medico.nomeCompleto)}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-viva-600 mb-2 font-display">
          Área Master
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-viva-900 font-display leading-tight mb-2">
          Escalas
        </h1>
        <p className="text-viva-700 font-serif text-base">
          Cadastre escalas, associe contratos ativos e aloque médicos na grade semanal.
        </p>
      </div>

      <div className="card border-l-4 border-l-viva-500 stagger-2 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-viva-50/60 to-transparent">
        <p className="text-viva-900 font-medium text-sm font-display">
          Subgrupos e equipes definem a estrutura dos plantões e valores.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2"
            onClick={() => setViewEscalas('grupos')}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            Lista de grupos
          </button>
          <Link to="/subgrupos-equipes" className="btn btn-secondary inline-flex items-center gap-2">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
            Gerenciar Subgrupos e Equipes
          </Link>
        </div>
      </div>

      <main className="min-h-[calc(100vh-12rem)] flex flex-col p-5 bg-viva-100/30 flex-1 overflow-hidden">
        <div className="flex-1 bg-white rounded-xl overflow-hidden flex flex-col shadow-sm border border-viva-200/60">
          {!selectedEscalaId ? (
            <>
              <div className="flex items-center justify-between gap-4 p-4 border-b border-viva-200/80 flex-wrap">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-viva-600 font-display">Escalas</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    className="input max-w-xs"
                    value={selectedEscalaId}
                    onChange={(e) => setSelectedEscalaId(e.target.value)}
                  >
                    <option value="">Selecione uma escala</option>
                    {escalas.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-primary" onClick={() => { setForm({ ...emptyForm, ...getDefaultScaleDates() }); setEditingEscalaId(null); setError(null); setEscalaFormModalOpen(true); }}>
                    Nova escala
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                {loadingEscalas ? (
                  <p className="text-sm text-viva-700 font-serif">Carregando escalas...</p>
                ) : escalas.length === 0 ? (
                  <p className="text-sm text-viva-700 font-serif">Nenhuma escala cadastrada. Clique em &quot;Nova escala&quot; para criar.</p>
                ) : (
                  <div className="space-y-2">
                    {escalas.map((escala) => (
                      <div
                        key={escala.id}
                        className="border rounded-xl p-3 transition border-viva-200/80 bg-viva-50/30 hover:bg-viva-50/50 flex flex-wrap items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          className="text-left min-w-0 flex-1"
                          onClick={() => setSelectedEscalaId(escala.id)}
                        >
                          <p className="font-semibold text-viva-900 text-sm font-display">{escala.nome}</p>
                          <p className="text-[10px] text-viva-600 mt-0.5 font-serif">
                            {escala.contratoAtivo?.nome || '-'} · {toDateInput(escala.dataInicio)} até {toDateInput(escala.dataFim)} · Alocados: {escala._count?.alocacoes ?? 0}
                          </p>
                        </button>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" className="btn-sm btn-secondary" onClick={() => { startEdit(escala); setEscalaFormModalOpen(true); }}>Editar</button>
                          <button type="button" className="btn-sm btn-secondary" onClick={() => deleteEscala(escala)}>Excluir</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center p-4 justify-between shrink-0 bg-viva-600 text-white" style={{ background: 'rgb(37, 111, 255)' }}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-white/20"
                    onClick={() => setSelectedEscalaId('')}
                    aria-label="Voltar"
                  >
                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M257.5 445.1l-22.2 22.2c-9.4 9.4-24.6 9.4-33.9 0L7 273c-9.4-9.4-9.4-24.6 0-33.9L201.4 44.7c9.4-9.4 24.6-9.4 33.9 0l22.2 22.2c9.5 9.5 9.3 25-.4 34.3L136.6 216H424c13.3 0 24 10.7 24 24v32c0 13.3-10.7 24-24 24H136.6l120.5 114.8c9.8 9.3 10 24.8.4 34.3z" /></svg>
                  </button>
                  <div>
                    <p className="font-semibold text-white font-display">{selectedEscala?.nome ?? 'Escala'}</p>
                    <p className="text-white/90 text-sm">{selectedEscala?.contratoAtivo?.nome ?? '-'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white font-display">
                    {gradeMonthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <button type="button" className="text-white/90 hover:underline text-sm" onClick={() => setGradeMonthStart((d) => { const x = new Date(d); x.setMonth(x.getMonth() - 1); return x; })}>← Anterior</button>
                    <button type="button" className="text-white/90 hover:underline text-sm" onClick={() => setGradeMonthStart((d) => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x; })}>Próximo →</button>
                  </div>
                </div>
              </div>
              <div className="overflow-hidden p-3 flex-1 flex min-h-0">
                <div className="relative flex-1 flex flex-col overflow-y-auto overflow-x-auto min-w-0">
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr>
                        <th className="text-center border border-viva-200 p-1.5 font-semibold text-viva-800 font-display w-0 whitespace-nowrap">Nome</th>
                        <th className="text-center border border-viva-200 p-1.5 font-semibold text-viva-800 font-display w-0 whitespace-nowrap">Turno</th>
                        {Array.from({ length: gradeMonthEnd.getDate() }, (_, i) => i + 1).map((day) => {
                          const d = new Date(gradeMonthStart.getFullYear(), gradeMonthStart.getMonth(), day);
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const dayLetters = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
                          return (
                            <th key={day} className={`text-center border p-1 min-w-[32px] ${isWeekend ? 'bg-viva-200/60 border-viva-300' : 'border-viva-200'}`}>
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
                      {(() => {
                        const busca = gradeBuscaProfissional.trim().toLowerCase();
                        const equipeMedicosList = equipeIdParaGrade && Array.isArray(equipeMedicosResp?.data)
                          ? (equipeMedicosResp!.data as { medicoId: string; medico?: { nomeCompleto: string; crm?: string | null } }[]).map((em) => ({
                              label: em.medico?.nomeCompleto ?? '—',
                              medicoId: em.medicoId,
                              crm: em.medico?.crm ?? '',
                            }))
                          : null;
                        const baseList =
                          equipeMedicosList !== null
                            ? equipeMedicosList
                            : alocacoes.map((a) => ({
                                label: a.medico.nomeCompleto,
                                medicoId: a.medico.id,
                                crm: a.medico.crm ?? '',
                              }));
                        const filtrados = busca
                          ? baseList.filter(
                              (r) =>
                                r.label.toLowerCase().includes(busca) || (r.crm && r.crm.toLowerCase().includes(busca))
                            )
                          : baseList;
                        return [
                          { label: 'Plantão Vago', medicoId: '' },
                          ...filtrados.map((r) => ({ label: r.label, medicoId: r.medicoId })),
                        ];
                      })().map((row, rowGroupIndex) =>
                        DEFAULT_GRADES.map((grade, gradeSubIndex) => {
                          const gradeId = grade.id;
                          return (
                            <tr key={`${rowGroupIndex}-${gradeSubIndex}`} className={gradeSubIndex === DEFAULT_GRADES.length - 1 ? 'tr-last' : ''}>
                              {gradeSubIndex === 0 ? (
                                <td
                                  className={`border border-viva-200 p-1.5 align-top ${row.medicoId === '' ? 'bg-viva-50/40' : 'bg-white'}`}
                                  rowSpan={DEFAULT_GRADES.length}
                                >
                                  <p className="font-medium text-viva-900 text-xs">{row.label}</p>
                                  <div className="text-[10px] text-viva-600">0h</div>
                                </td>
                              ) : null}
                              <td className="text-center border border-viva-200 p-1 text-viva-700 text-xs whitespace-nowrap">
                                <span className="font-medium">{grade.label}</span> - {grade.regua[0]} até {grade.regua[1]}
                              </td>
                              {Array.from({ length: gradeMonthEnd.getDate() }, (_, i) => i + 1).map((day) => {
                                const d = new Date(gradeMonthStart.getFullYear(), gradeMonthStart.getMonth(), day);
                                const dateStr = dateToInput(d);
                                const key = `${dateStr}_${gradeId}`;
                                const cell = plantaoMapMonth.get(key);
                                const showInCell = row.medicoId ? cell?.medico.id === row.medicoId : false;
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                const vagas = row.medicoId === '' ? (plantaoVagoSlots[key] ?? 0) : 0;
                                return (
                                  <td
                                    key={day}
                                    className={`border p-0 cursor-pointer min-w-[32px] ${isWeekend ? 'bg-viva-200/40 border-viva-300' : 'border-viva-200'}`}
                                    onClick={async () => {
                                      // Plantão Vago: abre modal para definir vagas
                                      if (row.medicoId === '') {
                                        const currentVagas = plantaoVagoSlots[key] ?? 0;
                                        if (currentVagas > 0) {
                                          setConfirmClearVagas({
                                            open: true,
                                            key,
                                            label: `${formatDayShort(d)} · ${grade.label}`,
                                          });
                                        } else {
                                          setCellModal({
                                            open: true,
                                            grade,
                                            date: d,
                                            medico: cell?.medico ?? null,
                                            plantaoId: cell?.plantaoId,
                                            isPlantaoVagoRow: true,
                                          });
                                        }
                                        return;
                                      }

                                      if (!selectedEscalaId || !row.medicoId) return;

                                      // Toggle tipo "select": se já está alocado para este médico, remove; senão, aloca.
                                      const isSameMedico = !!cell && cell.medico.id === row.medicoId;

                                      const opKey = key;
                                      setPendingPlantaoKey(opKey);
                                      setLoadingAction(true);
                                      setError(null);
                                      try {
                                        if (isSameMedico && cell?.plantaoId) {
                                          // Desalocar plantão desta célula
                                          await adminService.removerEscalaPlantao(selectedEscalaId, cell.plantaoId);
                                        } else {
                                          // Alocar este médico neste dia/turno
                                          await adminService.createEscalaPlantao(selectedEscalaId, {
                                            data: dateStr,
                                            gradeId,
                                            medicoId: row.medicoId,
                                            valorHora: grade ? valorByGrade.get(grade.id) ?? null : null,
                                          });
                                        }
                                        invalidatePlantoes();
                                      } catch (err: any) {
                                        setError(err.response?.data?.error || 'Erro ao alterar plantão');
                                      } finally {
                                        setLoadingAction(false);
                                        setPendingPlantaoKey((prev) => (prev === opKey ? null : prev));
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-center min-h-[40px] text-[11px] text-viva-800">
                                      {row.medicoId === '' ? (
                                        vagas > 0 ? (
                                          <div
                                            className="w-[26px] h-[26px] rounded-full overflow-hidden border-2 border-viva-600 bg-[#F1F2F6] text-viva-900 shadow-sm flex items-center justify-center text-[11px] font-semibold"
                                            title={`${vagas} vaga${vagas > 1 ? 's' : ''} em aberto`}
                                          >
                                            {vagas}
                                          </div>
                                        ) : (
                                          ''
                                        )
                                      ) : pendingPlantaoKey === key && !cell ? (
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-viva-500/70">
                                          <span className="h-3 w-3 border-2 border-viva-500 border-t-transparent rounded-full animate-spin" />
                                        </span>
                                      ) : showInCell && cell ? (
                                        <div className="w-[30px] laptop:w-[24px] aspect-square rounded-full overflow-hidden border-2 border-viva-600 shadow-sm" title={cell.medico.nomeCompleto}>
                                          <img
                                            className="w-full h-full object-cover"
                                            alt={cell.medico.nomeCompleto}
                                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                              cell.medico.nomeCompleto
                                            )}&background=F1F2F6&color=256F3F&bold=true&size=256`}
                                          />
                                        </div>
                                      ) : (
                                        ''
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-between gap-2 border-t border-viva-200 p-3 items-center flex-wrap shrink-0">
                <div className="flex-1 min-w-[200px] max-w-md">
                  <input
                    type="text"
                    className="input w-full py-2"
                    placeholder="Quem gostaria de encontrar?"
                    value={gradeBuscaProfissional}
                    onChange={(e) => setGradeBuscaProfissional(e.target.value)}
                  />
                </div>
                <p className={`text-sm whitespace-nowrap font-medium ${!selectedEscala ? 'text-gray-500' : selectedEscala.ativo ? 'text-viva-600' : 'text-amber-600'}`}>
                  {!selectedEscala ? 'Sem escala' : selectedEscala.ativo ? 'Publicada' : 'Em rascunho'}
                </p>
                <div className="flex gap-2 items-center flex-wrap">
                  <button type="button" className="btn btn-secondary text-sm">Imprimir</button>
                  <button type="button" className="btn btn-secondary text-sm">Revisar</button>
                  <button type="button" className="btn btn-secondary text-sm">Replicar</button>
                  <button
                    type="button"
                    className="btn btn-primary text-sm"
                    disabled={!selectedEscala || selectedEscala.ativo || loadingAction}
                    onClick={async () => {
                      if (!selectedEscala?.id || selectedEscala.ativo) return;
                      setLoadingAction(true);
                      try {
                        await adminService.updateEscala(selectedEscala.id, { ativo: true });
                        await invalidateEscalas();
                        await queryClient.invalidateQueries({ queryKey: ['admin', 'equipes'] });
                      } finally {
                        setLoadingAction(false);
                      }
                    }}
                  >
                    Publicar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {escalaFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => resetForm()}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-viva-600 mb-4 font-display">{editingEscalaId ? 'Editar escala' : 'Nova escala'}</h3>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submitEscala}>
              <select className="input" value={form.contratoAtivoId} onChange={(e) => setForm((prev) => ({ ...prev, contratoAtivoId: e.target.value }))}>
                <option value="">Selecione um contrato ativo</option>
                {contratos.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
              </select>
              <input className="input" placeholder="Nome da escala" value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
              <textarea className="input md:col-span-2 min-h-[90px]" placeholder="Descrição (opcional)" value={form.descricao} onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))} />
              <label className="flex items-center gap-2 text-xs font-medium text-viva-900 font-display">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))} />
                Escala ativa
              </label>
              {error && <p className="md:col-span-2 text-sm text-red-600 font-medium">{error}</p>}
              <div className="md:col-span-2 flex gap-2">
                <button className="btn btn-primary" type="submit" disabled={loadingAction}>{editingEscalaId ? 'Salvar alterações' : 'Criar escala'}</button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

          {selectedEscalaId && (
        <div className="card stagger-5 hidden">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-viva-600 mb-4 font-display">Alocação de médicos na escala</h3>
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
                      <li className="px-3 py-2 text-sm text-viva-600 font-serif">Nenhum médico encontrado</li>
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
            <p className="text-sm text-viva-700 font-serif">Nenhum médico alocado.</p>
          ) : (
            <div className="space-y-2">
              {alocacoes.map((a) => (
                <div key={a.id} className="border border-viva-200 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-viva-900">{a.medico.nomeCompleto}</p>
                    <p className="text-[10px] text-viva-600 font-serif">
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

      {cellModal.open && cellModal.grade && cellModal.date && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setCellModal((m) => ({ ...m, open: false }))}
        >
          <div
            className="bg-white rounded-3xl shadow-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {cellModal.isPlantaoVagoRow ? (
              /* Modal Plantão Vago: divulgar quantidade de vagas */
              <div className="relative flex flex-col items-center p-6">
                <h2 className="text-lg font-bold text-viva-900 font-display">Plantão Vago</h2>
                <button
                  type="button"
                  className="absolute top-4 right-4 p-1 rounded-lg hover:bg-viva-100 text-viva-600"
                  onClick={() => setCellModal((m) => ({ ...m, open: false }))}
                  aria-label="Fechar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-viva-500 text-white mt-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" strokeWidth="0"><path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" /></svg>
                </span>
                <p className="text-xs text-viva-600 mt-2">{cellModal.grade?.label} – {cellModal.date && formatDayShort(cellModal.date)}</p>
                <div className="w-full mt-4">
                  <label className="block text-sm font-medium text-viva-800 mb-1">Quantidade de vagas</label>
                  <select
                    className="input w-full cursor-pointer"
                    value={plantaoVagoVagas}
                    onChange={(e) => setPlantaoVagoVagas(Number(e.target.value))}
                  >
                    {Array.from({ length: 21 }, (_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-primary w-full mt-4"
                  onClick={() => {
                    if (!cellModal.grade || !cellModal.date) {
                      setCellModal((m) => ({ ...m, open: false }));
                      return;
                    }
                    const key = `${dateToInput(cellModal.date)}_${cellModal.grade.id}`;
                    setPlantaoVagoSlots((prev) => ({
                      ...prev,
                      [key]: plantaoVagoVagas,
                    }));
                    setCellModal((m) => ({ ...m, open: false }));
                  }}
                >
                  Confirmar
                </button>
              </div>
            ) : (
              <>
            {/* Header: turno com destaque */}
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-viva-200/80 bg-gradient-to-br from-viva-50/80 to-white">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-viva-500 text-white shadow-sm">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-viva-900 font-display tracking-tight">
                    {cellModal.grade.label} · {cellModal.grade.tipo}
                  </h2>
                  <p className="text-[11px] text-viva-600 font-medium mt-0.5">
                    {cellModal.grade.regua?.join(' – ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-viva-200/80 text-viva-600 transition-colors shrink-0"
                onClick={() => setCellModal((m) => ({ ...m, open: false }))}
                aria-label="Fechar"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Data e valor: chip destacado */}
            <div className="px-5 py-4 border-b border-viva-100">
              <div className="flex items-center gap-2 text-viva-700">
                <svg className="h-4 w-4 text-viva-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                <span className="font-medium font-display text-sm">
                  {formatDayShort(cellModal.date)} · {formatDayName(cellModal.date)}
                </span>
                <span className="text-viva-400">·</span>
                <span className="text-sm font-serif text-viva-700">{cellModal.grade.horario}</span>
              </div>
              {(valorByGrade.get(cellModal.grade.id) != null || plantaoSlotValor != null || alocacaoParaValor?.valorHora != null) && (
                <p className="mt-2 text-xs font-semibold text-viva-700 font-display">
                  Valor do plantão: {formatValorHora(plantaoSlotValor ?? valorByGrade.get(cellModal.grade.id) ?? alocacaoParaValor?.valorHora)}
                </p>
              )}
            </div>

            {/* Conteúdo rolável */}
            <div className="px-5 py-5 overflow-y-auto flex-1">
              {cellModal.medico ? (
                <div className="rounded-2xl border border-viva-200 bg-gradient-to-br from-white to-viva-50/30 p-4 mb-5">
                  <p className="font-semibold text-viva-900 font-display">{cellModal.medico.nomeCompleto}</p>
                  <p className="text-xs text-viva-600 mt-0.5">CRM: {cellModal.medico.crm}</p>
                  {(cellModal.medico.telefone || cellModal.medico.email) && (
                    <p className="text-xs text-viva-600 mt-0.5">{cellModal.medico.telefone || cellModal.medico.email}</p>
                  )}
                  <p className="text-[10px] text-viva-500 mt-2 font-serif">{cellModal.grade.horario}</p>
                  {(plantaoSlotValor != null || valorByGrade.get(cellModal.grade.id) != null || alocacaoParaValor?.valorHora != null) && (
                    <p className="text-xs font-medium text-viva-700 mt-1">Valor: {formatValorHora(plantaoSlotValor ?? valorByGrade.get(cellModal.grade.id) ?? alocacaoParaValor?.valorHora)}</p>
                  )}
                  {cellModal.plantaoId && (
                    <button
                      type="button"
                      className="btn btn-secondary mt-3 text-sm"
                      onClick={removerPlantaoDaCelula}
                      disabled={loadingAction}
                    >
                      Remover deste plantão
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-viva-700 font-serif mb-5 rounded-xl bg-viva-50/50 border border-viva-200/60 px-3 py-2.5">
                  Sem profissional atribuído a este plantão.
                </p>
              )}

              {/* CTA: Atribuir médico (destaque visual) */}
              <div className="rounded-2xl border-l-4 border-l-viva-500 bg-gradient-to-r from-viva-50/60 to-transparent p-4 mb-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-viva-700 font-display mb-3">
                  Atribuir médico a este plantão
                </h3>
                <div className="flex gap-2 flex-wrap items-end">
                  <div ref={medicoAllocateCellRef} className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Pesquisar por nome ou CRM..."
                      value={
                        medicoIdToAllocateCell && medicos.length > 0
                          ? medicoAllocateCellOpen
                            ? medicoAllocateCellSearch
                            : (medicos.find((m) => m.id === medicoIdToAllocateCell)?.nomeCompleto ?? '') + ' (' + (medicos.find((m) => m.id === medicoIdToAllocateCell)?.crm ?? '') + ')'
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
                      <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-viva-200 bg-white shadow-lg py-1">
                        {(() => {
                          const searchLower = medicoAllocateCellSearch.trim().toLowerCase();
                          const filtered = medicos.filter((m) => {
                            if (!searchLower) return true;
                            const nome = (m.nomeCompleto ?? '').toLowerCase();
                            const crm = (m.crm ?? '').toLowerCase();
                            return nome.includes(searchLower) || crm.includes(searchLower);
                          });
                          return filtered.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-viva-600 font-serif">Nenhum médico encontrado</li>
                          ) : (
                            filtered.map((m) => (
                              <li
                                key={m.id}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-viva-100 text-viva-900 font-display"
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
                    className="btn btn-primary shrink-0"
                    onClick={alocarMedicoNoPlantao}
                    disabled={loadingAction || !medicoIdToAllocateCell}
                  >
                    Alocar
                  </button>
                </div>
                <p className="text-[11px] text-viva-600 mt-2 font-serif">
                  O médico ficará atribuído a este dia e turno ({cellModal.grade.label} – {formatDayShort(cellModal.date)}).
                </p>
              </div>

              <p className="text-[11px] text-viva-600 font-serif mb-4">
                Valor definido em <Link to="/valores-plantao" className="font-semibold text-viva-800 underline hover:text-viva-900">Valores Hora/Plantão</Link>. Ao alocar, o valor de {cellModal.grade.label} será aplicado.
              </p>

              {(medicoParaReplicar || cellModal.medico) && (
                <div className="pt-4 mt-4 border-t border-viva-200">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-viva-700 font-display mb-2">Repetir para outros dias</h3>
                  <p className="text-xs text-viva-600 font-serif mb-3">
                    Aplica o médico {cellModal.medico ? cellModal.medico.nomeCompleto : (medicos.find((m) => m.id === medicoIdToAllocateCell)?.nomeCompleto ?? 'selecionado')} e o valor no turno {cellModal.grade.label} nos 7 dias desta semana.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary w-full sm:w-auto text-sm"
                    onClick={replicarMedicoNaSemana}
                    disabled={loadingAction || !medicoParaReplicar}
                  >
                    {loadingAction ? 'Aplicando...' : `Repetir na semana (${cellModal.grade.label})`}
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-viva-200 bg-viva-50/30 flex justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCellModal((m) => ({ ...m, open: false }))}
              >
                Fechar
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmClearVagas.open && confirmClearVagas.key && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setConfirmClearVagas({ open: false })}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-viva-600 mb-2 font-display">
              Cancelar vagas em aberto
            </h3>
            <p className="text-sm text-viva-700 font-serif mb-4">
              Remover as vagas de plantão vago para <span className="font-semibold">{confirmClearVagas.label}</span>?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmClearVagas({ open: false })}
              >
                Manter vagas
              </button>
              <button
                type="button"
                className="btn btn-primary bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setPlantaoVagoSlots((prev) => {
                    const copy = { ...prev };
                    delete copy[confirmClearVagas.key!];
                    return copy;
                  });
                  setConfirmClearVagas({ open: false });
                }}
              >
                Remover vagas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Escalas;
