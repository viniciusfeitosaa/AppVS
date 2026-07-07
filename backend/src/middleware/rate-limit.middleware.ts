import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';
import { resolveClientIp } from '../utils/client-ip';

function buildStore(prefix: string) {
  const redis = getRedisClient();
  if (!redis) return undefined;
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args: string[]) =>
      redis.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
  });
}

function createLimiter(prefix: string, overrides: Partial<Options>): RateLimitRequestHandler {
  const windowMs = overrides.windowMs ?? 60_000;
  const max = overrides.max ?? 100;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveClientIp(req),
    message: {
      success: false,
      error: 'Muitas requisições. Aguarde um momento e tente novamente.',
    },
    store: buildStore(prefix),
    ...overrides,
  });
}

function isAuthApiPath(req: { originalUrl?: string; url?: string }): boolean {
  const path = req.originalUrl || req.url || '';
  return path.startsWith('/api/auth');
}

/** Limite global /api — janela longa, teto alto (dashboard paralelo). */
export function globalApiLimiter(windowMs: number, max: number): RateLimitRequestHandler {
  return createLimiter('global', {
    windowMs,
    max,
    skip: (req) => isAuthApiPath(req),
    message: {
      success: false,
      error: 'Muitas requisições deste IP, tente novamente mais tarde.',
    },
  });
}

/**
 * Login: só conta tentativas falhas (401/403), por IP real.
 * Protege contra brute force sem bloquear o primeiro acesso legítimo.
 */
export const loginLimiter = createLimiter('login', {
  windowMs: 15 * 60_000,
  max: Math.max(10, parseInt(process.env.RATE_LIMIT_LOGIN_MAX_FAILURES || '20', 10)),
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Muitas tentativas de login falhas. Aguarde alguns minutos e tente novamente.',
  },
});

/** Rotas sensíveis (cadastro, reset): limite por minuto. */
export const authStrictLimiter = createLimiter('auth', {
  windowMs: 60_000,
  max: Math.max(20, parseInt(process.env.RATE_LIMIT_AUTH_MAX_PER_MIN || '100', 10)),
});

/** Leads / formulários públicos. */
export const publicFormLimiter = createLimiter('public-form', {
  windowMs: 60_000,
  max: Math.max(5, parseInt(process.env.RATE_LIMIT_PUBLIC_FORM_MAX_PER_MIN || '30', 10)),
});
