import { createPortal } from 'react-dom';
import { useMemo, useState } from 'react';
import { EMAIL_CONTATOS } from '../constants/email-contatos.const';
import {
  MESES_OPCOES,
  anosDisponiveis,
  buildAssuntoDemonstrativo,
  buildCorpoDemonstrativo,
  buildEmailsDemonstrativo,
  parseDemonstrativoContatos,
} from '../utils/email-demonstrativo-template.util';
import type { EmailNfPersonalizado } from '../utils/email-nf-template.util';

export type DemonstrativosResultado =
  | { modo: 'unico'; assunto: string; corpoTexto: string }
  | { modo: 'personalizado'; assunto: string; emails: EmailNfPersonalizado[] };

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (resultado: DemonstrativosResultado) => void;
};

const DemonstrativosModal = ({ open, onClose, onConfirm }: Props) => {
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [lista, setLista] = useState('');
  const [usarListaPadrao, setUsarListaPadrao] = useState(true);

  const parseResult = useMemo(() => {
    if (!lista.trim()) return null;
    return parseDemonstrativoContatos(lista);
  }, [lista]);

  if (!open) return null;

  const handleConfirm = () => {
    const assunto = buildAssuntoDemonstrativo(mes, ano);
    const contactsFromPaste = parseResult?.destinatarios ?? [];
    const contacts =
      contactsFromPaste.length > 0
        ? contactsFromPaste
        : usarListaPadrao
          ? EMAIL_CONTATOS.map((c) => ({ nome: c.nome, email: c.email }))
          : [];

    if (contacts.length > 0) {
      onConfirm({
        modo: 'personalizado',
        assunto,
        emails: buildEmailsDemonstrativo(mes, ano, contacts),
      });
    } else {
      onConfirm({
        modo: 'unico',
        assunto,
        corpoTexto: buildCorpoDemonstrativo(mes, ano),
      });
    }
    onClose();
  };

  const qtdPersonalizados =
    (parseResult?.destinatarios.length ?? 0) > 0
      ? parseResult!.destinatarios.length
      : usarListaPadrao
        ? EMAIL_CONTATOS.length
        : 0;

  const podeConfirmar = !lista.trim() || (parseResult?.destinatarios.length ?? 0) > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/40 overflow-y-auto flex items-start sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demonstrativos-modal-title"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl border border-viva-200/70 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-viva-100 px-4 py-3">
          <div>
            <h3 id="demonstrativos-modal-title" className="text-base font-bold text-viva-900 font-display">
              Demonstrativos
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Selecione o mês/ano e gere e-mails individuais com o nome de cada médico.
            </p>
          </div>
          <button type="button" className="btn text-sm border border-viva-300 bg-white text-viva-800 shrink-0" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="demo-mes" className="block text-sm font-medium text-viva-900 mb-1">
                Mês
              </label>
              <select
                id="demo-mes"
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
              <label htmlFor="demo-ano" className="block text-sm font-medium text-viva-900 mb-1">
                Ano
              </label>
              <select
                id="demo-ano"
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

          <label className="flex items-start gap-2 text-sm text-viva-900 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={usarListaPadrao}
              onChange={(e) => setUsarListaPadrao(e.target.checked)}
              disabled={!!lista.trim()}
            />
            <span>
              Usar lista de contatos cadastrada ({EMAIL_CONTATOS.length} médicos) — um e-mail por pessoa
            </span>
          </label>

          <div>
            <label htmlFor="demo-lista" className="block text-sm font-medium text-viva-900 mb-1">
              Lista de destinatários (opcional)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Cole nome + e-mail (um por linha). Se preencher, esta lista substitui a lista padrão.
            </p>
            <textarea
              id="demo-lista"
              className="input w-full min-h-[120px] font-mono text-xs"
              value={lista}
              onChange={(e) => setLista(e.target.value)}
              placeholder="Nome Completo    email@exemplo.com"
            />
          </div>

          {parseResult && lista.trim() && (
            <div className="rounded-lg border border-viva-100 bg-viva-50 px-3 py-2 text-xs space-y-1">
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
            </div>
          )}

          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-700 space-y-1">
            <p>
              <span className="font-medium">Assunto:</span> {buildAssuntoDemonstrativo(mes, ano)}
            </p>
            {qtdPersonalizados > 0 && (
              <p className="text-viva-700">
                Serão gerados <strong>{qtdPersonalizados}</strong> e-mail(s) personalizados.
              </p>
            )}
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
            disabled={!podeConfirmar}
          >
            {qtdPersonalizados > 0
              ? `Gerar ${qtdPersonalizados} e-mail(s)`
              : 'Preencher e-mail'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DemonstrativosModal;
