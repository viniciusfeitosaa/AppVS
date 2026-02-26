import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/admin.service';

const SubgruposEquipes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const [subgrupoNome, setSubgrupoNome] = useState('');
  const [equipeNome, setEquipeNome] = useState('');
  const [selectedSubgrupoId, setSelectedSubgrupoId] = useState('');
  const [selectedEquipeId, setSelectedEquipeId] = useState('');
  const [medicoIdToSubgrupo, setMedicoIdToSubgrupo] = useState('');
  const [medicoIdToEquipe, setMedicoIdToEquipe] = useState('');
  const [escalaIdToLink, setEscalaIdToLink] = useState('');
  const [subgrupoIdToLink, setSubgrupoIdToLink] = useState('');
  const [equipeIdToLink, setEquipeIdToLink] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  const { data: escalasResp } = useQuery({
    queryKey: ['admin', 'escalas'],
    queryFn: () => adminService.listEscalas({ page: 1, limit: 200 }),
    enabled: isMaster,
  });
  const { data: medicosResp } = useQuery({
    queryKey: ['admin', 'medicos', 'for-subgrupos'],
    queryFn: () => adminService.listMedicos({ page: 1, limit: 300 }),
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
  const { data: equipesTodasResp } = useQuery({
    queryKey: ['admin', 'equipes', 'todos'],
    queryFn: () => adminService.listEquipes(),
    enabled: isMaster && !!escalaIdToLink,
  });
  const { data: escalaSubgruposResp } = useQuery({
    queryKey: ['admin', 'escalas', escalaIdToLink, 'subgrupos'],
    queryFn: () => adminService.listEscalaSubgrupos(escalaIdToLink),
    enabled: isMaster && !!escalaIdToLink,
  });
  const { data: escalaEquipesResp } = useQuery({
    queryKey: ['admin', 'escalas', escalaIdToLink, 'equipes'],
    queryFn: () => adminService.listEscalaEquipes(escalaIdToLink),
    enabled: isMaster && !!escalaIdToLink,
  });
  const { data: subgrupoMedicosResp } = useQuery({
    queryKey: ['admin', 'subgrupos', selectedSubgrupoId, 'medicos'],
    queryFn: () => adminService.listSubgrupoMedicos(selectedSubgrupoId),
    enabled: isMaster && !!selectedSubgrupoId,
  });
  const { data: equipeMedicosResp } = useQuery({
    queryKey: ['admin', 'equipes', selectedEquipeId, 'medicos'],
    queryFn: () => adminService.listEquipeMedicos(selectedEquipeId),
    enabled: isMaster && !!selectedEquipeId,
  });

  const escalas = useMemo(() => escalasResp?.data || [], [escalasResp]);
  const medicos = useMemo(() => medicosResp?.data || [], [medicosResp]);
  const subgrupos = useMemo(() => subgruposResp?.data || [], [subgruposResp]);
  const equipes = useMemo(() => equipesResp?.data || [], [equipesResp]);
  const equipesTodas = useMemo(() => equipesTodasResp?.data || [], [equipesTodasResp]);
  const escalaSubgrupos = useMemo(() => escalaSubgruposResp?.data || [], [escalaSubgruposResp]);
  const escalaEquipes = useMemo(() => escalaEquipesResp?.data || [], [escalaEquipesResp]);
  const subgrupoMedicos = useMemo(() => subgrupoMedicosResp?.data || [], [subgrupoMedicosResp]);
  const equipeMedicos = useMemo(() => equipeMedicosResp?.data || [], [equipeMedicosResp]);

  const invalidateSubgrupos = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'subgrupos'] });
    if (selectedSubgrupoId) queryClient.invalidateQueries({ queryKey: ['admin', 'subgrupos', selectedSubgrupoId, 'medicos'] });
    if (escalaIdToLink) queryClient.invalidateQueries({ queryKey: ['admin', 'escalas', escalaIdToLink, 'subgrupos'] });
  };
  const invalidateEquipes = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'equipes'] });
    if (selectedEquipeId) queryClient.invalidateQueries({ queryKey: ['admin', 'equipes', selectedEquipeId, 'medicos'] });
    if (escalaIdToLink) queryClient.invalidateQueries({ queryKey: ['admin', 'escalas', escalaIdToLink, 'equipes'] });
  };
  const selectedSubgrupo = useMemo(() => subgrupos.find((s) => s.id === selectedSubgrupoId), [subgrupos, selectedSubgrupoId]);

  const criarSubgrupo = async () => {
    if (!subgrupoNome.trim()) return;
    setLoadingAction(true);
    try {
      await adminService.createSubgrupo({ nome: subgrupoNome.trim() });
      setSubgrupoNome('');
      await invalidateSubgrupos();
    } finally {
      setLoadingAction(false);
    }
  };
  const criarEquipe = async () => {
    if (!equipeNome.trim()) return;
    setLoadingAction(true);
    try {
      await adminService.createEquipe({
        nome: equipeNome.trim(),
        subgrupoId: selectedSubgrupoId || null,
      });
      setEquipeNome('');
      await invalidateEquipes();
    } finally {
      setLoadingAction(false);
    }
  };
  const vincularSubgrupoEscala = async () => {
    if (!escalaIdToLink || !subgrupoIdToLink) return;
    setLoadingAction(true);
    try {
      await adminService.addSubgrupoToEscala(escalaIdToLink, subgrupoIdToLink);
      setSubgrupoIdToLink('');
      await invalidateSubgrupos();
    } finally {
      setLoadingAction(false);
    }
  };
  const vincularEquipeEscala = async () => {
    if (!escalaIdToLink || !equipeIdToLink) return;
    setLoadingAction(true);
    try {
      await adminService.addEquipeToEscala(escalaIdToLink, equipeIdToLink);
      setEquipeIdToLink('');
      await invalidateEquipes();
    } finally {
      setLoadingAction(false);
    }
  };
  const adicionarMedicoSubgrupo = async () => {
    if (!selectedSubgrupoId || !medicoIdToSubgrupo) return;
    setLoadingAction(true);
    try {
      await adminService.addMedicoToSubgrupo(selectedSubgrupoId, medicoIdToSubgrupo);
      setMedicoIdToSubgrupo('');
      await invalidateSubgrupos();
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
  const excluirSubgrupo = async (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir o subgrupo "${nome}"?`)) return;
    setLoadingAction(true);
    try {
      await adminService.deleteSubgrupo(id);
      if (selectedSubgrupoId === id) setSelectedSubgrupoId('');
      queryClient.removeQueries({ queryKey: ['admin', 'subgrupos', id, 'medicos'] });
      await invalidateSubgrupos();
    } finally {
      setLoadingAction(false);
    }
  };
  const excluirEquipe = async (e: React.MouseEvent, id: string, nome: string) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir a equipe "${nome}"?`)) return;
    setLoadingAction(true);
    try {
      await adminService.deleteEquipe(id);
      if (selectedEquipeId === id) setSelectedEquipeId('');
      queryClient.removeQueries({ queryKey: ['admin', 'equipes', id, 'medicos'] });
      await invalidateEquipes();
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
          Crie subgrupos e equipes, adicione médicos e vincule às escalas.{' '}
          <Link to="/escalas" className="text-viva-600 hover:underline font-medium">Ir para Escalas</Link>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-4">Subgrupos</h3>
          <div className="flex gap-2 mb-3">
            <input className="input" placeholder="Nome do subgrupo" value={subgrupoNome} onChange={(e) => setSubgrupoNome(e.target.value)} />
            <button className="btn btn-primary" onClick={criarSubgrupo} disabled={loadingAction}>Criar</button>
          </div>
          <div className="space-y-2 max-h-52 overflow-auto">
            {subgrupos.map((s) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                className={`w-full text-left border rounded-lg p-2 flex items-center justify-between gap-2 ${selectedSubgrupoId === s.id ? 'border-viva-900 bg-viva-50' : 'border-viva-200'} cursor-pointer hover:bg-viva-50/50`}
                onClick={() => setSelectedSubgrupoId(s.id)}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-viva-900">{s.nome}</p>
                  <p className="text-xs text-gray-600">Equipes: {s._count?.equipes ?? 0} | Escalas: {s._count?.escalaSubgrupos || 0}</p>
                </div>
                <button type="button" className="btn btn-secondary shrink-0" onClick={(e) => excluirSubgrupo(e, s.id, s.nome)} disabled={loadingAction}>Excluir</button>
              </div>
            ))}
          </div>
          {selectedSubgrupoId && (
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <select className="input" value={medicoIdToSubgrupo} onChange={(e) => setMedicoIdToSubgrupo(e.target.value)}>
                  <option value="">Adicionar médico ao subgrupo</option>
                  {medicos.map((m) => (
                    <option key={m.id} value={m.id}>{m.nomeCompleto} ({m.crm})</option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={adicionarMedicoSubgrupo}>Adicionar</button>
              </div>
              <div className="space-y-1">
                {subgrupoMedicos.map((a: { id: string; medicoId: string; medico?: { nomeCompleto: string } }) => (
                  <div key={a.id} className="flex items-center justify-between border border-viva-200 rounded-lg px-2 py-1.5">
                    <span className="text-sm text-viva-900">{a.medico?.nomeCompleto}</span>
                    <button className="btn btn-secondary" onClick={() => adminService.removeMedicoFromSubgrupo(selectedSubgrupoId, a.medicoId).then(invalidateSubgrupos)}>Remover</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-2">
            Equipes {selectedSubgrupo ? `do subgrupo "${selectedSubgrupo.nome}"` : ''}
          </h3>
          {!selectedSubgrupoId ? (
            <p className="text-sm text-gray-600 mb-4">Selecione um subgrupo à esquerda para ver e criar equipes. Os médicos são adicionados na equipe.</p>
          ) : null}
          <div className="flex gap-2 mb-3">
            <input className="input" placeholder="Nome da equipe" value={equipeNome} onChange={(e) => setEquipeNome(e.target.value)} />
            <button className="btn btn-primary" onClick={criarEquipe} disabled={loadingAction || !selectedSubgrupoId}>Criar</button>
          </div>
          <div className="space-y-2 max-h-52 overflow-auto">
            {equipes.map((equipe: { id: string; nome: string; subgrupo?: { nome: string } | null; _count?: { equipeMedicos: number; escalaEquipes: number } }) => (
              <div
                key={equipe.id}
                role="button"
                tabIndex={0}
                className={`w-full text-left border rounded-lg p-2 flex items-center justify-between gap-2 ${selectedEquipeId === equipe.id ? 'border-viva-900 bg-viva-50' : 'border-viva-200'} cursor-pointer hover:bg-viva-50/50`}
                onClick={() => setSelectedEquipeId(equipe.id)}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-viva-900">{equipe.nome}</p>
                  <p className="text-xs text-gray-600">Médicos: {equipe._count?.equipeMedicos || 0} | Escalas: {equipe._count?.escalaEquipes || 0}</p>
                </div>
                <button type="button" className="btn btn-secondary shrink-0" onClick={(e) => excluirEquipe(e, equipe.id, equipe.nome)} disabled={loadingAction}>Excluir</button>
              </div>
            ))}
          </div>
          {selectedEquipeId && (
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <select className="input" value={medicoIdToEquipe} onChange={(e) => setMedicoIdToEquipe(e.target.value)}>
                  <option value="">Adicionar médico à equipe</option>
                  {medicos.map((m) => (
                    <option key={m.id} value={m.id}>{m.nomeCompleto} ({m.crm})</option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={adicionarMedicoEquipe}>Adicionar</button>
              </div>
              <div className="space-y-1">
                {equipeMedicos.map((a: { id: string; medicoId: string; medico?: { nomeCompleto: string } }) => (
                  <div key={a.id} className="flex items-center justify-between border border-viva-200 rounded-lg px-2 py-1.5">
                    <span className="text-sm text-viva-900">{a.medico?.nomeCompleto}</span>
                    <button className="btn btn-secondary" onClick={() => adminService.removeMedicoFromEquipe(selectedEquipeId, a.medicoId).then(invalidateEquipes)}>Remover</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-4">Vincular à escala</h3>
        <p className="text-sm text-gray-600 mb-4">Selecione uma escala para vincular subgrupos ou equipes.</p>
        <select className="input max-w-xs mb-4" value={escalaIdToLink} onChange={(e) => setEscalaIdToLink(e.target.value)}>
          <option value="">Selecionar escala</option>
          {escalas.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
        {escalaIdToLink && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex gap-2 mb-2">
                <select className="input" value={subgrupoIdToLink} onChange={(e) => setSubgrupoIdToLink(e.target.value)}>
                  <option value="">Selecionar subgrupo</option>
                  {subgrupos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
                <button className="btn btn-secondary" onClick={vincularSubgrupoEscala} disabled={loadingAction}>Vincular</button>
              </div>
              <div className="space-y-1">
                {escalaSubgrupos.map((s: { id: string; subgrupoId: string; subgrupo?: { nome: string } }) => (
                  <div key={s.id} className="flex items-center justify-between border border-viva-200 rounded-lg px-2 py-1.5">
                    <span className="text-sm text-viva-900">{s.subgrupo?.nome}</span>
                    <button className="btn btn-secondary" onClick={() => adminService.removeSubgrupoFromEscala(escalaIdToLink, s.subgrupoId).then(invalidateSubgrupos)}>Remover</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex gap-2 mb-2">
                <select className="input" value={equipeIdToLink} onChange={(e) => setEquipeIdToLink(e.target.value)}>
                  <option value="">Selecionar equipe</option>
                  {equipesTodas.map((e: { id: string; nome: string; subgrupo?: { nome: string } | null }) => (
                    <option key={e.id} value={e.id}>{e.nome}{e.subgrupo ? ` (${e.subgrupo.nome})` : ''}</option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={vincularEquipeEscala} disabled={loadingAction}>Vincular</button>
              </div>
              <div className="space-y-1">
                {escalaEquipes.map((e: { id: string; equipeId: string; equipe?: { nome: string } }) => (
                  <div key={e.id} className="flex items-center justify-between border border-viva-200 rounded-lg px-2 py-1.5">
                    <span className="text-sm text-viva-900">{e.equipe?.nome}</span>
                    <button className="btn btn-secondary" onClick={() => adminService.removeEquipeFromEscala(escalaIdToLink, e.equipeId).then(invalidateEquipes)}>Remover</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubgruposEquipes;
