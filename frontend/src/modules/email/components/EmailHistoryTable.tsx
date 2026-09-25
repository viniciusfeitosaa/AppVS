import { useMemo, useState } from 'react';
import type { EmailMensagem } from '../types';

type Props = {
  mensagens: EmailMensagem[];
  total?: number;
  loading?: boolean;
  onEnviar?: (id: string) => void;
  onExcluir?: (id: string) => void;
  busyId?: string | null;
  search: string;
  onSearchChange: (q: string) => void;
  pageSize: number;
  offset: number;
  onPrevPage: () => void;
  onNextPage: () => void;
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

function EmailConteudoModal({
  mensagem,
  onClose,
}: {
  mensagem: EmailMensagem;
  onClose: () => void;
}) {
  const temHtml = Boolean(mensagem.corpoHtml?.trim());
  const temTexto = Boolean(mensagem.corpoTexto?.trim());

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 overflow-y-auto flex items-start sm:items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-conteudo-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-viva-100 shrink-0">
          <div className="min-w-0">
            <h3 id="email-conteudo-modal-title" className="text-base font-bold text-viva-900 font-display truncate">
              {mensagem.assunto}
            </h3>
            <p className="text-xs text-viva-600 mt-0.5">
              {mensagem.destinatarios.join(', ') || 'Sem destinatários'}
              {' · '}
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge(mensagem.status)}`}>
                {mensagem.status}
              </span>
              {mensagem.enviadoEm ? ` · enviado ${formatDate(mensagem.enviadoEm)}` : ` · ${formatDate(mensagem.createdAt)}`}
            </p>
          </div>
          <button type="button" className="btn btn-secondary text-xs py-1 px-2 shrink-0" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 space-y-3">
          {!temHtml && !temTexto ? (
            <p className="text-sm text-gray-600">Nenhum corpo de e-mail foi gravado neste registro.</p>
          ) : temHtml ? (
            <iframe
              title="Prévia do e-mail"
              className="w-full min-h-[360px] h-[55vh] rounded-lg border border-viva-100 bg-white"
              sandbox=""
              srcDoc={mensagem.corpoHtml ?? ''}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-viva-900 font-sans bg-viva-50/60 rounded-lg border border-viva-100 p-3">
              {mensagem.corpoTexto}
            </pre>
          )}
          {temHtml && temTexto && (
            <details className="text-sm">
              <summary className="cursor-pointer text-viva-700 font-medium">Ver versão em texto</summary>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-viva-800 font-sans bg-viva-50/60 rounded-lg border border-viva-100 p-3">
                {mensagem.corpoTexto}
              </pre>
            </details>
          )}
          <p className="text-xs text-gray-500">
            Anexos (ex.: PDF do demonstrativo) não ficam armazenados no histórico — só o assunto e o corpo do e-mail.
          </p>
        </div>
      </div>
    </div>
  );
}

const EmailHistoryTable = ({
  mensagens,
  total = 0,
  loading,
  onEnviar,
  onExcluir,
  busyId,
  search,
  onSearchChange,
  pageSize,
  offset,
  onPrevPage,
  onNextPage,
}: Props) => {
  const [verMensagem, setVerMensagem] = useState<EmailMensagem | null>(null);

  const rangeLabel = useMemo(() => {
    if (!total) return 'Nenhuma mensagem';
    const from = offset + 1;
    const to = Math.min(offset + mensagens.length, total);
    return `Exibindo ${from}–${to} de ${total}`;
  }, [total, offset, mensagens.length]);

  const canPrev = offset > 0;
  const canNext = offset + mensagens.length < total;

  return (
    <>
      <div className="card space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1 max-w-md">
            <label htmlFor="email-hist-busca" className="block text-xs font-medium text-viva-600 mb-1">
              Buscar (assunto ou e-mail)
            </label>
            <input
              id="email-hist-busca"
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ex.: Demonstrativo, @gmail.com…"
              className="w-full py-2 px-3 text-sm border border-viva-200 rounded-lg outline-none bg-viva-50/50 focus:ring-2 focus:ring-viva-500/30 focus:border-viva-500"
            />
          </div>
          <p className="text-xs text-viva-600 whitespace-nowrap">{loading ? 'A carregar…' : rangeLabel}</p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Carregando histórico...</p>
        ) : !mensagens.length ? (
          <p className="text-gray-600 text-sm border border-dashed border-viva-200 rounded-lg p-4">
            Nenhum e-mail encontrado{search.trim() ? ' para esta busca' : ' ainda'}.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
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
                    <td
                      className="py-3 pr-3 text-gray-600 max-w-[200px] truncate"
                      title={m.destinatarios.join(', ')}
                    >
                      {m.destinatarios.join(', ')}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(m.status)}`}
                      >
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
                        <button
                          type="button"
                          className="text-xs btn btn-secondary py-1 px-2"
                          onClick={() => setVerMensagem(m)}
                        >
                          Ver
                        </button>
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
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-viva-100">
          <p className="text-xs text-viva-600">
            Página de {pageSize} · os e-mails não foram apagados — antes só apareciam os 50 mais recentes.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs btn btn-secondary py-1 px-3 disabled:opacity-40"
              disabled={!canPrev || loading}
              onClick={onPrevPage}
            >
              ← Anterior
            </button>
            <button
              type="button"
              className="text-xs btn btn-secondary py-1 px-3 disabled:opacity-40"
              disabled={!canNext || loading}
              onClick={onNextPage}
            >
              Próximo →
            </button>
          </div>
        </div>
      </div>

      {verMensagem && (
        <EmailConteudoModal mensagem={verMensagem} onClose={() => setVerMensagem(null)} />
      )}
    </>
  );
};

export default EmailHistoryTable;
