import { useEffect, useState } from 'react';
import type { AvaliacaoFormulario, AvaliacaoPergunta, AvaliacaoOpcao } from './AvaliacaoPerguntasForm';

const ESTRELAS_PADRAO: AvaliacaoOpcao[] = [
  { valor: '5', label: '⭐⭐⭐⭐⭐ Excelente' },
  { valor: '4', label: '⭐⭐⭐⭐ Muito boa' },
  { valor: '3', label: '⭐⭐⭐ Boa' },
  { valor: '2', label: '⭐⭐ Regular' },
  { valor: '1', label: '⭐ Precisa melhorar' },
];

const OP_RADIO_EXEMPLO: AvaliacaoOpcao[] = [
  { valor: 'sim', label: 'Sim' },
  { valor: 'nao', label: 'Não' },
];

function newId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptyPergunta(tipo: AvaliacaoPergunta['tipo'] = 'texto'): AvaliacaoPergunta {
  if (tipo === 'estrelas') {
    return {
      id: newId(),
      tipo: 'estrelas',
      texto: '',
      obrigatoria: true,
      opcoes: [...ESTRELAS_PADRAO],
    };
  }
  if (tipo === 'radio') {
    return {
      id: newId(),
      tipo: 'radio',
      texto: '',
      obrigatoria: true,
      opcoes: OP_RADIO_EXEMPLO.map((o) => ({ ...o })),
    };
  }
  if (tipo === 'quiz') {
    return {
      id: newId(),
      tipo: 'quiz',
      texto: '',
      obrigatoria: true,
      opcoes: [
        { valor: 'a', label: 'Opção A' },
        { valor: 'b', label: 'Opção B' },
        { valor: 'c', label: 'Opção C' },
        { valor: 'd', label: 'Opção D' },
      ],
      respostaCorreta: 'a',
    };
  }
  return { id: newId(), tipo: 'texto', texto: '', obrigatoria: false };
}

/** Modelo inicial vazio + meta opcional do evento. */
export function formVazioAvaliacao(meta?: { tema?: string; palestrante?: string }): AvaliacaoFormulario {
  return {
    titulo: 'Avaliação da aula',
    subtitulo: null,
    meta: {
      tema: meta?.tema || '',
      palestrante: meta?.palestrante || '',
    },
    perguntas: [],
  };
}

/**
 * Modelo de perguntas do Viva Atualiza — só para preencher o editor;
 * o master pode editar/remover depois.
 */
export function formModeloVivaAtualiza(meta: {
  tema: string;
  palestrante: string;
}): AvaliacaoFormulario {
  return {
    titulo: 'Avaliação da Aula – Programa Viva Atualiza',
    subtitulo: null,
    meta: {
      tema: meta.tema.trim() || '—',
      palestrante: meta.palestrante.trim() || '—',
    },
    perguntas: [
      {
        id: newId(),
        tipo: 'estrelas',
        texto: 'Como você avalia esta aula?',
        obrigatoria: true,
        opcoes: [...ESTRELAS_PADRAO],
      },
      {
        id: newId(),
        tipo: 'radio',
        texto: 'O conteúdo foi relevante para sua prática profissional?',
        obrigatoria: true,
        opcoes: [
          { valor: 'muito_relevante', label: 'Muito relevante' },
          { valor: 'relevante', label: 'Relevante' },
          { valor: 'pouco_relevante', label: 'Pouco relevante' },
          { valor: 'nao_relevante', label: 'Não foi relevante' },
        ],
      },
      {
        id: newId(),
        tipo: 'estrelas',
        texto: 'O palestrante apresentou o conteúdo de forma clara e objetiva?',
        obrigatoria: true,
        opcoes: [...ESTRELAS_PADRAO],
      },
      {
        id: newId(),
        tipo: 'texto',
        texto: 'Você ficou com alguma dúvida sobre o tema?',
        obrigatoria: false,
      },
      {
        id: newId(),
        tipo: 'texto',
        texto: 'O que você mais gostou na aula?',
        obrigatoria: false,
      },
      {
        id: newId(),
        tipo: 'texto',
        texto: 'O que pode ser melhorado nas próximas aulas?',
        obrigatoria: false,
      },
      {
        id: newId(),
        tipo: 'texto',
        texto: 'Qual tema você gostaria de ver em uma próxima edição do Viva Atualiza?',
        obrigatoria: false,
      },
      {
        id: newId(),
        tipo: 'radio',
        texto: 'Você recomendaria esta capacitação para outro profissional da saúde?',
        obrigatoria: true,
        opcoes: [
          { valor: 'sim', label: 'Sim' },
          { valor: 'talvez', label: 'Talvez' },
          { valor: 'nao', label: 'Não' },
        ],
      },
      {
        id: newId(),
        tipo: 'texto',
        texto: 'Deixe uma mensagem ou comentário para o palestrante.',
        obrigatoria: false,
      },
    ],
  };
}

type Props = {
  /** Formulário já salvo no evento (ou null). */
  initial: AvaliacaoFormulario | null;
  /** Pré-preenche tema/palestrante ao criar do zero. */
  metaSugerida?: { tema?: string; palestrante?: string };
  busy?: boolean;
  onSave: (form: AvaliacaoFormulario) => void;
};

const AvaliacaoEditorAdmin = ({
  initial,
  metaSugerida,
  busy,
  onSave,
}: Props) => {
  const [form, setForm] = useState<AvaliacaoFormulario>(() =>
    initial ?? formVazioAvaliacao(metaSugerida)
  );

  useEffect(() => {
    setForm(initial ?? formVazioAvaliacao(metaSugerida));
  }, [initial, metaSugerida]);

  const updatePergunta = (idx: number, patch: Partial<AvaliacaoPergunta>) => {
    setForm((f) => {
      const perguntas = f.perguntas.map((p, i) => {
        if (i !== idx) return p;
        const next = { ...p, ...patch };
        if (patch.tipo === 'estrelas' && !patch.opcoes) {
          next.opcoes = [...ESTRELAS_PADRAO];
          next.respostaCorreta = undefined;
        }
        if (patch.tipo === 'radio' && !patch.opcoes) {
          next.opcoes = OP_RADIO_EXEMPLO.map((o) => ({ ...o }));
          next.respostaCorreta = undefined;
        }
        if (patch.tipo === 'quiz' && !patch.opcoes) {
          next.opcoes = [
            { valor: 'a', label: 'Opção A' },
            { valor: 'b', label: 'Opção B' },
            { valor: 'c', label: 'Opção C' },
            { valor: 'd', label: 'Opção D' },
          ];
          next.respostaCorreta = 'a';
        }
        if (patch.tipo === 'texto') {
          next.opcoes = undefined;
          next.respostaCorreta = undefined;
        }
        return next;
      });
      return { ...f, perguntas };
    });
  };

  const updateOpcao = (qIdx: number, oIdx: number, patch: Partial<AvaliacaoOpcao>) => {
    setForm((f) => {
      const perguntas = f.perguntas.map((p, i) => {
        if (i !== qIdx) return p;
        const prev = p.opcoes || [];
        const opcoes = prev.map((o, j) => (j === oIdx ? { ...o, ...patch } : o));
        let respostaCorreta = p.respostaCorreta;
        // Se alterou o valor da opção marcada como correta, mantém o vínculo.
        if (p.tipo === 'quiz' && patch.valor !== undefined && prev[oIdx]) {
          if (respostaCorreta === prev[oIdx]!.valor) {
            respostaCorreta = patch.valor.trim() || respostaCorreta;
          }
        }
        return { ...p, opcoes, respostaCorreta };
      });
      return { ...f, perguntas };
    });
  };

  const addOpcao = (qIdx: number) => {
    setForm((f) => {
      const perguntas = f.perguntas.map((p, i) => {
        if (i !== qIdx) return p;
        const n = (p.opcoes || []).length + 1;
        const letter = String.fromCharCode(96 + Math.min(n, 26)); // a, b, c...
        return {
          ...p,
          opcoes: [
            ...(p.opcoes || []),
            {
              valor: p.tipo === 'quiz' ? letter : `opcao_${n}`,
              label: `Opção ${n}`,
            },
          ],
        };
      });
      return { ...f, perguntas };
    });
  };

  const removeOpcao = (qIdx: number, oIdx: number) => {
    setForm((f) => {
      const perguntas = f.perguntas.map((p, i) => {
        if (i !== qIdx) return p;
        const removed = p.opcoes?.[oIdx];
        const opcoes = (p.opcoes || []).filter((_, j) => j !== oIdx);
        let respostaCorreta = p.respostaCorreta;
        if (removed && respostaCorreta === removed.valor) {
          respostaCorreta = opcoes[0]?.valor;
        }
        return { ...p, opcoes, respostaCorreta };
      });
      return { ...f, perguntas };
    });
  };

  const movePergunta = (idx: number, dir: -1 | 1) => {
    setForm((f) => {
      const j = idx + dir;
      if (j < 0 || j >= f.perguntas.length) return f;
      const perguntas = [...f.perguntas];
      const t = perguntas[idx]!;
      perguntas[idx] = perguntas[j]!;
      perguntas[j] = t;
      return { ...f, perguntas };
    });
  };

  const handleSave = () => {
    const titulo = form.titulo.trim();
    if (!titulo) {
      window.alert('Informe o título da avaliação.');
      return;
    }
    if (!form.perguntas.length) {
      window.alert('Adicione ao menos uma pergunta.');
      return;
    }
    for (const p of form.perguntas) {
      if (!p.texto.trim()) {
        window.alert('Todas as perguntas precisam de texto.');
        return;
      }
      if (
        (p.tipo === 'radio' || p.tipo === 'estrelas' || p.tipo === 'quiz') &&
        !(p.opcoes && p.opcoes.length >= 2)
      ) {
        window.alert(`A pergunta “${p.texto || '(sem texto)'}” precisa de ao menos 2 opções.`);
        return;
      }
      if (p.tipo === 'quiz') {
        const rc = (p.respostaCorreta || '').trim();
        if (!rc || !(p.opcoes || []).some((o) => o.valor === rc)) {
          window.alert(
            `Marque a resposta correta em: “${p.texto.trim() || 'questão com opções'}”.`
          );
          return;
        }
      }
    }
    onSave({
      ...form,
      titulo,
      meta: {
        tema: (form.meta?.tema || '').trim() || undefined,
        palestrante: (form.meta?.palestrante || '').trim() || undefined,
      },
      perguntas: form.perguntas.map((p) => {
        const opcoes = p.opcoes?.map((o) => ({
          valor: o.valor.trim() || o.label.trim().toLowerCase().replace(/\s+/g, '_'),
          label: o.label.trim(),
        }));
        let respostaCorreta = p.respostaCorreta?.trim();
        if (p.tipo === 'quiz' && opcoes?.length) {
          // re-mapeia se o valor interno foi normalizado a partir do rótulo
          if (respostaCorreta && !opcoes.some((o) => o.valor === respostaCorreta)) {
            const idx = (p.opcoes || []).findIndex((o) => o.valor === p.respostaCorreta);
            if (idx >= 0) respostaCorreta = opcoes[idx]!.valor;
          }
          if (!respostaCorreta) respostaCorreta = opcoes[0]!.valor;
        }
        return {
          ...p,
          texto: p.texto.trim(),
          opcoes,
          respostaCorreta: p.tipo === 'quiz' ? respostaCorreta : undefined,
        };
      }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm space-y-1 sm:col-span-2">
          <span className="font-medium text-viva-900">Título da avaliação</span>
          <input
            className="input w-full"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            placeholder="Ex.: Avaliação da Aula – Programa Viva Atualiza"
            disabled={busy}
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="font-medium text-viva-900">Tema (opcional)</span>
          <input
            className="input w-full"
            value={form.meta?.tema || ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, meta: { ...f.meta, tema: e.target.value } }))
            }
            placeholder="Protocolo de Dor Torácica"
            disabled={busy}
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="font-medium text-viva-900">Palestrante (opcional)</span>
          <input
            className="input w-full"
            value={form.meta?.palestrante || ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                meta: { ...f.meta, palestrante: e.target.value },
              }))
            }
            placeholder="Dr. Bruno Brandão"
            disabled={busy}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-viva-300 bg-white px-3 py-2 text-xs font-medium text-viva-800 hover:bg-viva-50 disabled:opacity-50"
          disabled={busy}
          onClick={() => setForm((f) => ({ ...f, perguntas: [...f.perguntas, emptyPergunta('estrelas')] }))}
        >
          + Estrelas (1–5)
        </button>
        <button
          type="button"
          className="rounded-lg border border-viva-300 bg-white px-3 py-2 text-xs font-medium text-viva-800 hover:bg-viva-50 disabled:opacity-50"
          disabled={busy}
          onClick={() => setForm((f) => ({ ...f, perguntas: [...f.perguntas, emptyPergunta('radio')] }))}
        >
          + Múltipla escolha
        </button>
        <button
          type="button"
          className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50"
          disabled={busy}
          onClick={() => setForm((f) => ({ ...f, perguntas: [...f.perguntas, emptyPergunta('quiz')] }))}
        >
          + Questão (gabarito)
        </button>
        <button
          type="button"
          className="rounded-lg border border-viva-300 bg-white px-3 py-2 text-xs font-medium text-viva-800 hover:bg-viva-50 disabled:opacity-50"
          disabled={busy}
          onClick={() => setForm((f) => ({ ...f, perguntas: [...f.perguntas, emptyPergunta('texto')] }))}
        >
          + Resposta aberta
        </button>
        <button
          type="button"
          className="rounded-lg border border-dashed border-viva-400 bg-viva-50 px-3 py-2 text-xs font-medium text-viva-800 hover:bg-viva-100 disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            if (
              form.perguntas.length > 0 &&
              !window.confirm('Substituir as perguntas atuais pelo modelo Viva Atualiza?')
            ) {
              return;
            }
            setForm(
              formModeloVivaAtualiza({
                tema: form.meta?.tema || metaSugerida?.tema || '',
                palestrante: form.meta?.palestrante || metaSugerida?.palestrante || '',
              })
            );
          }}
        >
          Preencher com modelo Viva Atualiza
        </button>
      </div>

      {form.perguntas.length === 0 ? (
        <p className="text-xs text-viva-600 rounded-lg border border-dashed border-viva-200 px-3 py-4 text-center">
          Nenhuma pergunta ainda. Use os botões acima para criar (cada conteúdo pode ter as suas).
        </p>
      ) : (
        <ul className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
          {form.perguntas.map((p, idx) => (
            <li
              key={p.id}
              className="rounded-xl border border-viva-100 bg-white p-3 space-y-2 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-viva-700">Pergunta {idx + 1}</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="text-xs text-viva-600 underline disabled:opacity-40"
                    disabled={busy || idx === 0}
                    onClick={() => movePergunta(idx, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-xs text-viva-600 underline disabled:opacity-40"
                    disabled={busy || idx === form.perguntas.length - 1}
                    onClick={() => movePergunta(idx, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-700 underline"
                    disabled={busy}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        perguntas: f.perguntas.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Remover
                  </button>
                </div>
              </div>

              <label className="block text-sm space-y-1">
                <span className="text-xs text-viva-600">Enunciado</span>
                <input
                  className="input w-full text-sm"
                  value={p.texto}
                  onChange={(e) => updatePergunta(idx, { texto: e.target.value })}
                  placeholder="Texto da pergunta"
                  disabled={busy}
                />
              </label>

              <div className="flex flex-wrap gap-3 items-center">
                <label className="text-xs text-viva-800 flex items-center gap-1.5">
                  Tipo
                  <select
                    className="input py-1 text-xs"
                    value={p.tipo}
                    disabled={busy}
                    onChange={(e) =>
                      updatePergunta(idx, {
                        tipo: e.target.value as AvaliacaoPergunta['tipo'],
                      })
                    }
                  >
                    <option value="estrelas">Estrelas (1–5)</option>
                    <option value="radio">Múltipla escolha (opinião)</option>
                    <option value="quiz">Questão (com resposta correta)</option>
                    <option value="texto">Resposta aberta</option>
                  </select>
                </label>
                <label className="text-xs text-viva-800 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.obrigatoria !== false}
                    disabled={busy}
                    onChange={(e) => updatePergunta(idx, { obrigatoria: e.target.checked })}
                  />
                  Obrigatória
                </label>
              </div>

              {(p.tipo === 'radio' || p.tipo === 'estrelas' || p.tipo === 'quiz') && (
                <div className="space-y-1.5 rounded-lg bg-viva-50/60 border border-viva-100 p-2">
                  <p className="text-[11px] font-medium text-viva-700">
                    {p.tipo === 'quiz'
                      ? 'Opções — marque a correta'
                      : 'Opções de resposta'}
                  </p>
                  {(p.opcoes || []).map((o, oIdx) => (
                    <div key={`${p.id}_${oIdx}`} className="flex flex-wrap gap-1.5 items-center">
                      {p.tipo === 'quiz' && (
                        <label
                          className="flex items-center gap-1 text-[11px] text-sky-900 shrink-0 cursor-pointer"
                          title="Resposta correta"
                        >
                          <input
                            type="radio"
                            name={`correta_${p.id}`}
                            className="accent-sky-600"
                            disabled={busy}
                            checked={p.respostaCorreta === o.valor}
                            onChange={() =>
                              updatePergunta(idx, { respostaCorreta: o.valor })
                            }
                          />
                          OK
                        </label>
                      )}
                      <input
                        className="input flex-1 min-w-[8rem] text-xs py-1"
                        value={o.label}
                        disabled={busy}
                        onChange={(e) => updateOpcao(idx, oIdx, { label: e.target.value })}
                        placeholder="Rótulo (ex.: Excelente)"
                      />
                      <input
                        className="input w-24 text-xs py-1"
                        value={o.valor}
                        disabled={busy || p.tipo === 'estrelas'}
                        onChange={(e) => updateOpcao(idx, oIdx, { valor: e.target.value })}
                        placeholder="valor"
                        title="Valor interno"
                      />
                      {(p.tipo === 'radio' || p.tipo === 'quiz') && (
                        <button
                          type="button"
                          className="text-[11px] text-red-600 underline"
                          disabled={busy}
                          onClick={() => removeOpcao(idx, oIdx)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {(p.tipo === 'radio' || p.tipo === 'quiz') && (
                    <button
                      type="button"
                      className="text-[11px] text-viva-700 underline"
                      disabled={busy}
                      onClick={() => addOpcao(idx)}
                    >
                      + opção
                    </button>
                  )}
                  {p.tipo === 'quiz' && (
                    <p className="text-[10px] text-viva-600 pt-0.5">
                      O participante não vê qual é a correta. O gabarito fica só no admin.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-viva-100">
        <button
          type="button"
          className="rounded-lg bg-viva-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-viva-900 disabled:opacity-60"
          disabled={busy}
          onClick={handleSave}
        >
          {busy ? 'Salvando…' : 'Salvar perguntas'}
        </button>
        <p className="text-xs text-viva-600">
          Ative o switch em Frequência para exibir na tela de presença.
        </p>
      </div>
    </div>
  );
};

export default AvaliacaoEditorAdmin;
