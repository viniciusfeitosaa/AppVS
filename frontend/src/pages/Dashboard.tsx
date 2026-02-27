import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { medicoService } from '../services/medico.service';
import { formatCRM, fixMojibake } from '../utils/validation.util';

const Dashboard = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['medico', 'perfil', user?.id],
    queryFn: async () => {
      const response = await medicoService.getPerfil();
      return response.data;
    },
    enabled: !!user && !isMaster,
  });

  const { data: docsResp } = useQuery({
    queryKey: ['medico', 'documentos-enviados', user?.id],
    queryFn: () => medicoService.listDocumentosEnviados(),
    enabled: !!user && !isMaster,
  });

  const documentosDisponiveis = docsResp?.data ?? [];
  const displayUser = isMaster ? user : perfil || user;

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="card col-span-full border-l-4 border-viva-500">
        <h2 className="text-2xl font-bold text-viva-900 mb-1">
          Bem-vindo, {fixMojibake(displayUser?.nomeCompleto)}!
        </h2>
        <p className="text-gray-600">
          {isMaster
            ? 'Sistema de gestão Viva Saúde | Acesso Master'
            : 'Sistema de gestão Viva Saúde | Acesso Profissional'}
        </p>
      </div>

      {/* Card de Informações */}
      <div className="card hover:shadow-lg transition-shadow">
        <h3 className="text-lg font-bold mb-4 text-viva-800 flex items-center gap-2">
          <span className="w-2 h-2 bg-viva-500 rounded-full"></span>
          Informações Pessoais
        </h3>
        <div className="space-y-4">
          {!isMaster && (displayUser?.profissao || (displayUser?.especialidades?.length ?? 0) > 0) && (
            <div className="bg-viva-100 border border-viva-200 p-3 rounded-lg">
              <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Identificação profissional</p>
              {displayUser?.profissao && (
                <p className="text-lg font-medium text-viva-900 mt-1">
                  <span className="text-viva-700">Profissão:</span> {fixMojibake(displayUser.profissao)}
                </p>
              )}
              {(displayUser?.especialidades?.length ?? 0) > 0 && (
                <p className="text-base font-medium text-viva-900 mt-0.5">
                  <span className="text-viva-700">Especialidades:</span> {fixMojibake(displayUser!.especialidades!.join(', '))}
                </p>
              )}
            </div>
          )}
          {!isMaster && displayUser?.crm && (
            <div className="bg-viva-50 p-3 rounded-lg">
              <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">CRM</p>
              <p className="text-lg font-medium text-viva-900">{formatCRM(displayUser.crm)}</p>
            </div>
          )}
          {!isMaster && (
            <div className="bg-viva-50 p-3 rounded-lg">
              <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Tipo de vínculo</p>
              <p className="text-lg font-medium text-viva-900">
                {displayUser?.vinculo?.toUpperCase() === 'PJ' ? 'PJ' : 'Associado'}
              </p>
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

      {/* Documentos disponíveis (profissional) */}
      {!isMaster && documentosDisponiveis.length > 0 && (
        <div className="card col-span-full hover:shadow-lg transition-shadow border-l-4 border-viva-500">
          <h3 className="text-lg font-bold mb-4 text-viva-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-viva-500 rounded-full"></span>
            Documentos disponíveis
          </h3>
          <p className="text-sm text-viva-600 mb-3">
            Documentos enviados para você. Clique para visualizar.
          </p>
          <ul className="space-y-2">
            {documentosDisponiveis.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 p-3 bg-viva-50 rounded-lg border border-viva-100">
                <div className="min-w-0">
                  <p className="font-medium text-viva-900 truncate">
                    {doc.titulo || doc.nomeArquivo}
                  </p>
                  {doc.titulo && (
                    <p className="text-xs text-viva-600 truncate">{doc.nomeArquivo}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-primary shrink-0"
                  onClick={() => medicoService.openDocumentoEnviado(doc.id)}
                >
                  Visualizar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
