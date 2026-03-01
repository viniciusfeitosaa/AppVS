import { PrismaClient } from '@prisma/client';

/** connection_limit por instância: 10 em produção (vários usuários), 3 em dev. Override via DATABASE_POOL_SIZE. */
const CONNECTION_LIMIT = Math.min(
  Math.max(1, parseInt(process.env.DATABASE_POOL_SIZE || '', 10) || (process.env.NODE_ENV === 'production' ? 10 : 3)),
  20
);

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
  return new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

/** Conecta ao banco com retry (útil para Render + Supabase: cold start / rede). */
export async function connectDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.$connect();
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
