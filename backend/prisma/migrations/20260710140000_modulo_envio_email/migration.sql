-- Módulo Envio de E-mail (painel de comunicação)
ALTER TYPE "ModuloSistema" ADD VALUE 'ENVIO_EMAIL';

CREATE TYPE "EmailMensagemStatus" AS ENUM ('RASCUNHO', 'ENVIADO', 'FALHA');

CREATE TABLE "email_mensagens" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "assunto" VARCHAR(500) NOT NULL,
    "corpo_html" TEXT,
    "corpo_texto" TEXT,
    "destinatarios" JSONB NOT NULL,
    "status" "EmailMensagemStatus" NOT NULL DEFAULT 'RASCUNHO',
    "criado_por_master_id" TEXT,
    "erro_envio" TEXT,
    "enviado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_mensagens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_mensagens_tenant_id_created_at_idx" ON "email_mensagens"("tenant_id", "created_at" DESC);
CREATE INDEX "email_mensagens_tenant_id_status_idx" ON "email_mensagens"("tenant_id", "status");

ALTER TABLE "email_mensagens" ADD CONSTRAINT "email_mensagens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_mensagens" ADD CONSTRAINT "email_mensagens_criado_por_master_id_fkey" FOREIGN KEY ("criado_por_master_id") REFERENCES "usuarios_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
