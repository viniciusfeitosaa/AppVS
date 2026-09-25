ALTER TABLE "medico_documentos" ADD COLUMN IF NOT EXISTS "validade_em" DATE;
CREATE INDEX IF NOT EXISTS "medico_documentos_tenant_id_validade_em_idx" ON "medico_documentos"("tenant_id", "validade_em");
