import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/admin.service';
import { notify } from '../lib/notificationEmitter';
import { formatCRM, fixMojibake } from '../utils/validation.util';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'active' | 'inactive';

const Medicos = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedMedico, setSelectedMedico] = useState<any | null>(null);
  const [pontoModalOpen, setPontoModalOpen] = useState(false);
  const [pontoInicio, setPontoInicio] = useState('');
  const [pontoFim, setPontoFim] = useState('');

  const ativoParam =
    statusFilter === 'all' ? undefined : statusFilter === 'active';

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'medicos', user?.id, page, search, statusFilter],
    queryFn: () =>
      adminService.listMedicos({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        ativo: ativoParam,
      }),
    enabled: !!user && isMaster,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Esta área é exclusiva para o perfil Master.</p>
      </div>
    );
  }

  const medicos = data?.data || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const total = pagination?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const selectedLabel = useMemo(() => {
    if (!selectedMedico) return 'Selecione um profissional';
    const nome = fixMojibake(selectedMedico.nomeCompleto);
    const crm = selectedMedico.crm ? formatCRM(selectedMedico.crm) : '';
    return crm ? `${nome} · ${crm}` : nome;
  }, [selectedMedico]);

  const { data: registrosPontoResp, isLoading: loadingPontos } = useQuery({
    queryKey: ['admin', 'registros-ponto', selectedMedico?.id, pontoInicio, pontoFim],
    queryFn: () =>
      adminService.listRegistrosPonto({
        medicoId: selectedMedico!.id,
        ...(pontoInicio ? { dataInicio: pontoInicio } : {}),
        ...(pontoFim ? { dataFim: pontoFim } : {}),
      }),
    enabled: !!user && isMaster && pontoModalOpen && !!selectedMedico?.id,
  });
  const registrosPonto: any[] = registrosPontoResp?.data?.data ?? registrosPontoResp?.data ?? [];

  return (
    <div className="card hover:shadow-lg transition-shadow">
      <h2 className="text-2xl font-bold text-viva-900 mb-1">Médicos</h2>
      <p className="text-gray-600 mb-6">Lista de profissionais vinculados ao seu tenant.</p>

      <form
        onSubmit={handleSearchSubmit}
        className="mb-6 flex flex-wrap items-center gap-3"
      >
        <div className="flex-1 min-w-[200px] flex flex-wrap items-center gap-2">
          <input
            type="search"
            className="input flex-1 min-w-[180px]"
            placeholder="Pesquisar por nome, CRM ou CPF..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Pesquisar médicos"
          />
          <button type="submit" className="btn btn-primary">
            Pesquisar
          </button>
          {(search || statusFilter !== 'all') && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setStatusFilter('all');
                setPage(1);
              }}
            >
              Limpar
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="filter-status" className="text-sm font-medium text-viva-800 whitespace-nowrap">
            Status:
          </label>
          <select
            id="filter-status"
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
          >
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </form>

      {isLoading ? (
        <p className="text-sm text-gray-600">Carregando médicos...</p>
      ) : medicos.length === 0 ? (
        <p className="text-sm text-gray-600">
          {search || statusFilter !== 'all'
            ? 'Nenhum médico encontrado com os filtros aplicados. Tente alterar a pesquisa ou o status.'
            : 'Nenhum médico cadastrado para este tenant.'}
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-viva-200/60 bg-viva-50/50 px-4 py-3">
            <div className="min-w-[220px] flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-viva-600 font-display">Profissional selecionado</p>
              <p className="text-sm font-semibold text-viva-900 font-display truncate">{selectedLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                disabled={!selectedMedico}
                onClick={() => setPontoModalOpen(true)}
              >
                Histórico de pontos
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-viva-700 border-b">
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Profissão</th>
                  <th className="py-2 pr-4">CRM</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Especialidades</th>
                  <th className="py-2 pr-4">Vínculo</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {medicos.map((medico) => (
                  <tr
                    key={medico.id}
                    className={`border-b last:border-b-0 cursor-pointer ${
                      selectedMedico?.id === medico.id ? 'bg-viva-50/70' : 'hover:bg-viva-50/40'
                    }`}
                    onClick={() => setSelectedMedico(medico)}
                    title="Clique para selecionar"
                  >
                    <td className="py-2 pr-4 font-medium text-viva-900">
                      {fixMojibake(medico.nomeCompleto)}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">{fixMojibake(medico.profissao ?? '-')}</td>
                    <td className="py-2 pr-4 text-gray-700">{formatCRM(medico.crm ?? '')}</td>
                    <td className="py-2 pr-4 text-gray-700">{medico.email || '-'}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      {(medico.especialidades?.length ?? 0) > 0
                        ? fixMojibake(medico.especialidades!.join(', '))
                        : '-'}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {medico.vinculo?.trim() ? fixMojibake(medico.vinculo) : 'Associado'}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          medico.ativo
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}
                      >
                        {medico.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-viva-200 pt-4">
              <p className="text-sm text-viva-700">
                Exibindo <strong>{from}</strong> a <strong>{to}</strong> de <strong>{total}</strong> médicos
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-viva-800 bg-viva-100 hover:bg-viva-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Anterior
                </button>
                <span className="text-sm text-viva-700 px-2">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-viva-800 bg-viva-100 hover:bg-viva-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {pontoModalOpen &&
        selectedMedico &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/40 overflow-y-auto sm:overflow-hidden flex items-start sm:items-center justify-center"
            role="dialog"
            aria-modal="true"
            onClick={() => setPontoModalOpen(false)}
          >
            <div
              className="card w-full sm:max-w-5xl border border-viva-200/70 shadow-2xl overflow-hidden flex flex-col rounded-none sm:rounded-2xl h-[100svh] sm:h-auto sm:max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-none bg-white/95 backdrop-blur-sm border-b border-viva-100 px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-viva-900 font-display">Histórico de pontos</h3>
                  <p className="text-xs text-viva-600 font-serif truncate">{selectedLabel}</p>
                </div>
                <button
                  type="button"
                  className="btn text-sm border border-viva-300 bg-white text-viva-800"
                  onClick={() => setPontoModalOpen(false)}
                >
                  Fechar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-5">
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-viva-200/60 bg-viva-50/50 p-3">
                  <div className="min-w-[160px]">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-viva-600 font-display mb-1">Início</label>
                    <input type="date" className="input w-full" value={pontoInicio} onChange={(e) => setPontoInicio(e.target.value)} />
                  </div>
                  <div className="min-w-[160px]">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-viva-600 font-display mb-1">Fim</label>
                    <input type="date" className="input w-full" value={pontoFim} onChange={(e) => setPontoFim(e.target.value)} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => {
                      setPontoInicio('');
                      setPontoFim('');
                    }}
                  >
                    Limpar
                  </button>
                </div>

                <div className="mt-4">
                  {loadingPontos ? (
                    <p className="text-sm text-viva-700">Carregando registros...</p>
                  ) : registrosPonto.length === 0 ? (
                    <p className="text-sm text-viva-700">Nenhum registro encontrado.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-viva-700 border-b">
                            <th className="py-2 pr-4">Check-in</th>
                            <th className="py-2 pr-4">Check-out</th>
                            <th className="py-2 pr-4">Duração</th>
                            <th className="py-2 pr-4">Escala</th>
                            <th className="py-2 pr-4">Origem</th>
                            <th className="py-2 pr-4">Foto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrosPonto.map((r) => {
                            const checkIn = r.checkInAt ? new Date(r.checkInAt).toLocaleString('pt-BR') : '—';
                            const checkOut = r.checkOutAt ? new Date(r.checkOutAt).toLocaleString('pt-BR') : '—';
                            const dur = r.duracaoMinutos != null ? `${r.duracaoMinutos} min` : '—';
                            const escalaNome = r.escala?.nome ? fixMojibake(r.escala.nome) : r.escalaId ? 'Escala' : '—';
                          const hasFoto = typeof r.fotoCheckinCaminho === 'string' && r.fotoCheckinCaminho.trim().length > 0;
                            return (
                              <tr key={r.id} className="border-b last:border-b-0">
                                <td className="py-2 pr-4 text-viva-900">{checkIn}</td>
                                <td className="py-2 pr-4 text-viva-900">{checkOut}</td>
                                <td className="py-2 pr-4 text-viva-900">{dur}</td>
                                <td className="py-2 pr-4 text-viva-900">{escalaNome}</td>
                                <td className="py-2 pr-4 text-viva-900">{r.origem ?? '—'}</td>
                                <td className="py-2 pr-4">
                                  {hasFoto ? (
                                    <button
                                      type="button"
                                      className="btn-sm btn-primary"
                                    onClick={async () => {
                                      try {
                                        await adminService.openRegistroPontoFotoCheckin(r.id);
                                      } catch (err: any) {
                                        const status = err?.response?.status;
                                        const msg = err?.response?.data?.error;
                                        notify({
                                          kind: 'warning',
                                          title: 'Foto indisponível',
                                          message:
                                            status === 404
                                              ? 'Este registro não possui foto (ou o arquivo não está mais disponível no servidor).'
                                              : (typeof msg === 'string' && msg.trim()) || 'Não foi possível abrir a foto.',
                                          source: 'admin',
                                        });
                                      }
                                    }}
                                    >
                                      Ver
                                    </button>
                                  ) : (
                                    <span className="text-xs text-viva-600">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default Medicos;
