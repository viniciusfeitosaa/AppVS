/**
 * Restaura meses do relatório de procedimentos a partir de um JSON exportado
 * (ex.: localStorage relatorioProcedimentosCalc_v1).
 *
 * Uso:
 *   node scripts/restore-relatorio-procedimentos.mjs /caminho/backup.json
 *   node scripts/restore-relatorio-procedimentos.mjs /caminho/backup.json --only=2026-02,2026-03
 */
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const TENANT_ID = 'b7c43aba-fb5f-4b85-9ded-ba72ba96ec2b';
const prisma = new PrismaClient();

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg
  ? new Set(
      onlyArg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  : null;

const file = process.argv[2];
if (!file) {
  console.error('Informe o caminho do JSON: node scripts/restore-relatorio-procedimentos.mjs backup.json');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!raw || typeof raw !== 'object') {
  console.error('JSON inválido.');
  process.exit(1);
}

const meses = Object.keys(raw).filter((k) => /^\d{4}-(0[1-9]|1[0-2])$/.test(k));
const alvo = only ? meses.filter((m) => only.has(m)) : meses;

if (alvo.length === 0) {
  console.error('Nenhum mês válido encontrado no JSON.');
  process.exit(1);
}

await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS relatorio_procedimentos_mes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    mes_ref VARCHAR(7) NOT NULL,
    dados JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, mes_ref)
  );
`);

const resultados = [];
for (const mesRef of alvo.sort()) {
  const dados = raw[mesRef];
  if (!dados || typeof dados !== 'object') {
    resultados.push({ mesRef, ok: false, motivo: 'dados ausentes' });
    continue;
  }
  const linhas = Array.isArray(dados.procedimentos) ? dados.procedimentos.length : 0;
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO relatorio_procedimentos_mes (tenant_id, mes_ref, dados, created_at, updated_at)
      VALUES ($1::uuid, $2, $3::jsonb, NOW(), NOW())
      ON CONFLICT (tenant_id, mes_ref)
      DO UPDATE SET
        dados = EXCLUDED.dados,
        updated_at = NOW()
    `,
    TENANT_ID,
    mesRef,
    JSON.stringify(dados)
  );
  resultados.push({ mesRef, ok: true, linhas, concluido: !!dados.concluido });
}

console.log(JSON.stringify(resultados, null, 2));
await prisma.$disconnect();
