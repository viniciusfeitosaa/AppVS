-- Repara drift: migration 20260328120000_modulo_vagas consta em _prisma_migrations
-- mas o valor VAGAS não está presente no enum ModuloSistema (ambiente local/Supabase).
ALTER TYPE "ModuloSistema" ADD VALUE IF NOT EXISTS 'VAGAS';
