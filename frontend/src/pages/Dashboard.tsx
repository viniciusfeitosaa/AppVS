import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { medicoService } from '../services/medico.service';
import { formatCPF, formatCRM, fixMojibake } from '../utils/validation.util';

const Dashboard = () => {
  const { user, logout } = useAuth();

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['medico', 'perfil'],
    queryFn: async () => {
      const response = await medicoService.getPerfil();
      return response.data;
    },
    enabled: !!user,
  });

  const displayUser = perfil || user;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-viva-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-viva-50">
      {/* Header */}
      <header className="bg-viva-900 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="/assets/logo-horizontal.png" 
              alt="Logo Viva Saúde" 
              className="h-12 w-auto"
            />
          </div>
          <button
            onClick={logout}
            className="btn bg-viva-800 text-white hover:bg-viva-700 border border-viva-700"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="card col-span-full border-l-4 border-viva-500">
            <h2 className="text-2xl font-bold text-viva-900 mb-1">
              Bem-vindo, {fixMojibake(displayUser?.nomeCompleto)}!
            </h2>
            <p className="text-gray-600">
              Sistema de gestão Viva Saúde | Acesso Profissional
            </p>
          </div>

          {/* Card de Informações */}
          <div className="card hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-bold mb-4 text-viva-800 flex items-center gap-2">
              <span className="w-2 h-2 bg-viva-500 rounded-full"></span>
              Informações Pessoais
            </h3>
            <div className="space-y-4">
              <div className="bg-viva-50 p-3 rounded-lg">
                <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">CRM</p>
                <p className="text-lg font-medium text-viva-900">{formatCRM(displayUser?.crm || '')}</p>
              </div>
              {displayUser?.especialidade && (
                <div className="bg-viva-50 p-3 rounded-lg">
                  <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Especialidade</p>
                  <p className="text-lg font-medium text-viva-900">{fixMojibake(displayUser.especialidade)}</p>
                </div>
              )}
              {displayUser?.email && (
                <div className="bg-viva-50 p-3 rounded-lg">
                  <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Email de Contato</p>
                  <p className="text-lg font-medium text-viva-900">{fixMojibake(displayUser.email)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Card de Status */}
          <div className="card hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-bold mb-4 text-viva-800 flex items-center gap-2">
              <span className="w-2 h-2 bg-viva-500 rounded-full"></span>
              Status do Sistema
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Status da Conta</p>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200 uppercase">
                  Ativo
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Último Acesso</p>
                <p className="text-sm text-viva-700 font-bold">Hoje</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
