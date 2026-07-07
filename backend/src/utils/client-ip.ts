import type { Request } from 'express';

/** IP do cliente real atrás de NPM + nginx (evita bucket único do IP interno Docker). */
export function resolveClientIp(req: Pick<Request, 'ip' | 'headers' | 'socket'>): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}
