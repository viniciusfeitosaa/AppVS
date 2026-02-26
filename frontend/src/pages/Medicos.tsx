import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/admin.service';
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-viva-700 border-b">
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">CRM</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Especialidade</th>
                  <th className="py-2 pr-4">Vínculo</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {medicos.map((medico) => (
                  <tr key={medico.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium text-viva-900">
                      {fixMojibake(medico.nomeCompleto)}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">{formatCRM(medico.crm)}</td>
                    <td className="py-2 pr-4 text-gray-700">{medico.email || '-'}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      {medico.especialidade ? fixMojibake(medico.especialidade) : '-'}
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
    </div>
  );
};

export default Medicos;
