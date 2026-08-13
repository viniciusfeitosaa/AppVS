-- AlterEnum
ALTER TYPE "OrigemRegistroPonto" ADD VALUE 'JUSTIFICADO_SEM_PONTO';

-- CreateEnum
CREATE TYPE "StatusJustificativaAusenciaPonto" AS ENUM ('PENDENTE', 'ACEITA', 'RECUSADA');

-- CreateTable
CREATE TABLE "justificativas_ausencia_ponto" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "escala_id" TEXT NOT NULL,
    "escala_plantao_id" TEXT NOT NULL,
    "horario_oficial_inicio" TIMESTAMP(3) NOT NULL,
    "horario_oficial_fim" TIMESTAMP(3) NOT NULL,
    "horario_alegado_entrada" TIMESTAMP(3) NOT NULL,
    "horario_alegado_saida" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "StatusJustificativaAusenciaPonto" NOT NULL DEFAULT 'PENDENTE',
    "comentario_master" TEXT,
    "decidido_por_master_id" TEXT,
    "decidido_em" TIMESTAMP(3),
    "registro_ponto_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "justificativas_ausencia_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "justificativas_ausencia_ponto_tenant_id_status_idx" ON "justificativas_ausencia_ponto"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "justificativas_ausencia_ponto_tenant_id_medico_id_idx" ON "justificativas_ausencia_ponto"("tenant_id", "medico_id");

-- CreateIndex
CREATE INDEX "justificativas_ausencia_ponto_escala_plantao_id_idx" ON "justificativas_ausencia_ponto"("escala_plantao_id");

-- CreateIndex
CREATE UNIQUE INDEX "justificativas_ausencia_ponto_registro_ponto_id_key" ON "justificativas_ausencia_ponto"("registro_ponto_id");

-- CreateIndex
CREATE UNIQUE INDEX justificativas_ausencia_ponto_plantao_pendente_uidx
  ON justificativas_ausencia_ponto (escala_plantao_id)
  WHERE status = 'PENDENTE';

-- AddForeignKey
ALTER TABLE "justificativas_ausencia_ponto" ADD CONSTRAINT "justificativas_ausencia_ponto_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_ausencia_ponto" ADD CONSTRAINT "justificativas_ausencia_ponto_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_ausencia_ponto" ADD CONSTRAINT "justificativas_ausencia_ponto_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "escalas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_ausencia_ponto" ADD CONSTRAINT "justificativas_ausencia_ponto_escala_plantao_id_fkey" FOREIGN KEY ("escala_plantao_id") REFERENCES "escala_plantoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_ausencia_ponto" ADD CONSTRAINT "justificativas_ausencia_ponto_decidido_por_master_id_fkey" FOREIGN KEY ("decidido_por_master_id") REFERENCES "usuarios_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_ausencia_ponto" ADD CONSTRAINT "justificativas_ausencia_ponto_registro_ponto_id_fkey" FOREIGN KEY ("registro_ponto_id") REFERENCES "registros_ponto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
