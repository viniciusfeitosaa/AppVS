-- Avaliação da aula na frequência (perguntas no evento; respostas no participante)

ALTER TABLE "conteudo_eventos"
  ADD COLUMN IF NOT EXISTS "avaliacao_ativa" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "avaliacao_formulario" JSONB;

ALTER TABLE "conteudo_participantes"
  ADD COLUMN IF NOT EXISTS "avaliacao_respostas" JSONB,
  ADD COLUMN IF NOT EXISTS "avaliado_em" TIMESTAMP(3);
