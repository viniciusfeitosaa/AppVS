-- CreateEnum
CREATE TYPE "ConteudoPrecadastroStatus" AS ENUM ('AGUARDANDO', 'ACEITO', 'CONVERTIDO');

-- AlterTable
ALTER TABLE "conteudo_participantes"
  ADD COLUMN "precadastro_status" "ConteudoPrecadastroStatus" NOT NULL DEFAULT 'AGUARDANDO',
  ADD COLUMN "token_cadastro_corpo" VARCHAR(64),
  ADD COLUMN "precadastro_aceito_em" TIMESTAMP(3),
  ADD COLUMN "precadastro_aceito_por_master_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "conteudo_participantes_token_cadastro_corpo_key" ON "conteudo_participantes"("token_cadastro_corpo");

-- CreateIndex
CREATE INDEX "conteudo_participantes_tenant_id_precadastro_status_idx" ON "conteudo_participantes"("tenant_id", "precadastro_status");
