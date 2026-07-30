-- Módulo Conteúdos / Eventos
ALTER TYPE "ModuloSistema" ADD VALUE IF NOT EXISTS 'CONTEUDOS';

CREATE TYPE "ConteudoEventoStatus" AS ENUM ('RASCUNHO', 'PUBLICADO', 'ENCERRADO');
CREATE TYPE "ConteudoPalestranteStatus" AS ENUM ('PENDENTE_FORM', 'COMPLETO');
CREATE TYPE "ConteudoParticipanteOrigem" AS ENUM ('MEDICO', 'EXTERNO');

CREATE TABLE "conteudo_palestrantes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(30),
    "bio" TEXT,
    "foto_url" VARCHAR(500),
    "crm" VARCHAR(60),
    "especialidade" VARCHAR(120),
    "medico_id" TEXT,
    "status" "ConteudoPalestranteStatus" NOT NULL DEFAULT 'PENDENTE_FORM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conteudo_palestrantes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conteudo_eventos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "capa_url" VARCHAR(500),
    "youtube_url" VARCHAR(500) NOT NULL,
    "youtube_video_id" VARCHAR(32) NOT NULL,
    "descricao" TEXT,
    "inicia_em" TIMESTAMP(3) NOT NULL,
    "status" "ConteudoEventoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "palestrante_id" TEXT,
    "token_palestrante" VARCHAR(64) NOT NULL,
    "token_inscricao" VARCHAR(64) NOT NULL,
    "criado_por_master_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conteudo_eventos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conteudo_participantes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "evento_id" TEXT NOT NULL,
    "origem" "ConteudoParticipanteOrigem" NOT NULL,
    "medico_id" TEXT,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(30),
    "consentimento_lgpd" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conteudo_participantes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conteudo_eventos_token_palestrante_key" ON "conteudo_eventos"("token_palestrante");
CREATE UNIQUE INDEX "conteudo_eventos_token_inscricao_key" ON "conteudo_eventos"("token_inscricao");
CREATE INDEX "conteudo_eventos_tenant_id_status_inicia_em_idx" ON "conteudo_eventos"("tenant_id", "status", "inicia_em");
CREATE INDEX "conteudo_eventos_palestrante_id_idx" ON "conteudo_eventos"("palestrante_id");

CREATE INDEX "conteudo_palestrantes_tenant_id_nome_idx" ON "conteudo_palestrantes"("tenant_id", "nome");
CREATE INDEX "conteudo_palestrantes_tenant_id_email_idx" ON "conteudo_palestrantes"("tenant_id", "email");
CREATE INDEX "conteudo_palestrantes_medico_id_idx" ON "conteudo_palestrantes"("medico_id");

CREATE UNIQUE INDEX "conteudo_participantes_evento_id_email_key" ON "conteudo_participantes"("evento_id", "email");
CREATE UNIQUE INDEX "conteudo_participantes_evento_id_medico_id_key" ON "conteudo_participantes"("evento_id", "medico_id");
CREATE INDEX "conteudo_participantes_tenant_id_evento_id_idx" ON "conteudo_participantes"("tenant_id", "evento_id");
CREATE INDEX "conteudo_participantes_medico_id_idx" ON "conteudo_participantes"("medico_id");

ALTER TABLE "conteudo_palestrantes" ADD CONSTRAINT "conteudo_palestrantes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conteudo_palestrantes" ADD CONSTRAINT "conteudo_palestrantes_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "conteudo_eventos" ADD CONSTRAINT "conteudo_eventos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conteudo_eventos" ADD CONSTRAINT "conteudo_eventos_palestrante_id_fkey" FOREIGN KEY ("palestrante_id") REFERENCES "conteudo_palestrantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conteudo_eventos" ADD CONSTRAINT "conteudo_eventos_criado_por_master_id_fkey" FOREIGN KEY ("criado_por_master_id") REFERENCES "usuarios_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "conteudo_participantes" ADD CONSTRAINT "conteudo_participantes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conteudo_participantes" ADD CONSTRAINT "conteudo_participantes_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "conteudo_eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conteudo_participantes" ADD CONSTRAINT "conteudo_participantes_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
