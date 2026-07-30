-- Precadastro de participantes (captura para futuro corpo clínico)
ALTER TABLE "conteudo_participantes" ADD COLUMN "crm" VARCHAR(60);
ALTER TABLE "conteudo_participantes" ADD COLUMN "especialidade" VARCHAR(120);
ALTER TABLE "conteudo_participantes" ADD COLUMN "cidade" VARCHAR(120);
ALTER TABLE "conteudo_participantes" ADD COLUMN "interesse_corpo_clinico" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "conteudo_participantes_tenant_id_origem_created_at_idx"
  ON "conteudo_participantes"("tenant_id", "origem", "created_at");
