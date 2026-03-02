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
        <h2 className="text-base font-bold text-viva-900 mb-2 font-display">Acesso restrito</h2>
        <p className="text-sm text-viva-700 font-serif">Documentos enviados para você estão na área do profissional. Use o perfil Master apenas para envio em Envio de Documentos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-viva-600 mb-2 font-display">
          Área do profissional
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-viva-900 font-display leading-tight mb-2">
          Meus Documentos
        </h1>
        <p className="text-viva-700 font-serif text-base">
          Documentos enviados para você. Clique em Visualizar para abrir ou baixar.
        </p>
      </div>

      {/* Lista de documentos */}
      <div className="card stagger-2 border-l-4 border-l-viva-500 bg-gradient-to-br from-white to-viva-50/30">
        {isLoading ? (
          <div className="flex items-center gap-3 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-viva-200 border-t-viva-600" />
            <p className="text-sm text-viva-700 font-medium">Carregando...</p>
          </div>
        ) : documentos.length === 0 ? (
          <div className="py-12 text-center">
            <span className="inline-flex w-14 h-14 rounded-2xl bg-viva-100/80 items-center justify-center text-viva-500 mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <p className="text-sm text-viva-600 font-serif">Nenhum documento enviado para você ainda.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {documentos.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 p-4 rounded-xl bg-viva-50/50 hover:bg-viva-100/50 border border-viva-200/40 transition"
              >
                <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-viva-200/50 flex items-center justify-center text-viva-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-viva-900 truncate font-display text-sm">
                    {doc.titulo ? fixMojibake(doc.titulo) : fixMojibake(doc.nomeArquivo)}
                  </p>
                  {doc.titulo && (
                    <p className="text-[10px] text-viva-600 truncate mt-0.5">{fixMojibake(doc.nomeArquivo)}</p>
                  )}
                  <div className="flex gap-4 mt-1 text-[10px] text-viva-600 sm:hidden">
                    <span>{formatBytes(doc.tamanhoBytes)}</span>
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-4 shrink-0">
                  <span className="text-xs text-viva-700 w-14 text-right">{formatBytes(doc.tamanhoBytes)}</span>
                  <span className="text-xs text-viva-600 w-24 text-right hidden md:block">{formatDate(doc.createdAt)}</span>
                </div>
                <button
                  type="button"
                  className="btn-sm btn-primary shrink-0"
                  onClick={() => medicoService.openDocumentoEnviado(doc.id)}
                >
                  Visualizar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MeusDocumentos;
