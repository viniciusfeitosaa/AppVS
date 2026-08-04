import type { EmailNfPersonalizado } from '../utils/email-nf-template.util';
import type { EmailDemonstrativoPersonalizado } from '../utils/email-demonstrativo-template.util';
import { formatValorBRL, parseValorBRL } from '../utils/parse-nf-tabela.util';

type BatchItem = EmailNfPersonalizado | EmailDemonstrativoPersonalizado;

type Props = {
  assunto: string;
  emails: BatchItem[];
  onCancel: () => void;
  onSaveDrafts: () => void;
  onSendAll: () => void;
  busy?: boolean;
  variante?: 'nf' | 'demonstrativo';
  /** Demonstrativo com tabela de produção → PDF será anexado no envio. */
  comPdfAnexo?: boolean;
};

function totalFromDados(e: BatchItem): number | null {
  const d = (e as EmailDemonstrativoPersonalizado).dados;
  if (d) return d.total;
  return null;
}

function locaisFromDados(e: BatchItem): number | null {
  const d = (e as EmailDemonstrativoPersonalizado).dados;
  if (d) return d.linhas.length;
  return null;
}

const EmailNfBatchPreview = ({
  assunto,
  emails,
  onCancel,
  onSaveDrafts,
  onSendAll,
  busy,
  variante = 'nf',
  comPdfAnexo = false,
}: Props) => {
  const isNf = variante === 'nf';
  const isDemo = variante === 'demonstrativo';
  const showValores = isNf || comPdfAnexo;

  return (
    <div className={`card space-y-4 border-l-4 ${isNf ? 'border-sky-500' : 'border-emerald-500'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-viva-900 font-display">
            {isNf ? 'Envio NF personalizado' : 'Envio de Demonstrativos'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {emails.length} e-mail(s) individual(is)
            {isNf ? ' com valores por UPA' : comPdfAnexo ? ' com PDF (nome, locais, valor e total)' : ' personalizados'}
            . Assunto: <span className="font-medium text-viva-800">{assunto}</span>
          </p>
          {isDemo && comPdfAnexo && (
            <p className="text-xs text-emerald-800 mt-1">
              No envio, cada e-mail levará o PDF do demonstrativo em anexo.
            </p>
          )}
        </div>
        <button type="button" className="btn btn-secondary text-sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </div>

      <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-viva-100 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-viva-50 sticky top-0">
            <tr className="text-left text-viva-800">
              <th className="py-2 px-3 font-medium">Profissional</th>
              <th className="py-2 px-3 font-medium">E-mail</th>
              {showValores && (
                <>
                  <th className="py-2 px-3 font-medium">{isNf ? 'UPAs' : 'Locais'}</th>
                  <th className="py-2 px-3 font-medium text-right">
                    {isNf ? 'Total bruto' : 'Total'}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {emails.map((e) => {
              const totalDados = totalFromDados(e);
              const locaisDados = locaisFromDados(e);

              let total = totalDados ?? 0;
              let count = locaisDados ?? 0;

              if (totalDados == null) {
                total = e.corpoTexto
                  .split('\n')
                  .filter((l) => l.startsWith('•'))
                  .reduce((acc, linha) => {
                    const m = linha.match(/R\$\s*[\d.,]+/);
                    return acc + (m ? parseValorBRL(m[0]) : 0);
                  }, 0);
                count = (e.corpoTexto.match(/^• .+$/gm) ?? []).length;
              }

              return (
                <tr key={e.email} className="border-t border-viva-50 align-top">
                  <td className="py-2 px-3 font-medium text-viva-900">{e.nome}</td>
                  <td className="py-2 px-3 text-gray-600">{e.email}</td>
                  {showValores && (
                    <>
                      <td className="py-2 px-3 text-gray-600">{count}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatValorBRL(total)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-viva-700 font-medium">Pré-visualizar 1º e-mail</summary>
        {emails[0] && (
          <pre className="mt-2 p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs whitespace-pre-wrap overflow-x-auto">
            {emails[0].corpoTexto}
          </pre>
        )}
      </details>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={onSaveDrafts} disabled={busy}>
          Salvar {emails.length} rascunho(s)
        </button>
        <button type="button" className="btn btn-primary" onClick={onSendAll} disabled={busy}>
          {busy
            ? 'Processando…'
            : comPdfAnexo
              ? `Enviar ${emails.length} e-mail(s) com PDF`
              : `Enviar ${emails.length} e-mail(s) agora`}
        </button>
      </div>
    </div>
  );
};

export default EmailNfBatchPreview;
