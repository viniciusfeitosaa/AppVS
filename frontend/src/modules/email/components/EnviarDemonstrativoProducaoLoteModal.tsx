import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  buildAssuntoDemonstrativo,
  buildCorpoDemonstrativo,
} from '../utils/email-demonstrativo-template.util';
import { emailModuleService } from '../api/email.service';

export type DemoProducaoLoteItem = {
  medicoRotulo: string;
  nome: string;
  email: string;
  qtdProcedimentos: number;
  total: number;
  /** Linhas já resolvidas no relatório (tipagem frouxa para não acoplar a página). */
  linhas: Array<{
    dataFmt: string;
    medico: string;
    procedimento: string;
    posicao: string;
    valorReceber: number;
  }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  mes: number;
  ano: number;
  items: DemoProducaoLoteItem[];
  gerarPdf: (item: DemoProducaoLoteItem) => Promise<{ base64: string; filename: string }>;
  onConcluido?: (resumo: { enviados: number; falhas: number; semEmail: number }) => void;
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const EnviarDemonstrativoProducaoLoteModal = ({
  open,
  onClose,
  mes,
  ano,
  items,
  gerarPdf,
  onConcluido,
}: Props) => {
  const [rows, setRows] = useState<Array<DemoProducaoLoteItem & { incluir: boolean }>>([]);
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(
      items.map((it) => ({
        ...it,
        incluir: Boolean(it.email.trim()),
      }))
    );
    setError(null);
    setBusy(false);
    setProgresso(null);
  }, [open, items]);

  const selecionados = useMemo(
    () => rows.filter((r) => r.incluir && r.email.trim()),
    [rows]
  );
  const semEmail = useMemo(
    () => rows.filter((r) => !r.email.trim()),
    [rows]
  );

  if (!open) return null;

  const atualizarEmail = (medicoRotulo: string, email: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.medicoRotulo === medicoRotulo
          ? { ...r, email, incluir: r.incluir || Boolean(email.trim()) }
          : r
      )
    );
  };

  const toggleIncluir = (medicoRotulo: string) => {
    setRows((prev) =>
      prev.map((r) => (r.medicoRotulo === medicoRotulo ? { ...r, incluir: !r.incluir } : r))
    );
  };

  const handleEnviar = async () => {
    setError(null);
    if (selecionados.length === 0) {
      setError('Marque ao menos um profissional com e-mail válido.');
      return;
    }
    if (
      !window.confirm(
        `Enviar demonstrativo individual com PDF para ${selecionados.length} profissional(is)?`
      )
    ) {
      return;
    }

    setBusy(true);
    let enviados = 0;
    let falhas = 0;
    const erros: string[] = [];

    try {
      for (let i = 0; i < selecionados.length; i++) {
        const item = selecionados[i]!;
        setProgresso(`Enviando ${i + 1}/${selecionados.length}: ${item.nome}`);
        try {
          const pdf = await gerarPdf(item);
          await emailModuleService.enviarAgora({
            assunto: buildAssuntoDemonstrativo(mes, ano),
            corpoTexto: buildCorpoDemonstrativo(mes, ano, item.nome),
            destinatarios: [item.email.trim()],
            anexos: [
              {
                filename: pdf.filename,
                contentBase64: pdf.base64,
                contentType: 'application/pdf',
              },
            ],
          });
          enviados += 1;
        } catch (err: unknown) {
          falhas += 1;
          let msg = 'erro';
          if (axios.isAxiosError(err)) {
            const data = err.response?.data as { error?: string; message?: string } | undefined;
            msg = data?.error || data?.message || err.message;
          } else if (err instanceof Error) {
            msg = err.message;
          }
          erros.push(`${item.nome}: ${msg}`);
        }
      }

      onConcluido?.({ enviados, falhas, semEmail: semEmail.length });
      if (falhas === 0) {
        onClose();
      } else {
        setError(
          `Enviados: ${enviados}. Falhas: ${falhas}.\n${erros.slice(0, 8).join('\n')}${
            erros.length > 8 ? `\n… (+${erros.length - 8})` : ''
          }`
        );
      }
    } finally {
      setBusy(false);
      setProgresso(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/40 overflow-y-auto flex items-start sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-producao-lote-title"
      onClick={() => !busy && onClose()}
    >
      <div
        className="card w-full max-w-3xl border border-viva-200/70 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-viva-100 px-4 py-3">
          <div>
            <h3 id="demo-producao-lote-title" className="text-base font-bold text-viva-900 font-display">
              Enviar demonstrativos (todos)
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Um e-mail com PDF por profissional. {selecionados.length} selecionado(s)
              {semEmail.length > 0 ? ` · ${semEmail.length} sem e-mail` : ''}.
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

        <div className="px-4 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {semEmail.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Profissionais sem e-mail cadastrado ficam desmarcados — preencha o e-mail na tabela para incluir.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
              {error}
            </div>
          )}

          {progresso && (
            <div className="rounded-lg border border-viva-200 bg-viva-50 px-3 py-2 text-sm text-viva-800">
              {progresso}
            </div>
          )}

          <div className="overflow-x-auto border border-viva-100 rounded-lg max-h-[48vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-viva-50 sticky top-0">
                <tr className="text-left text-viva-800">
                  <th className="py-2 px-2 font-medium w-10">Enviar</th>
                  <th className="py-2 px-2 font-medium">Profissional</th>
                  <th className="py-2 px-2 font-medium">E-mail</th>
                  <th className="py-2 px-2 font-medium text-right">Procs.</th>
                  <th className="py-2 px-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.medicoRotulo} className="border-t border-viva-50 align-middle">
                    <td className="py-2 px-2">
                      <input
                        type="checkbox"
                        className="rounded border-viva-300 text-viva-600 focus:ring-viva-500"
                        checked={r.incluir && !!r.email.trim()}
                        disabled={busy || !r.email.trim()}
                        onChange={() => toggleIncluir(r.medicoRotulo)}
                        aria-label={`Incluir ${r.nome}`}
                        title={!r.email.trim() ? 'Informe o e-mail para poder incluir' : undefined}
                      />
                    </td>
                    <td className="py-2 px-2 font-medium text-viva-900 max-w-[180px]">
                      <span className="line-clamp-2" title={r.medicoRotulo}>
                        {r.nome}
                      </span>
                    </td>
                    <td className="py-2 px-2 min-w-[200px]">
                      <input
                        type="email"
                        className="input w-full py-1 text-xs"
                        value={r.email}
                        disabled={busy}
                        placeholder="email@exemplo.com"
                        onChange={(e) => atualizarEmail(r.medicoRotulo, e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-viva-700">
                      {r.qtdProcedimentos}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-semibold tabular-nums text-viva-900">
                      {BRL.format(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            disabled={busy || selecionados.length === 0}
          >
            {busy ? 'Enviando…' : `Enviar ${selecionados.length} demonstrativo(s)`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EnviarDemonstrativoProducaoLoteModal;
