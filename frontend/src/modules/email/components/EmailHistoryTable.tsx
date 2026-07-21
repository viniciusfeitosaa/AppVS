import type { EmailMensagem } from '../types';

type Props = {
  mensagens: EmailMensagem[];
  loading?: boolean;
  onEnviar?: (id: string) => void;
  onExcluir?: (id: string) => void;
  busyId?: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function statusBadge(status: EmailMensagem['status']) {
  switch (status) {
    case 'ENVIADO':
      return 'bg-emerald-100 text-emerald-800';
    case 'FALHA':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-amber-100 text-amber-800';
  }
}

const EmailHistoryTable = ({ mensagens, loading, onEnviar, onExcluir, busyId }: Props) => {
  if (loading) {
    return <div className="card text-sm text-gray-600">Carregando histórico...</div>;
  }

  if (!mensagens.length) {
    return (
      <div className="card border-dashed">
        <p className="text-gray-600 text-sm">Nenhum e-mail registrado ainda. Crie o primeiro em &quot;Novo e-mail&quot;.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-viva-800 border-b border-viva-100">
            <th className="py-2 pr-3 font-medium">Assunto</th>
            <th className="py-2 pr-3 font-medium">Destinatários</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Criado</th>
            <th className="py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {mensagens.map((m) => (
            <tr key={m.id} className="border-b border-viva-50 align-top">
              <td className="py-3 pr-3 font-medium text-viva-900">{m.assunto}</td>
              <td className="py-3 pr-3 text-gray-600 max-w-[200px] truncate" title={m.destinatarios.join(', ')}>
                {m.destinatarios.join(', ')}
              </td>
              <td className="py-3 pr-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(m.status)}`}>
                  {m.status}
                </span>
                {m.erroEnvio && (
                  <p className="text-xs text-red-600 mt-1 max-w-[180px]" title={m.erroEnvio}>
                    {m.erroEnvio}
                  </p>
                )}
              </td>
              <td className="py-3 pr-3 text-gray-600 whitespace-nowrap">{formatDate(m.createdAt)}</td>
              <td className="py-3">
                <div className="flex flex-wrap gap-2">
                  {m.status === 'RASCUNHO' && onEnviar && (
                    <button
                      type="button"
                      className="text-xs btn btn-primary py-1 px-2"
                      disabled={busyId === m.id}
                      onClick={() => onEnviar(m.id)}
                    >
                      Enviar
                    </button>
                  )}
                  {m.status !== 'ENVIADO' && onExcluir && (
                    <button
                      type="button"
                      className="text-xs btn btn-secondary py-1 px-2"
                      disabled={busyId === m.id}
                      onClick={() => onExcluir(m.id)}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EmailHistoryTable;
