-- Contador atômico DocuSeal (termo de transferência etc.)
CREATE TABLE IF NOT EXISTS "docuseal_documento_contadores" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "chave" VARCHAR(80) NOT NULL,
  "ano" INTEGER NOT NULL,
  "ultimo_numero" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "docuseal_documento_contadores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "docuseal_documento_contadores_tenant_id_chave_ano_key"
  ON "docuseal_documento_contadores"("tenant_id", "chave", "ano");

CREATE INDEX IF NOT EXISTS "docuseal_documento_contadores_tenant_id_idx"
  ON "docuseal_documento_contadores"("tenant_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'docuseal_documento_contadores_tenant_id_fkey'
  ) THEN
    ALTER TABLE "docuseal_documento_contadores"
      ADD CONSTRAINT "docuseal_documento_contadores_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
