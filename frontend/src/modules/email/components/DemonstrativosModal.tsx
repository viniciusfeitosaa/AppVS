import { createPortal } from 'react-dom';
import { useMemo, useState } from 'react';
import { EMAIL_CONTATOS } from '../constants/email-contatos.const';
import {
  MESES_OPCOES,
  anosDisponiveis,
  buildAssuntoDemonstrativo,
  buildCorpoDemonstrativo,
  buildEmailsDemonstrativo,
  buildEmailsDemonstrativoComDados,
  formatCompetenciaLabel,
  periodoPadraoCompetencia,
  type CompetenciaDemonstrativo,
  type EmailDemonstrativoPersonalizado,
} from '../utils/email-demonstrativo-template.util';
import { parseDemonstrativoTabela } from '../utils/parse-demonstrativo-tabela.util';
import { formatValorBRL } from '../utils/parse-nf-tabela.util';

export type DemonstrativosResultado =
  | { modo: 'unico'; assunto: string; corpoTexto: string }
  | {
      modo: 'personalizado';
      assunto: string;
      emails: EmailDemonstrativoPersonalizado[];
      /** true quando a tabela colada tem locais/valores (gera PDF no envio). */
      comTabelaProducao: boolean;
      competencia: CompetenciaDemonstrativo;
    };

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (resultado: DemonstrativosResultado) => void;
};

type EstiloCompetencia = 'mes_ano' | 'periodo';

const DemonstrativosModal = ({ open, onClose, onConfirm }: Props) => {
  const agora = new Date();
  const periodoIni = periodoPadraoCompetencia(agora);

  const [estilo, setEstilo] = useState<EstiloCompetencia>('mes_ano');
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [dataInicio, setDataInicio] = useState(periodoIni.dataInicio);
  const [dataFim, setDataFim] = useState(periodoIni.dataFim);
  const [lista, setLista] = useState('');
  const [usarListaPadrao, setUsarListaPadrao] = useState(true);

  const competencia: CompetenciaDemonstrativo = useMemo(() => {
    if (estilo === 'periodo') {
      return { tipo: 'periodo', dataInicio, dataFim };
    }
    return { tipo: 'mes_ano', mes, ano };
  }, [estilo, mes, ano, dataInicio, dataFim]);

  const parseTabela = useMemo(() => {
    if (!lista.trim()) return null;
    return parseDemonstrativoTabela(lista);
  }, [lista]);

  const periodoInvalido =
    estilo === 'periodo' &&
    (!dataInicio || !dataFim || dataInicio > dataFim);

  if (!open) return null;

  const handleConfirm = () => {
    if (periodoInvalido) return;
    const assunto = buildAssuntoDemonstrativo(competencia);

    if (parseTabela && parseTabela.destinatarios.length > 0) {
      onConfirm({
        modo: 'personalizado',
        assunto,
        emails: buildEmailsDemonstrativoComDados(competencia, parseTabela.destinatarios),
        comTabelaProducao: true,
        competencia,
      });
      onClose();
      return;
    }

    const contacts = usarListaPadrao
      ? EMAIL_CONTATOS.map((c) => ({ nome: c.nome, email: c.email }))
      : [];

    if (contacts.length > 0) {
      onConfirm({
        modo: 'personalizado',
        assunto,
        emails: buildEmailsDemonstrativo(competencia, contacts),
        comTabelaProducao: false,
        competencia,
      });
    } else {
      onConfirm({
        modo: 'unico',
        assunto,
        corpoTexto: buildCorpoDemonstrativo(competencia),
      });
    }
    onClose();
  };

  const qtdTabela = parseTabela?.destinatarios.length ?? 0;
  const qtdListaPadrao = usarListaPadrao && !lista.trim() ? EMAIL_CONTATOS.length : 0;
  const qtdPersonalizados = qtdTabela > 0 ? qtdTabela : qtdListaPadrao;
  const podeConfirmar = (!lista.trim() || qtdTabela > 0) && !periodoInvalido;

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
              Cole a tabela (nome, e-mail, onde trabalhou, valor) para gerar e-mail + PDF por profissional.
            </p>
          </div>
          <button type="button" className="btn text-sm border border-viva-300 bg-white text-viva-800 shrink-0" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium text-viva-900 mb-1">
              Tipo de competência
            </legend>
            <div className="flex flex-col sm:flex-row gap-2">
              <label
                className={`flex-1 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                  estilo === 'mes_ano'
                    ? 'border-viva-500 bg-viva-50 text-viva-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-viva-200'
                }`}
              >
                <input
                  type="radio"
                  name="estilo-competencia"
                  className="mt-0.5"
                  checked={estilo === 'mes_ano'}
                  onChange={() => setEstilo('mes_ano')}
                />
                <span>
                  <span className="font-medium block">Mês e ano</span>
                  <span className="text-xs text-gray-600">Ex.: agosto de 2026</span>
                </span>
              </label>
              <label
                className={`flex-1 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                  estilo === 'periodo'
                    ? 'border-viva-500 bg-viva-50 text-viva-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-viva-200'
                }`}
              >
                <input
                  type="radio"
                  name="estilo-competencia"
                  className="mt-0.5"
                  checked={estilo === 'periodo'}
                  onChange={() => setEstilo('periodo')}
                />
                <span>
                  <span className="font-medium block">Período (datas)</span>
                  <span className="text-xs text-gray-600">Ex.: 15/06/2026 a 14/07/2026</span>
                </span>
              </label>
            </div>
          </fieldset>

          {estilo === 'mes_ano' ? (
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
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="demo-inicio" className="block text-sm font-medium text-viva-900 mb-1">
                  Data início
                </label>
                <input
                  id="demo-inicio"
                  type="date"
                  className="input w-full"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="demo-fim" className="block text-sm font-medium text-viva-900 mb-1">
                  Data fim
                </label>
                <input
                  id="demo-fim"
                  type="date"
                  className="input w-full"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
              {periodoInvalido && (
                <p className="col-span-2 text-xs text-red-700">
                  Informe as duas datas; a data fim deve ser igual ou posterior à data início.
                </p>
              )}
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-viva-900 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={usarListaPadrao}
              onChange={(e) => setUsarListaPadrao(e.target.checked)}
              disabled={!!lista.trim()}
            />
            <span>
              Sem tabela colada: usar lista de contatos ({EMAIL_CONTATOS.length}) — e-mail sem PDF de valores
            </span>
          </label>

          <div>
            <label htmlFor="demo-lista" className="block text-sm font-medium text-viva-900 mb-1">
              Tabela colada (recomendado)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Uma linha por local: <strong>Nome</strong> · <strong>e-mail</strong> ·{' '}
              <strong>onde trabalhou</strong> · <strong>valor</strong>. Várias linhas do mesmo e-mail
              somam o total no PDF.
            </p>
            <textarea
              id="demo-lista"
              className="input w-full min-h-[160px] font-mono text-xs"
              value={lista}
              onChange={(e) => setLista(e.target.value)}
              placeholder={
                'João da Silva  joao@email.com  UPA Alto de Pinheiros  R$ 1.200,00\nMaria Souza  maria@email.com  UPA Tatuapé  R$ 980,50'
              }
            />
          </div>

          {parseTabela && lista.trim() && (
            <div className="rounded-lg border border-viva-100 bg-viva-50 px-3 py-2 text-xs space-y-2">
              <p className="font-medium text-viva-900">
                {parseTabela.destinatarios.length} profissional
                {parseTabela.destinatarios.length !== 1 ? 'is' : ''} com dados
                {parseTabela.ignorados.length > 0 && (
                  <span className="text-amber-800 font-normal">
                    {' '}
                    · {parseTabela.ignorados.length} linha(s) ignorada(s)
                  </span>
                )}
              </p>
              {parseTabela.destinatarios.slice(0, 5).map((d) => (
                <p key={d.email} className="text-viva-800">
                  {d.nome}: {d.linhas.length} local(is) · total {formatValorBRL(d.total)}
                </p>
              ))}
              {parseTabela.destinatarios.length > 5 && (
                <p className="text-viva-600">… e mais {parseTabela.destinatarios.length - 5}</p>
              )}
            </div>
          )}

          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-700 space-y-1">
            <p>
              <span className="font-medium">Competência:</span> {formatCompetenciaLabel(competencia)}
            </p>
            <p>
              <span className="font-medium">Assunto:</span> {buildAssuntoDemonstrativo(competencia)}
            </p>
            {qtdPersonalizados > 0 && (
              <p className="text-viva-700">
                Serão gerados <strong>{qtdPersonalizados}</strong> e-mail(s)
                {qtdTabela > 0 ? ' com PDF anexo (nome, locais, valor e total)' : ''}.
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
