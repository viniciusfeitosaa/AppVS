import { useState } from 'react';

export type AvaliacaoOpcao = {
  valor: string;
  label: string;
};

export type AvaliacaoPerguntaTipo = 'estrelas' | 'radio' | 'texto' | 'quiz';

export type AvaliacaoPergunta = {
  id: string;
  tipo: AvaliacaoPerguntaTipo;
  texto: string;
  /** Obrigatória no envio (default true). */
  obrigatoria?: boolean;
  opcoes?: AvaliacaoOpcao[];
  /** Valor da opção correta (só para `quiz`). Não vem na API pública. */
  respostaCorreta?: string;
};

export type AvaliacaoFormulario = {
  titulo: string;
  subtitulo?: string | null;
  /** Ex.: tema / palestrante legível */
  meta?: { tema?: string; palestrante?: string } | null;
  perguntas: AvaliacaoPergunta[];
};

export type AvaliacaoRespostasMap = Record<string, string>;

type Props = {
  form: AvaliacaoFormulario;
  value: AvaliacaoRespostasMap;
  onChange: (next: AvaliacaoRespostasMap) => void;
  disabled?: boolean;
};

/** Formulário dinâmico de avaliação de aula (estrelas / radio / quiz / texto). */
export function AvaliacaoPerguntasForm({ form, value, onChange, disabled }: Props) {
  const setResp = (id: string, v: string) => {
    onChange({ ...value, [id]: v });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-viva-950">{form.titulo}</h2>
        {(form.meta?.tema || form.meta?.palestrante) && (
          <div className="text-xs text-viva-700 space-y-0.5">
            {form.meta?.tema ? (
              <p>
                <span className="font-medium">Tema:</span> {form.meta.tema}
              </p>
            ) : null}
            {form.meta?.palestrante ? (
              <p>
                <span className="font-medium">Palestrante:</span> {form.meta.palestrante}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <ol className="space-y-5 list-decimal list-inside">
        {form.perguntas.map((p, idx) => (
          <li key={p.id} className="space-y-2 marker:font-semibold marker:text-viva-800">
            <p className="inline text-sm font-medium text-viva-900">
              {p.texto}
              {p.obrigatoria !== false ? <span className="text-red-600"> *</span> : null}
              {p.tipo === 'quiz' ? (
                <span className="ml-1.5 align-middle rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                  Questão
                </span>
              ) : null}
            </p>
            <div className="mt-2 ml-0 sm:ml-4 space-y-1.5">
              {(p.tipo === 'estrelas' || p.tipo === 'radio' || p.tipo === 'quiz') &&
                (p.opcoes || []).map((op) => (
                  <label
                    key={op.valor}
                    className={`flex items-start gap-2 text-sm text-viva-800 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-viva-50 ${
                      value[p.id] === op.valor ? 'bg-viva-50 ring-1 ring-viva-200' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name={p.id}
                      className="mt-0.5"
                      disabled={disabled}
                      checked={value[p.id] === op.valor}
                      onChange={() => setResp(p.id, op.valor)}
                    />
                    <span>{op.label}</span>
                  </label>
                ))}
              {p.tipo === 'texto' && (
                <textarea
                  className="w-full min-h-[72px] rounded-lg border border-viva-200 px-3 py-2 text-sm"
                  disabled={disabled}
                  value={value[p.id] || ''}
                  onChange={(e) => setResp(p.id, e.target.value)}
                  placeholder="Sua resposta (opcional)"
                  maxLength={4000}
                />
              )}
            </div>
            <span className="sr-only">Pergunta {idx + 1}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Hook simples para estado de respostas. */
export function useAvaliacaoRespostas(initial: AvaliacaoRespostasMap = {}) {
  return useState<AvaliacaoRespostasMap>(initial);
}

export default AvaliacaoPerguntasForm;
