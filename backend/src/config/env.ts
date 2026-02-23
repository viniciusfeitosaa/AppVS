import { z } from 'zod';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Schema de validação das variáveis de ambiente
const envSchema = z.object({
  // Servidor
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),

  // Banco de Dados
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Segurança
  BCRYPT_ROUNDS: z.string().default('12'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'), // 15 minutos
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

  // CORS
  FRONTEND_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // Multi-tenant / Master
  TENANT_DEFAULT_SLUG: z.string().default('seja-viva-saude'),
  MASTER_INITIAL_EMAIL: z.string().email().default('contato@sejavivasaude.com.br'),
  MASTER_INITIAL_NAME: z.string().default('Administrador Master'),
  MASTER_INITIAL_PASSWORD: z.string().min(8, 'MASTER_INITIAL_PASSWORD deve ter pelo menos 8 caracteres').optional(),
});

// Validar e exportar variáveis de ambiente
type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Erro na validação das variáveis de ambiente:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export default env;
