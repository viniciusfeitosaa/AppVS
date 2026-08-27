import { prisma } from '../config/database';

let tableEnsured = false;

const ensureTable = async () => {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS procedimentos_base_tenant (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL UNIQUE,
      procedimentos JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  tableEnsured = true;
};

export type ProcedimentoBaseItem = {
  id: string;
  instrumento: string;
  codigo1: string;
  nome1: string;
  valor1: number;
  codigo2: string;
  nome2: string;
  valor2: number;
};

const isProcedimentoBaseItem = (v: unknown): v is ProcedimentoBaseItem => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.instrumento === 'string' &&
    typeof o.codigo1 === 'string' &&
    typeof o.nome1 === 'string' &&
    typeof o.codigo2 === 'string' &&
    typeof o.nome2 === 'string' &&
    (typeof o.valor1 === 'number' || typeof o.valor1 === 'string') &&
    (typeof o.valor2 === 'number' || typeof o.valor2 === 'string')
  );
};

const normalizarLista = (raw: unknown): ProcedimentoBaseItem[] => {
  if (!Array.isArray(raw)) return [];
  const out: ProcedimentoBaseItem[] = [];
  for (const item of raw) {
    if (!isProcedimentoBaseItem(item)) continue;
    out.push({
      id: String(item.id).trim(),
      instrumento: String(item.instrumento).trim(),
      codigo1: String(item.codigo1).trim(),
      nome1: String(item.nome1).trim(),
      valor1: Number(item.valor1) || 0,
      codigo2: String(item.codigo2).trim(),
      nome2: String(item.nome2).trim(),
      valor2: Number(item.valor2) || 0,
    });
  }
  return out;
};

export async function getProcedimentosBaseService(tenantId: string): Promise<ProcedimentoBaseItem[] | null> {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<{ procedimentos: unknown }[]>(
    `
      SELECT procedimentos
      FROM procedimentos_base_tenant
      WHERE tenant_id = $1::uuid
      LIMIT 1
    `,
    tenantId
  );
  if (!rows[0]) return null;
  return normalizarLista(rows[0].procedimentos);
}

export async function upsertProcedimentosBaseService(
  tenantId: string,
  procedimentos: unknown
): Promise<ProcedimentoBaseItem[]> {
  if (!Array.isArray(procedimentos)) {
    throw { statusCode: 400, message: 'Payload inválido: envie um array em "procedimentos".' };
  }
  const lista = normalizarLista(procedimentos);
  if (lista.length === 0) {
    throw { statusCode: 400, message: 'A base deve conter ao menos um procedimento.' };
  }
  const ids = new Set<string>();
  for (const p of lista) {
    if (!p.id) {
      throw { statusCode: 400, message: 'Cada procedimento precisa de um id.' };
    }
    if (ids.has(p.id)) {
      throw { statusCode: 400, message: `Id duplicado na base: ${p.id}` };
    }
    ids.add(p.id);
    if (!p.nome1.trim()) {
      throw { statusCode: 400, message: 'Cada procedimento precisa do nome do 1.º procedimento.' };
    }
  }
  await ensureTable();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO procedimentos_base_tenant (tenant_id, procedimentos, created_at, updated_at)
      VALUES ($1::uuid, $2::jsonb, NOW(), NOW())
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        procedimentos = EXCLUDED.procedimentos,
        updated_at = NOW()
    `,
    tenantId,
    JSON.stringify(lista)
  );
  return lista;
}
