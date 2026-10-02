-- CreateEnum
CREATE TYPE "StatusBiometriaFacial" AS ENUM ('PENDENTE_APROVACAO', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "FaceStatusPonto" AS ENUM ('PENDENTE', 'CONFERE', 'INCERTO', 'DIVERGENTE', 'SPOOF_SUSPEITO', 'SEM_ROSTO', 'SEM_BIOMETRIA', 'SEM_FOTO', 'ERRO');

-- CreateEnum
CREATE TYPE "RevisaoFacePonto" AS ENUM ('CONFIRMADO_MEDICO', 'FRAUDE_SUSPEITA');

-- AlterTable
ALTER TABLE "registros_ponto" ADD COLUMN     "face_biometria_id" TEXT,
ADD COLUMN     "face_checkout_liveness" DECIMAL(5,4),
ADD COLUMN     "face_checkout_similaridade" DECIMAL(5,4),
ADD COLUMN     "face_checkout_status" "FaceStatusPonto",
ADD COLUMN     "face_checkout_verificado_em" TIMESTAMP(3),
ADD COLUMN     "face_liveness" DECIMAL(5,4),
ADD COLUMN     "face_revisao" "RevisaoFacePonto",
ADD COLUMN     "face_revisao_em" TIMESTAMP(3),
ADD COLUMN     "face_revisao_obs" VARCHAR(500),
ADD COLUMN     "face_revisao_por_id" TEXT,
ADD COLUMN     "face_similaridade" DECIMAL(5,4),
ADD COLUMN     "face_status" "FaceStatusPonto",
ADD COLUMN     "face_verificado_em" TIMESTAMP(3),
ADD COLUMN     "foto_checkout_caminho" VARCHAR(512),
ADD COLUMN     "motivo_checkout_sem_foto" VARCHAR(500);

-- CreateTable
CREATE TABLE "medico_biometrias_faciais" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "status" "StatusBiometriaFacial" NOT NULL DEFAULT 'PENDENTE_APROVACAO',
    "foto_caminho" VARCHAR(512) NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "modelo" VARCHAR(60) NOT NULL,
    "liveness_score" DECIMAL(5,4),
    "qualidade" JSONB,
    "origem" VARCHAR(30) NOT NULL,
    "consentimento_em" TIMESTAMP(3) NOT NULL,
    "consentimento_versao" VARCHAR(20) NOT NULL,
    "revisado_por_id" TEXT,
    "revisado_em" TIMESTAMP(3),
    "motivo_rejeicao" VARCHAR(500),
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medico_biometrias_faciais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medico_biometrias_faciais_tenant_id_medico_id_ativa_idx" ON "medico_biometrias_faciais"("tenant_id", "medico_id", "ativa");

-- CreateIndex
CREATE INDEX "medico_biometrias_faciais_tenant_id_status_idx" ON "medico_biometrias_faciais"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "registros_ponto_tenant_id_face_status_idx" ON "registros_ponto"("tenant_id", "face_status");

-- CreateIndex
CREATE INDEX "registros_ponto_tenant_id_face_checkout_status_idx" ON "registros_ponto"("tenant_id", "face_checkout_status");

-- AddForeignKey
ALTER TABLE "medico_biometrias_faciais" ADD CONSTRAINT "medico_biometrias_faciais_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medico_biometrias_faciais" ADD CONSTRAINT "medico_biometrias_faciais_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
