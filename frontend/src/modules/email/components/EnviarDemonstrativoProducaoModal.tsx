import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  buildAssuntoDemonstrativo,
  buildCorpoDemonstrativo,
} from '../utils/email-demonstrativo-template.util';
import { emailModuleService } from '../api/email.service';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Nome completo do profissional (sem CRM, se possível). */
  nomeProfissional: string;
  emailSugerido: string | null;
  mes: number;
  ano: number;
  /** PDF já gerado (base64 puro ou data-URL). */
  pdfBase64: string;
  pdfFilename: string;
  onEnviado?: () => void;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const EnviarDemonstrativoProducaoModal = ({
  open,
  onClose,
  nomeProfissional,
  emailSugerido,
  mes,
  ano,
  pdfBase64,
  pdfFilename,
  onEnviado,
}: Props) => {
  const [email, setEmail] = useState(emailSugerido ?? '');
  const [assunto, setAssunto] = useState('');
  const [corpoTexto, setCorpoTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail(emailSugerido ?? '');
    setAssunto(buildAssuntoDemonstrativo(mes, ano));
    setCorpoTexto(buildCorpoDemonstrativo(mes, ano, nomeProfissional));
    setError(null);
    setBusy(false);
  }, [open, emailSugerido, mes, ano, nomeProfissional]);

  const pdfBytesApprox = useMemo(() => {
    const raw = pdfBase64.replace(/^data:[^;]+;base64,/, '');
    return Math.floor((raw.length * 3) / 4);
  }, [pdfBase64]);

  if (!open) return null;

  const podeEnviar = !!email.trim() && !!assunto.trim() && !!corpoTexto.trim() && !!pdfBase64 && !busy;

  const handleEnviar = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Informe o e-mail do destinatário.');
      return;
    }
    setBusy(true);
    try {
      await emailModuleService.enviarAgora({
        assunto: assunto.trim(),
        corpoTexto: corpoTexto.trim(),
        destinatarios: [email.trim()],
        anexos: [
          {
            filename: pdfFilename,
            contentBase64: pdfBase64,
            contentType: 'application/pdf',
          },
        ],
      });
      onEnviado?.();
      onClose();
    } catch (err: unknown) {
      let msg = '';
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; message?: string } | undefined;
        msg = data?.error || data?.message || err.message;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg || 'Não foi possível enviar o demonstrativo');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/40 overflow-y-auto flex items-start sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-producao-modal-title"
      onClick={() => !busy && onClose()}
    >
      <div
        className="card w-full max-w-2xl border border-viva-200/70 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-viva-100 px-4 py-3">
          <div>
            <h3 id="demo-producao-modal-title" className="text-base font-bold text-viva-900 font-display">
              Enviar demonstrativo
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Prévia do e-mail com o PDF da produção de {nomeProfissional}.
            </p>
          </div>
          <button
            type="button"
            className="btn text-sm border border-viva-300 bg-white text-viva-800 shrink-0"
            onClick={onClose}
            disabled={busy}
          >
            Fechar
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {!emailSugerido && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Não encontramos e-mail cadastrado para este profissional. Informe manualmente abaixo.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}

          <div>
            <label htmlFor="demo-prod-email" className="block text-sm font-medium text-viva-900 mb-1">
              Destinatário
            </label>
            <input
              id="demo-prod-email"
              type="email"
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="demo-prod-assunto" className="block text-sm font-medium text-viva-900 mb-1">
              Assunto
            </label>
            <input
              id="demo-prod-assunto"
              className="input w-full"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="demo-prod-corpo" className="block text-sm font-medium text-viva-900 mb-1">
              Corpo do e-mail
            </label>
            <textarea
              id="demo-prod-corpo"
              className="input w-full min-h-[200px] font-mono text-xs leading-relaxed"
              value={corpoTexto}
              onChange={(e) => setCorpoTexto(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-950">
            <p className="font-medium font-display">Anexo</p>
            <p className="mt-1 text-xs sm:text-sm break-all">
              {pdfFilename}{' '}
              <span className="text-emerald-800/80">({formatBytes(pdfBytesApprox)})</span>
            </p>
            <p className="mt-1 text-xs text-emerald-800/90">
              PDF da produção por médico referente ao período selecionado.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-viva-100 px-4 py-3">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleEnviar()}
            disabled={!podeEnviar}
          >
            {busy ? 'Enviando…' : 'Enviar agora'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EnviarDemonstrativoProducaoModal;
