import { createPortal } from 'react-dom';
import { useMemo, useState } from 'react';
import {
  MESES_OPCOES,
  anosDisponiveis,
  buildAssuntoNotaFiscal,
  buildCorpoNotaFiscal,
  buildEmailsNfPersonalizados,
  type EmailNfPersonalizado,
} from '../utils/email-nf-template.util';
import { parseNfTabela } from '../utils/parse-nf-tabela.util';

export type EmitirNFResultado =
  | { modo: 'unico'; assunto: string; corpoTexto: string }
  | { modo: 'personalizado'; assunto: string; emails: EmailNfPersonalizado[] };

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (resultado: EmitirNFResultado) => void;
};

const EmitirNFModal = ({ open, onClose, onConfirm }: Props) => {
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [tabela, setTabela] = useState('');

  const parseResult = useMemo(() => {
    if (!tabela.trim()) return null;
    return parseNfTabela(tabela);
  }, [tabela]);

  if (!open) return null;

  const handleConfirm = () => {
    const assunto = buildAssuntoNotaFiscal(mes, ano);

    if (parseResult?.destinatarios.length) {
      onConfirm({
        modo: 'personalizado',
        assunto,
        emails: buildEmailsNfPersonalizados(mes, ano, parseResult.destinatarios),
      });
    } else {
      onConfirm({
        modo: 'unico',
        assunto,
        corpoTexto: buildCorpoNotaFiscal(mes),
      });
    }
    onClose();
  };

  const podeConfirmarPersonalizado = !tabela.trim() || (parseResult?.destinatarios.length ?? 0) > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/40 overflow-y-auto flex items-start sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emitir-nf-modal-title"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl border border-viva-200/70 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-viva-100 px-4 py-3">
          <div>
            <h3 id="emitir-nf-modal-title" className="text-base font-bold text-viva-900 font-display">
              Emitir NF
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Mês/ano de competência e, opcionalmente, tabela de produção por profissional.
            </p>
          </div>
          <button type="button" className="btn text-sm border border-viva-300 bg-white text-viva-800 shrink-0" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="nf-mes" className="block text-sm font-medium text-viva-900 mb-1">
                Mês
              </label>
              <select
                id="nf-mes"
                className="input w-full"
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
              >
                {MESES_OPCOES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nf-ano" className="block text-sm font-medium text-viva-900 mb-1">
                Ano
              </label>
              <select
                id="nf-ano"
                className="input w-full"
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
              >
                {anosDisponiveis().map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="nf-tabela" className="block text-sm font-medium text-viva-900 mb-1">
              Tabela de produção (opcional)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Cole a planilha com nome, e-mail, UPA, horas e valor (R$ na linha seguinte). Cada pessoa receberá um e-mail com os seus valores.
            </p>
            <textarea
              id="nf-tabela"
              className="input w-full min-h-[140px] font-mono text-xs"
              value={tabela}
              onChange={(e) => setTabela(e.target.value)}
              placeholder="Cole aqui a tabela exportada da planilha..."
            />
          </div>

          {parseResult && tabela.trim() && (
            <div className="rounded-lg border border-viva-100 bg-viva-50 px-3 py-2 text-xs space-y-2">
              <p className="font-medium text-viva-900">
                {parseResult.destinatarios.length} destinatário
                {parseResult.destinatarios.length !== 1 ? 's' : ''} reconhecido
                {parseResult.destinatarios.length !== 1 ? 's' : ''}
                {parseResult.ignorados.length > 0 && (
                  <span className="text-amber-800 font-normal">
                    {' '}
                    · {parseResult.ignorados.length} linha(s) ignorada(s)
                  </span>
                )}
              </p>
              {parseResult.destinatarios.length > 0 && (
                <ul className="text-gray-700 space-y-1 max-h-32 overflow-y-auto">
                  {parseResult.destinatarios.slice(0, 8).map((d) => (
                    <li key={d.email}>
                      <strong>{d.nome}</strong> — {d.producoes.length} UPA(s) — {d.email}
                    </li>
                  ))}
                  {parseResult.destinatarios.length > 8 && (
                    <li className="text-gray-500">… e mais {parseResult.destinatarios.length - 8}</li>
                  )}
                </ul>
              )}
              {parseResult.destinatarios.length === 0 && (
                <p className="text-red-700">
                  Nenhum destinatário válido encontrado. Verifique o formato da tabela.
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-700">
            <p className="font-medium mb-1">Assunto:</p>
            <p className="break-words">{buildAssuntoNotaFiscal(mes, ano)}</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-viva-100 px-4 py-3">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!podeConfirmarPersonalizado}
          >
            {parseResult?.destinatarios.length
              ? `Gerar ${parseResult.destinatarios.length} e-mail(s)`
              : 'Preencher e-mail'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EmitirNFModal;
