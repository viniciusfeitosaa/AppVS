import fs from 'fs/promises';
import path from 'path';
import env from '../config/env';

export type FaceLiveness = { real: boolean | null; score: number | null };

export type FaceQuality = { blur: number; brightness: number; faceRatio: number };

export interface FaceEnrollResult {
  ok: boolean;
  motivo: string | null;
  modelo: string;
  faces: number;
  embedding: number[] | null;
  liveness: FaceLiveness;
  quality: FaceQuality | null;
}

export interface FaceVerifyResult {
  ok: boolean;
  motivo: string | null;
  modelo: string;
  faces: number;
  similarity: number | null;
  liveness: FaceLiveness;
  quality: FaceQuality | null;
}

export class FaceServiceUnavailableError extends Error {}

export function faceServiceConfigurado(): boolean {
  return !!(env.FACE_SERVICE_URL && env.FACE_SERVICE_TOKEN);
}

function mimeFromPath(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function postImagem<T>(rota: string, filePath: string, extra: Record<string, string> = {}): Promise<T> {
  if (!faceServiceConfigurado()) {
    throw new FaceServiceUnavailableError('face-service não configurado');
  }
  const buf = await fs.readFile(filePath);
  const form = new FormData();
  form.append('image', new Blob([buf], { type: mimeFromPath(filePath) }), path.basename(filePath));
  for (const [k, v] of Object.entries(extra)) form.append(k, v);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(env.FACE_SERVICE_TIMEOUT_MS) || 10000);
  let res: Response;
  try {
    res = await fetch(`${env.FACE_SERVICE_URL!.replace(/\/$/, '')}${rota}`, {
      method: 'POST',
      headers: { 'X-Face-Token': env.FACE_SERVICE_TOKEN! },
      body: form,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new FaceServiceUnavailableError(`face-service inacessível: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 503 || res.status >= 500) {
    throw new FaceServiceUnavailableError(`face-service respondeu ${res.status}`);
  }
  const body = (await res.json().catch(() => ({}))) as { detail?: string } & T;
  if (!res.ok) {
    throw { statusCode: 400, message: body?.detail || `face-service respondeu ${res.status}` };
  }
  return body;
}

export function faceEnroll(filePath: string): Promise<FaceEnrollResult> {
  return postImagem<FaceEnrollResult>('/v1/enroll', filePath);
}

export function faceVerify(filePath: string, embedding: number[], modelo: string): Promise<FaceVerifyResult> {
  return postImagem<FaceVerifyResult>('/v1/verify', filePath, {
    reference: JSON.stringify(embedding),
    modelo,
  });
}
