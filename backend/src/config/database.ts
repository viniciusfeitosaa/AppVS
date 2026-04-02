import { PrismaClient } from '@prisma/client';

/**
 * connection_limit do Prisma por processo Node.
 * Supabase Session pooler: em dev forçamos no máx. 1 (evita MaxClientsInSessionMode), mesmo se DATABASE_POOL_SIZE estiver alto.
 */
const isSupabasePooler = /pooler\.supabase\.com/i.test(process.env.DATABASE_URL || '');
const explicitPool = parseInt(process.env.DATABASE_POOL_SIZE || '', 10);
let resolvedPool = Number.isFinite(explicitPool) && explicitPool > 0
  ? explicitPool
  : process.env.NODE_ENV === 'production'
    ? 10
    : isSupabasePooler
      ? 1
      : 3;
if (isSupabasePooler && process.env.NODE_ENV !== 'production') {
  resolvedPool = Math.min(resolvedPool, 1);
}
const CONNECTION_LIMIT = Math.min(Math.max(1, resolvedPool), 20);

const SLOW_QUERY_MS = Math.max(1, parseInt(process.env.PRISMA_SLOW_QUERY_MS || '', 10) || 250);

/** Garante connection_limit e pool_timeout na URL (Supabase + Render). Sobrescreve se a URL já tiver. */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || '';
  if (!url) return url;
  let u = url
    .replace(/connection_limit=\d+/g, `connection_limit=${CONNECTION_LIMIT}`)
    .replace(/pool_timeout=\d+/g, 'pool_timeout=30');
  if (!u.includes('connection_limit=')) u += (u.includes('?') ? '&' : '?') + `connection_limit=${CONNECTION_LIMIT}`;
  if (!u.includes('pool_timeout=')) u += (u.includes('?') ? '&' : '?') + 'pool_timeout=30';
  return u;
}

// Singleton do Prisma Client
const prismaClientSingleton = () => {
  const client = new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Logar queries lentas (instrumentação para reduzir “delay” percebido no app).
  if (process.env.PRISMA_LOG_SLOW_QUERIES === '1') {
    client.$use(async (params, next) => {
      const start = Date.now();
      try {
        return await next(params);
      } finally {
        const ms = Date.now() - start;
        if (ms >= SLOW_QUERY_MS) {
          // Não loga args/values (pode conter dados sensíveis). Só modelo/ação/tempo.
          console.warn(`[Prisma] Slow query ${ms}ms`, { model: params.model, action: params.action });
        }
      }
    });
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DB] Prisma connection_limit=${CONNECTION_LIMIT} (Supabase pooler: prefira 1; defina DATABASE_POOL_SIZE se necessário)`);
  }

  return client;
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

/**
 * Após `prisma generate`, o singleton em memória pode ficar desatualizado (delegate ausente).
 * Recria o client se o modelo esperado não existir (evita "Cannot read properties of undefined (reading 'findMany')").
 */
function resolvePrismaClient(): PrismaClient {
  let client = globalThis.prismaGlobal ?? prismaClientSingleton();
  const delegate = (client as unknown as { notificacaoMedico?: { findMany: unknown } }).notificacaoMedico;
  if (typeof delegate?.findMany !== 'function') {
    void client.$disconnect().catch(() => {});
    client = prismaClientSingleton();
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Prisma] Cliente recriado (schema mudou). Reinicie o servidor após `prisma generate` se o aviso persistir.');
    }
  }
  globalThis.prismaGlobal = client;
  return client;
}

export const prisma = resolvePrismaClient();

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

/**
 * Garante colunas usadas por ponto/repasse/relatórios (schema Prisma vs DB legado sem `migrate deploy`).
 * Idempotente (IF NOT EXISTS). Falha silenciosa com log se o usuário do banco não tiver permissão de DDL.
 */
export async function ensureCriticalPontoSchemaPatches(): Promise<void> {
  if (process.env.SKIP_AUTO_SCHEMA_PATCH === '1') return;
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "escala_plantoes" ADD COLUMN IF NOT EXISTS "horas_turno_snapshot" DECIMAL(10,4)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "registros_ponto" ADD COLUMN IF NOT EXISTS "repasse_valor_congelado" DECIMAL(12,2)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "config_ponto_eletronico" ADD COLUMN IF NOT EXISTS "valor_hora_por_dia" JSONB`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "config_ponto_eletronico" ADD COLUMN IF NOT EXISTS "valor_hora_cobranca_por_dia" JSONB`
    );
    if (process.env.NODE_ENV === 'development') {
      console.log('[DB] Colunas críticas ponto/repasse alinhadas ao schema.');
    }
  } catch (e) {
    console.warn(
      '[DB] Patch opcional de colunas (ponto/repasse) não aplicado:',
      (e as Error)?.message ?? e
    );
  }
}

/** Conecta ao banco com retry (útil para Render + Supabase: cold start / rede). */
export async function connectDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.$connect();
      await ensureCriticalPontoSchemaPatches();
      console.log('✅ Conectado ao banco de dados PostgreSQL');
      return;
    } catch (error) {
      console.error(`❌ Tentativa ${attempt}/${MAX_RETRIES} de conexão ao banco:`, (error as Error)?.message ?? error);
      if (attempt === MAX_RETRIES) throw error;
      console.log(`⏳ Nova tentativa em ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

// Função para desconectar do banco
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    console.log('✅ Desconectado do banco de dados');
  } catch (error) {
    console.error('❌ Erro ao desconectar do banco de dados:', error);
  }
}
