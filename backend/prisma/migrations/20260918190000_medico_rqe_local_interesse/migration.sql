ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "rqe" VARCHAR(60);
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "local_interesse_trabalho" TEXT;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "interesse_trabalho" TEXT;
