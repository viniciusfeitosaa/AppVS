import { FormEvent, useMemo, useState } from 'react';
import { EMAIL_CONTATOS } from '../constants/email-contatos.const';
import EmitirNFModal, { type EmitirNFResultado } from './EmitirNFModal';
import DemonstrativosModal, { type DemonstrativosResultado } from './DemonstrativosModal';
import EmailNfBatchPreview from './EmailNfBatchPreview';
import type { EmailNfPersonalizado } from '../utils/email-nf-template.util';
import type { EmailDemonstrativoPersonalizado, CompetenciaDemonstrativo } from '../utils/email-demonstrativo-template.util';
import { buildDemonstrativoPainelPdfBase64 } from '../utils/build-demonstrativo-pdf.util';
import type {
  CreateEmailMensagemPayload,
  EnviarAgoraEmailPayload,
} from '../types';

type Props = {
  onSubmit: (payload: CreateEmailMensagemPayload) => Promise<void>;
  onSendNow?: (payload: EnviarAgoraEmailPayload) => Promise<void>;
  onSubmitMany?: (payloads: CreateEmailMensagemPayload[]) => Promise<void>;
  onSendMany?: (payloads: EnviarAgoraEmailPayload[]) => Promise<void>;
  disabled?: boolean;
  smtpConfigurado?: boolean;
};

type BatchVariante = 'nf' | 'demonstrativo';
type BatchEmailItem = EmailNfPersonalizado | EmailDemonstrativoPersonalizado;

const EmailComposeForm = ({ onSubmit, onSendNow, onSubmitMany, onSendMany, disabled, smtpConfigurado }: Props) => {
  const [assunto, setAssunto] = useState('');
  const [selecionado, setSelecionado] = useState('');
  const [destinatariosSelecionados, setDestinatariosSelecionados] = useState<string[]>([]);
  const [destinatariosExtras, setDestinatariosExtras] = useState('');
  const [corpoTexto, setCorpoTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nfModalOpen, setNfModalOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [batchEmails, setBatchEmails] = useState<BatchEmailItem[] | null>(null);
  const [batchAssunto, setBatchAssunto] = useState('');
  const [batchVariante, setBatchVariante] = useState<BatchVariante>('nf');
  /** Demonstrativo colado com locais/valores → gera PDF no envio. */
  const [batchComPdf, setBatchComPdf] = useState(false);
  const [batchCompetencia, setBatchCompetencia] = useState<CompetenciaDemonstrativo | null>(null);

  const contatosPorEmail = useMemo(
    () => new Map(EMAIL_CONTATOS.map((c) => [c.email.toLowerCase(), c.nome])),
    []
  );

  const todosDestinatarios = useMemo(() => {
    const extras = destinatariosExtras
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return [...new Set([...destinatariosSelecionados.map((e) => e.toLowerCase()), ...extras])];
  }, [destinatariosSelecionados, destinatariosExtras]);

  const buildPayload = (): CreateEmailMensagemPayload => ({
    assunto,
    corpoTexto,
    destinatarios: todosDestinatarios,
  });

  const adicionarContato = () => {
    if (!selecionado) return;
    setDestinatariosSelecionados((prev) =>
      prev.includes(selecionado) ? prev : [...prev, selecionado]
    );
    setSelecionado('');
  };

  const removerContato = (email: string) => {
    setDestinatariosSelecionados((prev) => prev.filter((e) => e !== email));
  };

  const adicionarTodos = () => {
    const emails = EMAIL_CONTATOS.map((c) => c.email);
    setDestinatariosSelecionados(emails);
  };

  const limparSelecionados = () => {
    setDestinatariosSelecionados([]);
  };

  const aplicarResultadoBatch = (
    resultado: EmitirNFResultado | DemonstrativosResultado,
    variante: BatchVariante
  ) => {
    if (resultado.modo === 'personalizado') {
      setBatchEmails(resultado.emails);
      setBatchAssunto(resultado.assunto);
      setBatchVariante(variante);
      if (variante === 'demonstrativo' && 'comTabelaProducao' in resultado) {
        setBatchComPdf(resultado.comTabelaProducao);
        setBatchCompetencia(resultado.competencia);
      } else {
        setBatchComPdf(false);
        setBatchCompetencia(null);
      }
      setAssunto('');
      setCorpoTexto('');
      setDestinatariosSelecionados([]);
      setDestinatariosExtras('');
      return;
    }

    setBatchEmails(null);
    setBatchComPdf(false);
    setBatchCompetencia(null);
    setAssunto(resultado.assunto);
    setCorpoTexto(resultado.corpoTexto);
    if (!destinatariosSelecionados.length) {
      setDestinatariosSelecionados(EMAIL_CONTATOS.map((c) => c.email));
    }
  };

  const cancelarBatch = () => {
    setBatchEmails(null);
    setBatchAssunto('');
    setBatchComPdf(false);
    setBatchCompetencia(null);
  };

  const payloadsFromBatchDraft = (): CreateEmailMensagemPayload[] =>
    (batchEmails ?? []).map((e) => ({
      assunto: e.assunto,
      corpoTexto: e.corpoTexto,
      destinatarios: [e.email],
    }));

  const payloadsFromBatchSend = async (): Promise<EnviarAgoraEmailPayload[]> => {
    const list = batchEmails ?? [];
    const out: EnviarAgoraEmailPayload[] = [];

    for (const e of list) {
      const item: EnviarAgoraEmailPayload = {
        assunto: e.assunto,
        corpoTexto: e.corpoTexto,
        destinatarios: [e.email],
      };

      if (batchComPdf && batchCompetencia) {
        const demo = e as EmailDemonstrativoPersonalizado;
        if (demo.dados) {
          const pdf = await buildDemonstrativoPainelPdfBase64({
            competencia: batchCompetencia,
            nome: demo.nome,
            linhas: demo.dados.linhas,
            total: demo.dados.total,
          });
          item.anexos = [
            {
              filename: pdf.filename,
              contentBase64: pdf.base64,
              contentType: 'application/pdf',
            },
          ];
        }
      }

      out.push(item);
    }

    return out;
  };

  const handleBatch = async (mode: 'draft' | 'send') => {
    if (!batchEmails?.length) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === 'send') {
        const payloads = await payloadsFromBatchSend();
        if (onSendMany) {
          await onSendMany(payloads);
        } else if (onSendNow) {
          for (const p of payloads) {
            await onSendNow(p);
          }
        } else {
          throw new Error('Envio imediato não configurado');
        }
      } else {
        const payloads = payloadsFromBatchDraft();
        if (onSubmitMany) {
          await onSubmitMany(payloads);
        } else {
          for (const p of payloads) {
            await onSubmit(p);
          }
        }
      }
      resetForm();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `Não foi possível processar os e-mails de ${batchVariante === 'nf' ? 'NF' : 'demonstrativo'}`
      );
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setAssunto('');
    setSelecionado('');
    setDestinatariosSelecionados([]);
    setDestinatariosExtras('');
    setCorpoTexto('');
    setBatchEmails(null);
    setBatchAssunto('');
    setBatchComPdf(false);
    setBatchCompetencia(null);
  };

  const handle = async (mode: 'draft' | 'send') => {
    setError(null);
    if (!todosDestinatarios.length) {
      setError('Selecione ao menos um destinatário na lista ou informe um e-mail extra.');
      return;
    }
    setBusy(true);
    try {
      const payload = buildPayload();
      if (mode === 'send' && onSendNow) {
        await onSendNow(payload);
      } else {
        await onSubmit(payload);
      }
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o e-mail');
    } finally {
      setBusy(false);
    }
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handle('draft');
  };

  if (batchEmails?.length) {
    return (
      <div className="space-y-4">
        <EmailNfBatchPreview
          assunto={batchAssunto}
          emails={batchEmails}
          variante={batchVariante}
          comPdfAnexo={batchComPdf}
          onCancel={cancelarBatch}
          onSaveDrafts={() => void handleBatch('draft')}
          onSendAll={() => void handleBatch('send')}
          busy={busy || disabled}
        />
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onFormSubmit} className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-viva-900 font-display">Novo e-mail</h3>
          <p className="text-sm text-gray-600 mt-1">
            Escolha contatos na lista ou adicione e-mails extras manualmente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => setDemoModalOpen(true)}
            disabled={disabled || busy}
          >
            Demonstrativos
          </button>
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => setNfModalOpen(true)}
            disabled={disabled || busy}
          >
            Emitir NF
          </button>
        </div>
      </div>

      <EmitirNFModal
        open={nfModalOpen}
        onClose={() => setNfModalOpen(false)}
        onConfirm={(r) => aplicarResultadoBatch(r, 'nf')}
      />

      <DemonstrativosModal
        open={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onConfirm={(r) => aplicarResultadoBatch(r, 'demonstrativo')}
      />

      {!smtpConfigurado && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          SMTP/Resend não detectado no servidor — você pode salvar rascunhos, mas o envio falhará até configurar o e-mail no `.env`.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-viva-900 mb-1">Assunto</label>
        <input
          className="input w-full"
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          placeholder="Ex.: Comunicado aos médicos"
          required
          disabled={disabled || busy}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-viva-900">Destinatários</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="input w-full flex-1"
            value={selecionado}
            onChange={(e) => setSelecionado(e.target.value)}
            disabled={disabled || busy}
          >
            <option value="">Selecione um contato...</option>
            {EMAIL_CONTATOS.map((c) => (
              <option key={c.email} value={c.email}>
                {c.nome} — {c.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary whitespace-nowrap"
            onClick={adicionarContato}
            disabled={disabled || busy || !selecionado}
          >
            Adicionar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="text-xs text-viva-700 hover:text-viva-900 underline"
            onClick={adicionarTodos}
            disabled={disabled || busy}
          >
            Selecionar todos ({EMAIL_CONTATOS.length})
          </button>
          {destinatariosSelecionados.length > 0 && (
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700 underline"
              onClick={limparSelecionados}
              disabled={disabled || busy}
            >
              Limpar seleção
            </button>
          )}
        </div>

        {destinatariosSelecionados.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-2">
            {destinatariosSelecionados.map((email) => (
              <li
                key={email}
                className="inline-flex items-center gap-1 rounded-full bg-viva-50 border border-viva-200 px-2.5 py-1 text-xs text-viva-900"
              >
                <span className="max-w-[220px] truncate" title={`${contatosPorEmail.get(email.toLowerCase()) ?? ''} <${email}>`}>
                  {contatosPorEmail.get(email.toLowerCase()) ?? email}
                </span>
                <button
                  type="button"
                  className="text-viva-600 hover:text-red-600 font-bold leading-none"
                  onClick={() => removerContato(email)}
                  disabled={disabled || busy}
                  aria-label={`Remover ${email}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            E-mails extras (opcional)
          </label>
          <textarea
            className="input w-full min-h-[60px] text-sm"
            value={destinatariosExtras}
            onChange={(e) => setDestinatariosExtras(e.target.value)}
            placeholder="Outros e-mails, um por linha ou separados por vírgula"
            disabled={disabled || busy}
          />
        </div>

        {todosDestinatarios.length > 0 && (
          <p className="text-xs text-gray-500">
            {todosDestinatarios.length} destinatário{todosDestinatarios.length !== 1 ? 's' : ''} no total
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-viva-900 mb-1">Mensagem</label>
        <textarea
          className="input w-full min-h-[160px]"
          value={corpoTexto}
          onChange={(e) => setCorpoTexto(e.target.value)}
          placeholder="Escreva o conteúdo do e-mail..."
          required
          disabled={disabled || busy}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-secondary" disabled={disabled || busy}>
          Salvar rascunho
        </button>
        {onSendNow && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={disabled || busy}
            onClick={() => void handle('send')}
          >
            Enviar agora
          </button>
        )}
      </div>
    </form>
  );
};

export default EmailComposeForm;
