-- AlterTable
ALTER TABLE "registros_ponto" ADD COLUMN "offline_checkin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "offline_checkout" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "checkin_client_uuid" VARCHAR(36),
ADD COLUMN "checkout_client_uuid" VARCHAR(36),
ADD COLUMN "checkin_sincronizado_em" TIMESTAMP(3),
ADD COLUMN "checkout_sincronizado_em" TIMESTAMP(3),
ADD COLUMN "offline_desvio_relogio_ms" INTEGER,
ADD COLUMN "offline_revisar" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "registros_ponto_checkin_client_uuid_key" ON "registros_ponto"("checkin_client_uuid");
CREATE UNIQUE INDEX "registros_ponto_checkout_client_uuid_key" ON "registros_ponto"("checkout_client_uuid");
