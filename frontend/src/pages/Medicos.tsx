import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/admin.service';
import { formatCRM, fixMojibake } from '../utils/validation.util';

const Medicos = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'medicos', user?.id],
    queryFn: () => adminService.listMedicos({ page: 1, limit: 100 }),
    enabled: !!user && isMaster,
  });

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Esta área é exclusiva para o perfil Master.</p>
      </div>
    );
  }

  const medicos = data?.data || [];

  return (
    <div className="card hover:shadow-lg transition-shadow">
      <h2 className="text-2xl font-bold text-viva-900 mb-1">Médicos</h2>
      <p className="text-gray-600 mb-6">Lista de profissionais vinculados ao seu tenant.</p>

      {isLoading ? (
        <p className="text-sm text-gray-600">Carregando médicos...</p>
      ) : medicos.length === 0 ? (
        <p className="text-sm text-gray-600">Nenhum médico cadastrado para este tenant.</p>
      ) : (
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
      )}
    </div>
  );
};

export default Medicos;
