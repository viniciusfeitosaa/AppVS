-- CreateEnum
CREATE TYPE "ConteudoParticipantePerfil" AS ENUM ('MEDICO', 'ESTUDANTE');

-- AlterTable
ALTER TABLE "conteudo_participantes" ADD COLUMN "perfil" "ConteudoParticipantePerfil" NOT NULL DEFAULT 'MEDICO';
ALTER TABLE "conteudo_participantes" ADD COLUMN "faculdade" VARCHAR(255);
ALTER TABLE "conteudo_participantes" ADD COLUMN "semestre" VARCHAR(40);
ALTER TABLE "conteudo_participantes" ADD COLUMN "participa_liga" BOOLEAN;
ALTER TABLE "conteudo_participantes" ADD COLUMN "liga_nome" VARCHAR(255);
