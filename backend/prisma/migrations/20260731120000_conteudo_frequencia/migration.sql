-- CreateEnum
CREATE TYPE "ConteudoPresencaOrigem" AS ENUM ('APP', 'LINK_PUBLICO');

-- AlterTable conteudo_eventos
ALTER TABLE "conteudo_eventos" ADD COLUMN "token_frequencia" VARCHAR(64);
ALTER TABLE "conteudo_eventos" ADD COLUMN "frequencia_aberta" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conteudo_eventos" ADD COLUMN "frequencia_aberta_em" TIMESTAMP(3);
ALTER TABLE "conteudo_eventos" ADD COLUMN "frequencia_fechada_em" TIMESTAMP(3);

UPDATE "conteudo_eventos"
SET "token_frequencia" = substr(md5(id::text || random()::text || clock_timestamp()::text), 1, 32)
  || substr(md5(random()::text || id::text), 1, 16)
WHERE "token_frequencia" IS NULL;

ALTER TABLE "conteudo_eventos" ALTER COLUMN "token_frequencia" SET NOT NULL;

CREATE UNIQUE INDEX "conteudo_eventos_token_frequencia_key" ON "conteudo_eventos"("token_frequencia");

-- AlterTable conteudo_participantes
ALTER TABLE "conteudo_participantes" ADD COLUMN "presente_em" TIMESTAMP(3);
ALTER TABLE "conteudo_participantes" ADD COLUMN "presenca_origem" "ConteudoPresencaOrigem";
