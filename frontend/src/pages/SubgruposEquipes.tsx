import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMasterEscopo } from '../context/MasterEscopoContext';
import { adminService, type AdminMedico } from '../services/admin.service';

const SubgruposEquipes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isMaster = user?.role === 'MASTER';
  const {
    contratoId: selectedContratoId,
    subgrupoId: selectedSubgrupoId,
    equipeId: selectedEquipeId,
    setContratoId: setSelectedContratoId,
    setSubgrupoId: setSelectedSubgrupoId,
    setEquipeId: setSelectedEquipeId,
  } = useMasterEscopo();
  const [subgrupoNome, setSubgrupoNome] = useState('');
  const [equipeNome, setEquipeNome] = useState('');
  const [membrosEquipeBusca, setMembrosEquipeBusca] = useState('');
  const [membrosEquipePickIds, setMembrosEquipePickIds] = useState<string[]>([]);
  const [membrosEquipeError, setMembrosEquipeError] = useState<string | null>(null);
  const [membrosEquipeActionLoading, setMembrosEquipeActionLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [novaEscalaNome, setNovaEscalaNome] = useState('');
  const [confirmExcluir, setConfirmExcluir] = useState<{ tipo: 'subgrupo' | 'equipe'; id: string; nome: string } | null>(null);

  /** Ao vir da página Escalas pelo link "Ir para Subgrupos e Equipes" ou "Criar escala e vincular", pré-selecionar subgrupo e/ou equipe. */
  useEffect(() => {
    const state = location.state as { subgrupoId?: string; equipeId?: string } | null;
    if (!state) return;
    if (state.subgrupoId && typeof state.subgrupoId === 'string') {
      setSelectedSubgrupoId(state.subgrupoId);
    }
    if (state.equipeId && typeof state.equipeId === 'string') {
      setSelectedEquipeId(state.equipeId);
    }
  }, [location.state]);

  const { data: contratosAtivosResp } = useQuery({
    queryKey: ['admin', 'contratos-ativos', 'subgrupos-equipes'],
    queryFn: () => adminService.listContratosAtivos({ page: 1, limit: 200 }),
    enabled: isMaster,
  });
  const { data: equipeEscalasResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId ?? '', 'escalas'],
    queryFn: () => adminService.listEscalasByEquipe(selectedEquipeId!),
    enabled: isMaster && !!selectedEquipeId,
  });
  const { data: medicosResp, isFetching: loadingMedicosLista } = useQuery({
    queryKey: ['admin', 'medicos', 'for-subgrupos'],
    queryFn: () => adminService.listMedicos({ page: 1, limit: 2000, ativo: true }),
    enabled: isMaster,
  });
  const { data: subgruposResp } = useQuery({
    queryKey: ['admin', 'subgrupos'],
    queryFn: () => adminService.listSubgrupos(),
    enabled: isMaster,
  });
  const { data: equipesResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedSubgrupoId || 'todos'],
    queryFn: () => adminService.listEquipes(selectedSubgrupoId ? { subgrupoId: selectedSubgrupoId } : undefined),
    enabled: isMaster,
  });
  const { data: equipeMedicosResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId, 'medicos'],
    queryFn: () => adminService.listEquipeMedicos(selectedEquipeId),
    enabled: isMaster && !!selectedEquipeId,
  });

  const contratosAtivos = useMemo(() => contratosAtivosResp?.data || [], [contratosAtivosResp]);
  const medicos = useMemo(() => medicosResp?.data || [], [medicosResp]);
  const subgrupos = useMemo(() => subgruposResp?.data || [], [subgruposResp]);
  const equipes = useMemo(() => equipesResp?.data || [], [equipesResp]);
  const equipeMedicos = useMemo(() => equipeMedicosResp?.data || [], [equipeMedicosResp]);
  const equipeEscalas = useMemo(() => equipeEscalasResp?.data || [], [equipeEscalasResp]);
  const idsNaEquipe = useMemo(
    () => new Set(equipeMedicos.map((a: { medicoId: string }) => a.medicoId)),
    [equipeMedicos]
  );
  const medicosDisponiveis = useMemo(() => {
    const q = membrosEquipeBusca.trim().toLowerCase();
    return medicos.filter((m: AdminMedico) => {
      if (idsNaEquipe.has(m.id)) return false;
      if (!q) return true;
      const nome = (m.nomeCompleto ?? '').toLowerCase();
      const crm = (m.crm ?? '').toLowerCase();
      return nome.includes(q) || crm.includes(q);
    });
  }, [medicos, idsNaEquipe, membrosEquipeBusca]);
  /** Subgrupos do contrato selecionado (quando há contrato). */
  const subgruposDoContrato = useMemo(() => {
    if (!selectedContratoId) return subgrupos;
    return subgrupos.filter((s) =>
      (s.contratoSubgrupos ?? []).some(
        (cs: { contratoAtivo?: { id: string } }) => cs.contratoAtivo?.id === selectedContratoId
      )
    );
  }, [subgrupos, selectedContratoId]);

  /** Ao vir com subgrupoId no state, definir contrato do subgrupo para exibir no bloco 1. */
  useEffect(() => {
    if (!subgrupos.length || selectedContratoId) return;
    const state = location.state as { subgrupoId?: string } | null;
    const subgrupoId = state?.subgrupoId;
    if (!subgrupoId) return;
    const subgrupo = subgrupos.find((s) => s.id === subgrupoId);
    const contratoId = (subgrupo?.contratoSubgrupos ?? [])[0]?.contratoAtivo?.id;
    if (contratoId) setSelectedContratoId(contratoId);
  }, [subgrupos, location.state, selectedContratoId]);

  useEffect(() => {
    setMembrosEquipePickIds([]);
    setMembrosEquipeBusca('');
    setMembrosEquipeError(null);
  }, [selectedEquipeId]);

  const invalidateSubgrupos = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'subgrupos'] });
    if (selectedSubgrupoId) queryClient.invalidateQueries({ queryKey: ['admin', 'subgrupos', selectedSubgrupoId, 'medicos'] });
  };
  const invalidateEquipes = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'equipes'] });
    if (selectedEquipeId) queryClient.invalidateQueries({ queryKey: ['admin', 'equipes', selectedEquipeId, 'medicos'] });
  };
  const selectedSubgrupo = useMemo(() => subgrupos.find((s) => s.id === selectedSubgrupoId), [subgrupos, selectedSubgrupoId]);
  /** Contrato do subgrupo selecionado que usa escala (para criar escala já associada). */
  const contratoEscalaDoSubgrupo = useMemo(() => {
    const list = selectedSubgrupo?.contratoSubgrupos ?? [];
    const cs = list.find((c: { contratoAtivo?: { id: string; usaEscala: boolean } }) => c.contratoAtivo?.usaEscala);
    return cs?.contratoAtivo?.id ?? '';
  }, [selectedSubgrupo]);

  const criarSubgrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = subgrupoNome.trim();
    if (!nome || !selectedContratoId) return;
    setLoadingAction(true);
    try {
      const res = await adminService.createSubgrupo({ nome });
      const created = res as { data?: { id: string } };
      if (created?.data?.id) {
        await adminService.addContratoSubgrupo(selectedContratoId, created.data.id);
        setSubgrupoNome('');
      }
      await invalidateSubgrupos();
    } finally {
      setLoadingAction(false);
    }
  };
  const criarEquipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = equipeNome.trim();
    if (!nome || !selectedSubgrupoId) return;
    setLoadingAction(true);
    try {
      await adminService.createEquipe({
        nome,
        subgrupoId: selectedSubgrupoId,
      });
      setEquipeNome('');
      await invalidateEquipes();
    } finally {
      setLoadingAction(false);
    }
  };
  const invalidateEscalas = () => queryClient.invalidateQueries({ queryKey: ['admin', 'escalas'] });
  const criarEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = novaEscalaNome.trim();
    if (!nome || !contratoEscalaDoSubgrupo || !selectedSubgrupoId || !selectedEquipeId) return;
    setLoadingAction(true);
    try {
      const ano = new Date().getFullYear();
      const dataInicio = `${ano}-01-01`;
      const dataFim = `${ano + 1}-12-31`;
      const res = await adminService.createEscala({
        contratoAtivoId: contratoEscalaDoSubgrupo,
        nome,
        dataInicio,
        dataFim,
        ativo: false,
      });
      const created = res as { data?: { id: string } };
      if (created?.data?.id) {
        await adminService.addSubgrupoToEscala(created.data.id, selectedSubgrupoId);
        await adminService.addEquipeToEscala(created.data.id, selectedEquipeId);
        setNovaEscalaNome('');
      }
      await invalidateEscalas();
      if (selectedEquipeId) queryClient.invalidateQueries({ queryKey: ['admin', 'equipes', selectedEquipeId, 'escalas'] });
    } finally {
      setLoadingAction(false);
    }
  };
  const toggleMembrosEquipePick = (medicoId: string) => {
    setMembrosEquipePickIds((prev) =>
      prev.includes(medicoId) ? prev.filter((id) => id !== medicoId) : [...prev, medicoId]
    );
  };

  const adicionarMedicoNaEquipeUm = async (medicoId: string) => {
    if (!selectedEquipeId) return;
    setMembrosEquipeError(null);
    setMembrosEquipeActionLoading(true);
    try {
      await adminService.addMedicoToEquipe(selectedEquipeId, medicoId);
      setMembrosEquipePickIds((prev) => prev.filter((id) => id !== medicoId));
    } catch (err: any) {
      setMembrosEquipeError(err.response?.data?.error || err.message || 'Erro ao adicionar');
    } finally {
      setMembrosEquipeActionLoading(false);
    }
    void invalidateEquipes();
  };

  const adicionarMedicosSelecionadosNaEquipe = async () => {
    if (!selectedEquipeId) return;
    const toAdd = [...membrosEquipePickIds];
    if (toAdd.length === 0) return;
    setMembrosEquipeError(null);
    setMembrosEquipeActionLoading(true);
    try {
      for (const medicoId of toAdd) {
        await adminService.addMedicoToEquipe(selectedEquipeId, medicoId);
      }
      setMembrosEquipePickIds([]);
    } catch (err: any) {
      setMembrosEquipeError(err.response?.data?.error || err.message || 'Erro ao adicionar');
    } finally {
      setMembrosEquipeActionLoading(false);
    }
    void invalidateEquipes();
  };

  const removerMedicoDaEquipe = async (medicoId: string) => {
    if (!selectedEquipeId) return;
    setMembrosEquipeError(null);
    setMembrosEquipeActionLoading(true);
    try {
      await adminService.removeMedicoFromEquipe(selectedEquipeId, medicoId);
      setMembrosEquipePickIds((prev) => prev.filter((id) => id !== medicoId));
    } catch (err: any) {
      setMembrosEquipeError(err.response?.data?.error || err.message || 'Erro ao remover');
    } finally {
      setMembrosEquipeActionLoading(false);
    }
    void invalidateEquipes();
  };
  const openConfirmExcluirSubgrupo = (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    setConfirmExcluir({ tipo: 'subgrupo', id, nome });
  };
  const openConfirmExcluirEquipe = (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    setConfirmExcluir({ tipo: 'equipe', id, nome });
  };
  const closeConfirmExcluir = () => setConfirmExcluir(null);
  const executarExcluir = async () => {
    if (!confirmExcluir) return;
    const { tipo, id } = confirmExcluir;
    setLoadingAction(true);
    try {
      if (tipo === 'subgrupo') {
        await adminService.deleteSubgrupo(id);
        if (selectedSubgrupoId === id) setSelectedSubgrupoId('');
        queryClient.removeQueries({ queryKey: ['admin', 'subgrupos', id, 'medicos'] });
        await invalidateSubgrupos();
      } else {
        await adminService.deleteEquipe(id);
        if (selectedEquipeId === id) setSelectedEquipeId('');
        queryClient.removeQueries({ queryKey: ['admin', 'equipes', id, 'medicos'] });
        await invalidateEquipes();
      }
      setConfirmExcluir(null);
    } finally {
      setLoadingAction(false);
    }
  };

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Somente o perfil Master pode gerenciar subgrupos e equipes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-viva-500">
        <h2 className="text-2xl font-bold text-viva-900 mb-1">Subgrupos e Equipes</h2>
        <p className="text-gray-600">
          Crie na ordem: contrato → subgrupo (já associado ao contrato) → equipe (já associada ao subgrupo) → escala (já associada à equipe).{' '}
          <Link to="/escalas" className="text-viva-600 hover:underline font-medium">Ir para Escalas</Link>
        </p>
      </div>

      {/* 1. Contrato e subgrupos */}
      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-2">1. Contrato e subgrupos</h3>
        <p className="text-sm text-gray-600 mb-4">Selecione o contrato e crie subgrupos já vinculados a ele.</p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-viva-800 mb-1">Contrato</label>
          <select
            className="input max-w-md"
            value={selectedContratoId}
            onChange={(e) => { setSelectedContratoId(e.target.value); setSelectedSubgrupoId(''); setSelectedEquipeId(''); }}
          >
            <option value="">Selecionar contrato</option>
            {contratosAtivos.map((c: { id: string; nome: string }) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        {selectedContratoId && (
          <>
            <form onSubmit={criarSubgrupo} className="flex flex-wrap items-end gap-2 mb-3">
              <div className="min-w-[200px]">
                <label className="block text-sm font-medium text-viva-800 mb-1">Novo subgrupo</label>
                <input className="input w-full" placeholder="Nome do subgrupo" value={subgrupoNome} onChange={(e) => setSubgrupoNome(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loadingAction}>Criar subgrupo</button>
            </form>
            <div className="space-y-2 max-h-48 overflow-auto">
              {subgruposDoContrato.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum subgrupo neste contrato ainda.</p>
              ) : (
                subgruposDoContrato.map((s) => (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    className={`w-full text-left border rounded-lg p-2 flex items-center justify-between gap-2 ${selectedSubgrupoId === s.id ? 'border-viva-900 bg-viva-50' : 'border-viva-200'} cursor-pointer hover:bg-viva-50/50`}
                    onClick={() => { setSelectedSubgrupoId(s.id); setSelectedEquipeId(''); }}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-viva-900">{s.nome}</p>
                      <p className="text-xs text-gray-600">Equipes: {s._count?.equipes ?? 0}</p>
                    </div>
                    <button type="button" className="btn btn-secondary shrink-0" onClick={(e) => openConfirmExcluirSubgrupo(e, s.id, s.nome)} disabled={loadingAction}>Excluir</button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* 2. Equipes do subgrupo */}
      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-2">2. Equipes do subgrupo</h3>
        {!selectedSubgrupoId ? (
          <p className="text-sm text-gray-600">Selecione um contrato e um subgrupo acima para criar equipes já vinculadas a esse subgrupo.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-3">Subgrupo selecionado: <strong>{selectedSubgrupo?.nome}</strong>. Crie equipes já vinculadas a ele.</p>
            <form onSubmit={criarEquipe} className="flex flex-wrap items-end gap-2 mb-3">
              <div className="min-w-[200px]">
                <label className="block text-sm font-medium text-viva-800 mb-1">Nova equipe</label>
                <input className="input w-full" placeholder="Nome da equipe" value={equipeNome} onChange={(e) => setEquipeNome(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loadingAction}>Criar equipe</button>
            </form>
            <div className="space-y-2 max-h-48 overflow-auto">
              {equipes.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma equipe neste subgrupo ainda.</p>
              ) : (
                equipes.map((equipe: { id: string; nome: string; _count?: { equipeMedicos: number; escalaEquipes: number } }) => (
                  <div
                    key={equipe.id}
                    role="button"
                    tabIndex={0}
                    className={`w-full text-left border rounded-lg p-2 flex items-center justify-between gap-2 ${selectedEquipeId === equipe.id ? 'border-viva-900 bg-viva-50' : 'border-viva-200'} cursor-pointer hover:bg-viva-50/50`}
                    onClick={() => setSelectedEquipeId(equipe.id)}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-viva-900">{equipe.nome}</p>
                      <p className="text-xs text-gray-600">Médicos: {equipe._count?.equipeMedicos ?? 0} | Escalas: {equipe._count?.escalaEquipes ?? 0}</p>
                    </div>
                    <button type="button" className="btn btn-secondary shrink-0" onClick={(e) => openConfirmExcluirEquipe(e, equipe.id, equipe.nome)} disabled={loadingAction}>Excluir</button>
                  </div>
                ))
              )}
            </div>
            {selectedEquipeId && (
              <div className="mt-4 pt-4 border-t border-viva-100">
                <p className="text-sm font-medium text-viva-800 mb-3">Médicos da equipe</p>
                <div className="mb-4 pb-4 border-b border-viva-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-viva-600 mb-2">Adicionar profissionais</p>
                  <input
                    type="text"
                    className="input w-full py-2 text-sm mb-2"
                    placeholder="Buscar por nome ou CRM…"
                    value={membrosEquipeBusca}
                    onChange={(e) => setMembrosEquipeBusca(e.target.value)}
                    disabled={membrosEquipeActionLoading}
                    autoComplete="off"
                  />
                  {membrosEquipeError && (
                    <p className="text-xs text-red-600 font-medium mb-2">{membrosEquipeError}</p>
                  )}
                  {loadingMedicosLista && medicos.length === 0 ? (
                    <p className="text-sm text-viva-600 py-2">Carregando profissionais…</p>
                  ) : medicosDisponiveis.length === 0 ? (
                    <p className="text-sm text-gray-500 py-1">
                      {medicos.length === 0 && !loadingMedicosLista
                        ? 'Não foi possível carregar a lista de médicos.'
                        : 'Nenhum profissional disponível: todos já estão na equipe ou a busca não encontrou resultados.'}
                    </p>
                  ) : (
                    <>
                      <ul className="max-h-44 overflow-y-auto space-y-1 rounded-lg border border-viva-200 bg-viva-50/50 p-1.5">
                        {medicosDisponiveis.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-white border border-transparent hover:border-viva-100"
                          >
                            <input
                              type="checkbox"
                              className="rounded border-viva-300 text-viva-600 focus:ring-viva-500 shrink-0"
                              checked={membrosEquipePickIds.includes(m.id)}
                              onChange={() => toggleMembrosEquipePick(m.id)}
                              disabled={membrosEquipeActionLoading}
                              aria-label={`Selecionar ${m.nomeCompleto}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-viva-900 text-sm truncate">{m.nomeCompleto}</p>
                              {m.crm ? <p className="text-xs text-viva-600">CRM: {m.crm}</p> : null}
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary text-xs py-1 px-2 shrink-0"
                              disabled={membrosEquipeActionLoading}
                              onClick={() => adicionarMedicoNaEquipeUm(m.id)}
                            >
                              Adicionar
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="btn btn-primary text-sm w-full mt-2"
                        disabled={membrosEquipePickIds.length === 0 || membrosEquipeActionLoading}
                        onClick={adicionarMedicosSelecionadosNaEquipe}
                      >
                        {membrosEquipeActionLoading
                          ? 'Aplicando…'
                          : `Adicionar selecionados (${membrosEquipePickIds.length})`}
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-viva-600 mb-2">Na equipe</p>
                {equipeMedicos.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum profissional vinculado a esta equipe.</p>
                ) : (
                  <ul className="space-y-2">
                    {equipeMedicos.map(
                      (a: { id: string; medicoId: string; medico?: { nomeCompleto: string; crm?: string | null } }) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-2 border border-viva-200 rounded-lg px-3 py-2 bg-white"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-viva-900 text-sm">{a.medico?.nomeCompleto ?? '—'}</p>
                            {a.medico?.crm ? <p className="text-xs text-viva-600">CRM: {a.medico.crm}</p> : null}
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary text-sm shrink-0"
                            disabled={membrosEquipeActionLoading}
                            onClick={() => removerMedicoDaEquipe(a.medicoId)}
                          >
                            Remover
                          </button>
                        </li>
                      )
                    )}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Escala da equipe */}
      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-2">3. Escala da equipe</h3>
        {!selectedEquipeId || !contratoEscalaDoSubgrupo ? (
          <p className="text-sm text-gray-600">Selecione uma equipe (cujo subgrupo tenha contrato com escala) acima para criar uma escala já vinculada a essa equipe e ao subgrupo.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-3">Equipe selecionada: <strong>{equipes.find((e: { id: string; nome: string }) => e.id === selectedEquipeId)?.nome}</strong>. A nova escala será criada e já vinculada a esta equipe e ao subgrupo.</p>
            <form onSubmit={criarEscala} className="flex flex-wrap items-end gap-2 mb-4">
              <div className="min-w-[200px]">
                <label className="block text-sm font-medium text-viva-800 mb-1">Nova escala</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Ex: UPA Bom Jardim - Chefe de Equipe"
                  value={novaEscalaNome}
                  onChange={(e) => setNovaEscalaNome(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loadingAction}>Criar escala</button>
            </form>
            {equipeEscalas.length > 0 && (
              <div>
                <p className="text-sm font-medium text-viva-800 mb-2">Escalas desta equipe</p>
                <ul className="space-y-1">
                  {equipeEscalas.map((esc: { id: string; nome: string }) => (
                    <li key={esc.id} className="flex items-center justify-between border border-viva-200 rounded-lg px-2 py-1.5">
                      <span className="text-sm text-viva-900">{esc.nome}</span>
                      <Link to="/escalas" state={{ escalaId: esc.id }} className="text-sm text-viva-600 hover:underline font-medium">Abrir na página Escalas</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {confirmExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeConfirmExcluir}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-viva-900 mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-gray-600 mb-4">
              {confirmExcluir.tipo === 'subgrupo'
                ? `Excluir o subgrupo "${confirmExcluir.nome}"? Esta ação não pode ser desfeita.`
                : `Excluir a equipe "${confirmExcluir.nome}"? Esta ação não pode ser desfeita.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-secondary" onClick={closeConfirmExcluir} disabled={loadingAction}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary bg-red-600 hover:bg-red-700" onClick={executarExcluir} disabled={loadingAction}>
                {loadingAction ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubgruposEquipes;
