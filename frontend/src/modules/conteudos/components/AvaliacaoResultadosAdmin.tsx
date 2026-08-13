import { useState } from 'react';
import type { AvaliacaoResultadosPayload } from '../api/conteudo.service';

type Props = {
  data: AvaliacaoResultadosPayload | null | undefined;
  loading?: boolean;
  onRefresh?: () => void;
};

function tipoLabel(tipo: string) {
  if (tipo === 'estrelas') return 'Estrelas';
  if (tipo === 'radio') return 'Múltipla escolha';
  if (tipo === 'quiz') return 'Questão';
  if (tipo === 'texto') return 'Texto livre';
  return tipo;
}

function labelOpcao(
  pergunta: AvaliacaoResultadosPayload['perguntas'][0] | undefined,
  valor: string
): string {
  if (!pergunta?.opcoes) return valor;
  return pergunta.opcoes.find((o) => o.valor === valor)?.label || valor;
}

const AvaliacaoResultadosAdmin = ({ data, loading, onRefresh }: Props) => {
  const [expandTextos, setExpandTextos] = useState<Record<string, boolean>>({});
  const [expandPessoa, setExpandPessoa] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <p className="text-sm text-viva-600 py-4 text-center">Carregando resultados…</p>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-viva-600 py-2">
        Sem dados de resultados ainda. Use Atualizar após as primeiras respostas.
      </p>
    );
  }

  if (!data.formulario) {
    return (
      <div className="rounded-xl border border-dashed border-viva-200 bg-viva-50/40 px-4 py-6 text-center">
        <p className="text-sm font-medium text-viva-900">Nenhum formulário de avaliação salvo</p>
        <p className="mt-1 text-xs text-viva-600">
          Crie as perguntas acima e salve para começar a coletar respostas.
        </p>
      </div>
    );
  }

  const { resumo, perguntas, respostas } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-viva-600">
          As respostas só entram aqui quando o inscrito confirma no{' '}
          <strong>link de frequência</strong> ou no <strong>app</strong> com o e-mail/conta da
          inscrição (e o switch de perguntas ativo).
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs font-medium text-viva-700 underline disabled:opacity-50"
          >
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        )}
      </div>

      {resumo.avaliaram === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950 space-y-1">
          <p className="font-semibold">Ainda sem avaliações gravadas neste conteúdo.</p>
          <ul className="list-disc list-inside text-amber-900/90 space-y-0.5">
            <li>Frequência aberta e switch de perguntas ligado</li>
            <li>Participante usa o e-mail exato da inscrição (link) ou app logado</li>
            <li>
              Presentes agora: {resumo.presentes} · Inscritos: {resumo.inscritos}
            </li>
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Inscritos', value: resumo.inscritos },
          { label: 'Presentes', value: resumo.presentes },
          { label: 'Avaliaram', value: resumo.avaliaram },
          {
            label: '% dos presentes',
            value:
              resumo.taxaRespostaPresentes != null
                ? `${resumo.taxaRespostaPresentes}%`
                : '—',
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-viva-100 bg-viva-50/50 px-3 py-2.5 text-center"
          >
            <p className="text-lg font-semibold text-viva-950 tabular-nums">{c.value}</p>
            <p className="text-[11px] text-viva-600">{c.label}</p>
          </div>
        ))}
      </div>

      {perguntas.length === 0 ? (
        <p className="text-xs text-viva-600">Formulário sem perguntas.</p>
      ) : (
        <ul className="space-y-4">
          {perguntas.map((p, idx) => (
            <li
              key={p.id}
              className="rounded-xl border border-viva-100 bg-white p-3 space-y-2 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-viva-500">
                    {idx + 1}. {tipoLabel(p.tipo)}
                    {p.mediaEstrelas != null ? ` · média ${p.mediaEstrelas}` : ''}
                    {p.acertos
                      ? ` · acertos ${p.acertos.corretos}/${p.acertos.total} (${p.acertos.pct}%)`
                      : ''}
                  </p>
                  <p className="text-sm font-medium text-viva-950">{p.texto}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {p.totalRespostas} resp.
                </span>
              </div>

              {p.tipo !== 'texto' && p.opcoes && p.opcoes.length > 0 && (
                <ul className="space-y-1.5 pt-1">
                  {p.opcoes.map((o) => {
                    const isCorrect = p.tipo === 'quiz' && p.respostaCorreta === o.valor;
                    return (
                      <li key={o.valor} className="space-y-0.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span
                            className={`truncate ${
                              isCorrect ? 'font-semibold text-emerald-800' : 'text-viva-800'
                            }`}
                          >
                            {o.label}
                            {isCorrect ? ' ✓' : ''}
                          </span>
                          <span className="shrink-0 tabular-nums text-viva-600">
                            {o.total} ({o.pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isCorrect ? 'bg-emerald-500' : 'bg-sky-500'
                            }`}
                            style={{ width: `${Math.min(100, o.pct)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {p.tipo === 'texto' && (
                <div className="pt-1 space-y-2">
                  {!(p.textos && p.textos.length) ? (
                    <p className="text-xs text-viva-500 italic">Nenhum comentário ainda.</p>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-xs font-medium text-viva-700 underline"
                        onClick={() =>
                          setExpandTextos((s) => ({ ...s, [p.id]: !s[p.id] }))
                        }
                      >
                        {expandTextos[p.id]
                          ? 'Ocultar mensagens'
                          : `Ver ${p.textos.length} mensagem${p.textos.length === 1 ? '' : 'ns'}`}
                      </button>
                      {(expandTextos[p.id] || p.textos.length <= 3) && (
                        <ul className="max-h-48 overflow-y-auto space-y-2 divide-y divide-viva-50">
                          {p.textos.map((t) => (
                            <li key={`${t.participanteId}-${t.avaliadoEm}`} className="pt-2 first:pt-0">
                              <p className="text-[11px] font-medium text-viva-800">
                                {t.nome}{' '}
                                <span className="font-normal text-viva-500">
                                  · {new Date(t.avaliadoEm).toLocaleString('pt-BR')}
                                </span>
                              </p>
                              <p className="text-sm text-viva-900 whitespace-pre-wrap mt-0.5">
                                {t.resposta}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-viva-100 pt-4">
        <h4 className="text-sm font-semibold text-viva-950">Respostas por pessoa</h4>
        {respostas.length === 0 ? (
          <p className="text-xs text-viva-600 rounded-lg border border-dashed border-viva-200 px-3 py-4 text-center">
            Ainda não há avaliações enviadas neste conteúdo.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-viva-100 rounded-xl border border-viva-100">
            {respostas.map((r) => {
              const open = expandPessoa === r.participanteId;
              return (
                <li key={r.participanteId} className="text-sm">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-viva-50/60"
                    onClick={() =>
                      setExpandPessoa(open ? null : r.participanteId)
                    }
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-viva-950 block truncate">{r.nome}</span>
                      <span className="text-[11px] text-viva-500">
                        {r.email} · {new Date(r.avaliadoEm).toLocaleString('pt-BR')}
                      </span>
                    </span>
                    <span className="text-xs text-viva-600 shrink-0">
                      {open ? '▲' : '▼'}
                    </span>
                  </button>
                  {open && (
                    <dl className="px-3 pb-3 space-y-2 bg-viva-50/30">
                      {perguntas.map((p) => {
                        const raw = r.respostas[p.id];
                        if (raw == null || raw === '') return null;
                        const display =
                          p.tipo === 'texto'
                            ? raw
                            : labelOpcao(p, raw);
                        const okQuiz =
                          p.tipo === 'quiz' &&
                          p.respostaCorreta != null &&
                          raw === p.respostaCorreta;
                        return (
                          <div key={p.id}>
                            <dt className="text-[11px] font-medium text-viva-600">{p.texto}</dt>
                            <dd
                              className={`text-sm mt-0.5 whitespace-pre-wrap ${
                                p.tipo === 'quiz'
                                  ? okQuiz
                                    ? 'text-emerald-800'
                                    : 'text-amber-900'
                                  : 'text-viva-900'
                              }`}
                            >
                              {display}
                              {p.tipo === 'quiz'
                                ? okQuiz
                                  ? ' (acertou)'
                                  : ' (errou)'
                                : ''}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AvaliacaoResultadosAdmin;
