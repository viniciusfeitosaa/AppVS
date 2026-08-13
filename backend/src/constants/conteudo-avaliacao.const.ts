/**
 * Modelo de perguntas da avaliação pós-aula (frequência).
 * Tipos: estrelas (1–5), radio (opinião), quiz (múltipla escolha com gabarito), texto.
 */
export type AvaliacaoPerguntaTipo = 'estrelas' | 'radio' | 'texto' | 'quiz';

export type AvaliacaoOpcao = {
  valor: string;
  label: string;
};

export type AvaliacaoPergunta = {
  id: string;
  tipo: AvaliacaoPerguntaTipo;
  texto: string;
  /** Obrigatória no envio (default true). */
  obrigatoria?: boolean;
  opcoes?: AvaliacaoOpcao[];
  /** Valor da opção correta (só para `quiz`). Não expor no formulário público. */
  respostaCorreta?: string;
};

export type AvaliacaoFormulario = {
  titulo: string;
  subtitulo?: string | null;
  /** Ex.: tema / palestrante legível */
  meta?: { tema?: string; palestrante?: string } | null;
  perguntas: AvaliacaoPergunta[];
};

export type AvaliacaoRespostasMap = Record<string, string | number>;

const ESTRELAS_PADRAO: AvaliacaoOpcao[] = [
  { valor: '5', label: '⭐⭐⭐⭐⭐ Excelente' },
  { valor: '4', label: '⭐⭐⭐⭐ Muito boa' },
  { valor: '3', label: '⭐⭐⭐ Boa' },
  { valor: '2', label: '⭐⭐ Regular' },
  { valor: '1', label: '⭐ Precisa melhorar' },
];

/**
 * Template fixo "Avaliação da Aula – Programa Viva Atualiza".
 * Tema e palestrante vêm do conteúdo/evento no momento de aplicar.
 */
export function buildTemplateVivaAtualizaAvaliacao(opts: {
  tema: string;
  palestrante: string;
}): AvaliacaoFormulario {
  return {
    titulo: 'Avaliação da Aula – Programa Viva Atualiza',
    subtitulo: null,
    meta: {
      tema: opts.tema.trim() || '—',
      palestrante: opts.palestrante.trim() || '—',
    },
    perguntas: [
      {
        id: 'q1_avaliacao_geral',
        tipo: 'estrelas',
        texto: 'Como você avalia esta aula?',
        obrigatoria: true,
        opcoes: ESTRELAS_PADRAO,
      },
      {
        id: 'q2_relevancia',
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
        id: 'q3_clareza_palestrante',
        tipo: 'estrelas',
        texto: 'O palestrante apresentou o conteúdo de forma clara e objetiva?',
        obrigatoria: true,
        opcoes: ESTRELAS_PADRAO,
      },
      {
        id: 'q4_duvida',
        tipo: 'texto',
        texto: 'Você ficou com alguma dúvida sobre o tema?',
        obrigatoria: false,
      },
      {
        id: 'q5_mais_gostou',
        tipo: 'texto',
        texto: 'O que você mais gostou na aula?',
        obrigatoria: false,
      },
      {
        id: 'q6_melhorias',
        tipo: 'texto',
        texto: 'O que pode ser melhorado nas próximas aulas?',
        obrigatoria: false,
      },
      {
        id: 'q7_proximo_tema',
        tipo: 'texto',
        texto: 'Qual tema você gostaria de ver em uma próxima edição do Viva Atualiza?',
        obrigatoria: false,
      },
      {
        id: 'q8_recomendaria',
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
        id: 'q9_mensagem_palestrante',
        tipo: 'texto',
        texto: 'Deixe uma mensagem ou comentário para o palestrante.',
        obrigatoria: false,
      },
    ],
  };
}

export function sanitizeAvaliacaoFormulario(raw: unknown): AvaliacaoFormulario | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const titulo = typeof o.titulo === 'string' ? o.titulo.trim() : '';
  if (!titulo) return null;
  const perguntasRaw = Array.isArray(o.perguntas) ? o.perguntas : [];
  const perguntas: AvaliacaoPergunta[] = [];
  for (const p of perguntasRaw) {
    if (!p || typeof p !== 'object') continue;
    const q = p as Record<string, unknown>;
    const id = typeof q.id === 'string' ? q.id.trim() : '';
    const texto = typeof q.texto === 'string' ? q.texto.trim() : '';
    const tipo = q.tipo;
    if (!id || !texto) continue;
    if (tipo !== 'estrelas' && tipo !== 'radio' && tipo !== 'texto' && tipo !== 'quiz') continue;
    const opcoes: AvaliacaoOpcao[] | undefined = Array.isArray(q.opcoes)
      ? q.opcoes
          .map((op) => {
            if (!op || typeof op !== 'object') return null;
            const o2 = op as Record<string, unknown>;
            const valor = String(o2.valor ?? '').trim();
            const label = String(o2.label ?? '').trim();
            if (!valor || !label) return null;
            return { valor, label };
          })
          .filter((x): x is AvaliacaoOpcao => !!x)
      : undefined;
    if ((tipo === 'estrelas' || tipo === 'radio' || tipo === 'quiz') && (!opcoes || opcoes.length === 0)) {
      continue;
    }
    let respostaCorreta: string | undefined;
    if (tipo === 'quiz') {
      const rc = typeof q.respostaCorreta === 'string' ? q.respostaCorreta.trim() : '';
      if (!rc || !opcoes!.some((op) => op.valor === rc)) continue;
      if (opcoes!.length < 2) continue;
      respostaCorreta = rc;
    }
    perguntas.push({
      id,
      tipo,
      texto,
      obrigatoria: q.obrigatoria !== false,
      opcoes,
      ...(respostaCorreta ? { respostaCorreta } : {}),
    });
  }
  if (!perguntas.length) return null;
  const meta =
    o.meta && typeof o.meta === 'object'
      ? {
          tema: String((o.meta as Record<string, unknown>).tema ?? '') || undefined,
          palestrante: String((o.meta as Record<string, unknown>).palestrante ?? '') || undefined,
        }
      : null;
  return {
    titulo,
    subtitulo: typeof o.subtitulo === 'string' ? o.subtitulo : null,
    meta,
    perguntas,
  };
}

/** Remove gabarito — para app, link público e qualquer cliente que não seja admin. */
export function formAvaliacaoSemGabarito(form: AvaliacaoFormulario): AvaliacaoFormulario {
  return {
    ...form,
    perguntas: form.perguntas.map((p) => {
      if (p.tipo !== 'quiz' || !p.respostaCorreta) return p;
      const { respostaCorreta: _rc, ...rest } = p;
      return rest;
    }),
  };
}

/** Valida respostas contra o formulário; devolve mapa limpo ou lança mensagem. */
export function validarRespostasAvaliacao(
  form: AvaliacaoFormulario,
  respostasRaw: unknown
): AvaliacaoRespostasMap {
  const respostas: AvaliacaoRespostasMap = {};
  const src =
    respostasRaw && typeof respostasRaw === 'object' && !Array.isArray(respostasRaw)
      ? (respostasRaw as Record<string, unknown>)
      : {};

  for (const p of form.perguntas) {
    const raw = src[p.id];
    const empty =
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && !raw.trim()) ||
      (typeof raw === 'number' && !Number.isFinite(raw));

    if (empty) {
      if (p.obrigatoria !== false) {
        throw { statusCode: 400, message: `Responda: ${p.texto}` };
      }
      continue;
    }

    if (p.tipo === 'texto') {
      const t = String(raw).trim().slice(0, 4000);
      if (t) respostas[p.id] = t;
      continue;
    }

    const valor = String(raw).trim();
    const ok = (p.opcoes || []).some((o) => o.valor === valor);
    if (!ok) {
      throw { statusCode: 400, message: `Opção inválida em: ${p.texto}` };
    }
    respostas[p.id] = valor;
  }

  return respostas;
}
