import { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/admin.service';

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className = 'input',
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const selectedLabel = useMemo(() => options.find((o) => o.value === value)?.label ?? '', [options, value]);
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const s = search.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, search]);

  useLayoutEffect(() => {
    if (!open || !containerRef.current) {
      setDropdownRect(null);
      return;
    }
    const update = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
      }
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const dropdown = open && dropdownRect && createPortal(
    <ul
      ref={dropdownRef}
      className="fixed z-[9999] mt-0 max-h-60 overflow-auto bg-white border border-viva-200 rounded-lg shadow-lg py-1"
      style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, minWidth: 200 }}
    >
      {filtered.length === 0 ? (
        <li className="px-3 py-2 text-sm text-gray-500">Nenhum resultado</li>
      ) : (
        filtered.map((o) => (
          <li
            key={o.value}
            role="option"
            className={`px-3 py-2 text-sm cursor-pointer hover:bg-viva-100 ${o.value === value ? 'bg-viva-50 text-viva-900 font-medium' : 'text-viva-800'}`}
            onClick={() => { onChange(o.value); setSearch(''); setOpen(false); }}
          >
            {o.label}
          </li>
        ))
      )}
    </ul>,
    document.body
  );

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={open ? search : selectedLabel || ''}
        onChange={(e) => { setSearch(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        autoComplete="off"
      />
      {dropdown}
    </div>
  );
}

const SubgruposEquipes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isMaster = user?.role === 'MASTER';
  const [selectedContratoId, setSelectedContratoId] = useState('');
  const [subgrupoNome, setSubgrupoNome] = useState('');
  const [equipeNome, setEquipeNome] = useState('');
  const [selectedSubgrupoId, setSelectedSubgrupoId] = useState('');
  const [selectedEquipeId, setSelectedEquipeId] = useState('');
  const [medicoIdToEquipe, setMedicoIdToEquipe] = useState('');
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
  const { data: escalasResp } = useQuery({
    queryKey: ['admin', 'escalas'],
    queryFn: () => adminService.listEscalas({ page: 1, limit: 200 }),
    enabled: isMaster,
  });
  const { data: equipeEscalasResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId ?? '', 'escalas'],
    queryFn: () => adminService.listEscalasByEquipe(selectedEquipeId!),
    enabled: isMaster && !!selectedEquipeId,
  });
  const { data: medicosResp } = useQuery({
    queryKey: ['admin', 'medicos', 'for-subgrupos'],
    queryFn: () => adminService.listMedicos({ page: 1, limit: 2000 }),
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
  const escalas = useMemo(() => escalasResp?.data || [], [escalasResp]);
  const medicos = useMemo(() => medicosResp?.data || [], [medicosResp]);
  const subgrupos = useMemo(() => subgruposResp?.data || [], [subgruposResp]);
  const equipes = useMemo(() => equipesResp?.data || [], [equipesResp]);
  const equipeMedicos = useMemo(() => equipeMedicosResp?.data || [], [equipeMedicosResp]);
  const equipeEscalas = useMemo(() => equipeEscalasResp?.data || [], [equipeEscalasResp]);
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
  const adicionarMedicoEquipe = async () => {
    if (!selectedEquipeId || !medicoIdToEquipe) return;
    setLoadingAction(true);
    try {
      await adminService.addMedicoToEquipe(selectedEquipeId, medicoIdToEquipe);
      setMedicoIdToEquipe('');
      await invalidateEquipes();
    } finally {
      setLoadingAction(false);
    }
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
    const { tipo, id, nome } = confirmExcluir;
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
                <p className="text-sm font-medium text-viva-800 mb-2">Médicos da equipe</p>
                <div className="flex gap-2 items-start mb-2">
                  <SearchableSelect
                    options={medicos.map((m) => ({ value: m.id, label: `${m.nomeCompleto} (${m.crm})` }))}
                    value={medicoIdToEquipe}
                    onChange={setMedicoIdToEquipe}
                    placeholder="Pesquisar e adicionar médico"
                    disabled={loadingAction}
                  />
                  <button type="button" className="btn btn-secondary shrink-0" onClick={adicionarMedicoEquipe}>Adicionar</button>
                </div>
                <div className="space-y-1">
                  {equipeMedicos.map((a: { id: string; medicoId: string; medico?: { nomeCompleto: string } }) => (
                    <div key={a.id} className="flex items-center justify-between border border-viva-200 rounded-lg px-2 py-1.5">
                      <span className="text-sm text-viva-900">{a.medico?.nomeCompleto}</span>
                      <button type="button" className="btn btn-secondary text-sm" onClick={() => adminService.removeMedicoFromEquipe(selectedEquipeId, a.medicoId).then(invalidateEquipes)}>Remover</button>
                    </div>
                  ))}
                </div>
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
