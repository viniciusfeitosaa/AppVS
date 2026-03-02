import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { medicoService } from '../services/medico.service';
import { fixMojibake } from '../utils/validation.util';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

const MeusDocumentos = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const { data: docsResp, isLoading } = useQuery({
    queryKey: ['medico', 'documentos-enviados', user?.id],
    queryFn: () => medicoService.listDocumentosEnviados(),
    enabled: !!user && !isMaster,
  });

  const documentos = docsResp?.data ?? [];

  if (isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Documentos enviados para você estão na área do profissional. Use o perfil Master apenas para envio em Envio de Documentos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-viva-500">
        <h2 className="text-2xl font-bold text-viva-900 mb-1">Meus Documentos</h2>
        <p className="text-gray-600 mb-6">
          Documentos enviados para você. Clique em &quot;Visualizar&quot; para abrir ou baixar.
        </p>

        {isLoading ? (
          <p className="text-viva-600">Carregando...</p>
        ) : documentos.length === 0 ? (
          <p className="text-gray-500">Nenhum documento enviado para você ainda.</p>
        ) : (
          <div className="border border-viva-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-viva-100 text-viva-800">
                <tr>
                  <th className="text-left px-3 py-2">Documento</th>
                  <th className="text-left px-3 py-2 hidden sm:table-cell">Tamanho</th>
                  <th className="text-left px-3 py-2 hidden md:table-cell">Data</th>
                  <th className="w-28 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((doc) => (
                  <tr key={doc.id} className="border-t border-viva-100">
                    <td className="px-3 py-2">
                      <span className="font-medium text-viva-900">
                        {doc.titulo ? fixMojibake(doc.titulo) : fixMojibake(doc.nomeArquivo)}
                      </span>
                      {doc.titulo && (
                        <span className="block text-xs text-gray-500">{fixMojibake(doc.nomeArquivo)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-viva-800 hidden sm:table-cell">{formatBytes(doc.tamanhoBytes)}</td>
                    <td className="px-3 py-2 text-gray-600 hidden md:table-cell">{formatDate(doc.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => medicoService.openDocumentoEnviado(doc.id)}
                      >
                        Visualizar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusDocumentos;
