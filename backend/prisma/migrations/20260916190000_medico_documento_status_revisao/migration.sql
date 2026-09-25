-- CreateEnum
CREATE TYPE "StatusRevisaoDocumentoPerfil" AS ENUM ('PENDENTE', 'OK', 'SOLICITADO');

-- AlterTable
ALTER TABLE "medico_documentos" ADD COLUMN IF NOT EXISTS "status_revisao" "StatusRevisaoDocumentoPerfil" NOT NULL DEFAULT 'PENDENTE';
ALTER TABLE "medico_documentos" ADD COLUMN IF NOT EXISTS "revisado_em" TIMESTAMP(3);
ALTER TABLE "medico_documentos" ADD COLUMN IF NOT EXISTS "revisado_por_master_id" VARCHAR(36);
ALTER TABLE "medico_documentos" ADD COLUMN IF NOT EXISTS "solicitacao_mensagem" TEXT;
ALTER TABLE "medico_documentos" ADD COLUMN IF NOT EXISTS "solicitado_em" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "medico_documentos_status_revisao_idx" ON "medico_documentos"("status_revisao");
