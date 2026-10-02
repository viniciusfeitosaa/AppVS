import { Queue, Worker, type Job } from 'bullmq';
import fs from 'fs';
import { prisma } from '../config/database';
import env from '../config/env';
import { faceServiceConfigurado, faceVerify, FaceServiceUnavailableError } from '../services/face-client.service';
import { getBiometriaAtivaParaComparacao } from '../services/biometria-facial.service';
import { decidirFaceStatus } from '../utils/face-decisao.util';
import { resolveStoredFileToAbsolute } from '../utils/upload-path.util';

export type FaceEtapa = 'checkin' | 'checkout';
type FaceVerifyJob = { registroId: string; etapa: FaceEtapa };

const QUEUE_NAME = 'coopvitta-face-verify';
const ATTEMPTS = 3;

let queue: Queue<FaceVerifyJob> | null = null;
let worker: Worker<FaceVerifyJob> | null = null;

function bullConnection() {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.replace(/^redis:\/\//, 'http://'));
    return {
      host: u.hostname,
      port: parseInt(u.port || '6379', 10),
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  } catch {
    return null;
  }
}

function camposEtapa(etapa: FaceEtapa) {
  return etapa === 'checkin'
    ? { status: 'faceStatus', sim: 'faceSimilaridade', live: 'faceLiveness', em: 'faceVerificadoEm', foto: 'fotoCheckinCaminho' }
    : {
        status: 'faceCheckoutStatus',
        sim: 'faceCheckoutSimilaridade',
        live: 'faceCheckoutLiveness',
        em: 'faceCheckoutVerificadoEm',
        foto: 'fotoCheckoutCaminho',
      };
}

async function gravar(registroId: string, etapa: FaceEtapa, data: Record<string, unknown>) {
  const c = camposEtapa(etapa);
  const mapped: Record<string, unknown> = { [c.em]: new Date() };
  if ('status' in data) mapped[c.status] = data.status;
  if ('similaridade' in data) mapped[c.sim] = data.similaridade;
  if ('liveness' in data) mapped[c.live] = data.liveness;
  if ('biometriaId' in data) mapped.faceBiometriaId = data.biometriaId;
  await prisma.registroPonto.update({ where: { id: registroId }, data: mapped });
}

async function processar({ registroId, etapa }: FaceVerifyJob): Promise<void> {
  const c = camposEtapa(etapa);
  const registro = (await prisma.registroPonto.findUnique({
    where: { id: registroId },
    select: { id: true, tenantId: true, medicoId: true, [c.foto]: true },
  })) as Record<string, string | null> | null;
  if (!registro) return;

  const foto = registro[c.foto];
  if (!foto) {
    await gravar(registroId, etapa, { status: 'SEM_FOTO' });
    return;
  }
  const biometria = await getBiometriaAtivaParaComparacao(registro.tenantId!, registro.medicoId!);
  if (!biometria || !biometria.embedding?.length) {
    await gravar(registroId, etapa, { status: 'SEM_BIOMETRIA' });
    return;
  }
  const abs = resolveStoredFileToAbsolute(foto);
  if (!fs.existsSync(abs)) {
    await gravar(registroId, etapa, { status: 'SEM_FOTO' });
    return;
  }

  const r = await faceVerify(abs, biometria.embedding, biometria.modelo);
  const status = decidirFaceStatus(r, {
    match: Number(env.FACE_MATCH_THRESHOLD),
    review: Number(env.FACE_REVIEW_THRESHOLD),
    liveness: Number(env.FACE_LIVENESS_THRESHOLD),
  });
  await gravar(registroId, etapa, {
    status,
    similaridade: r.similarity,
    liveness: r.liveness?.score ?? null,
    biometriaId: biometria.id,
  });
}

async function processarJob(job: Job<FaceVerifyJob>): Promise<void> {
  await processar(job.data);
}

async function marcarErro(data: FaceVerifyJob, err: unknown) {
  console.error('[face-verify] falha definitiva:', data.registroId, data.etapa, (err as Error)?.message ?? err);
  await gravar(data.registroId, data.etapa, { status: 'ERRO' }).catch(() => {});
}

export function startFaceVerifyQueue(): boolean {
  const connection = bullConnection();
  if (!connection) return false;
  queue = new Queue<FaceVerifyJob>(QUEUE_NAME, { connection });
  // concorrência 1: o face-service processa uma foto por vez (1 vCPU)
  worker = new Worker<FaceVerifyJob>(QUEUE_NAME, processarJob, { connection, concurrency: 1 });
  worker.on('failed', (job, err) => {
    if (job && job.attemptsMade >= ATTEMPTS) void marcarErro(job.data, err);
  });
  console.log('[face-verify] worker ativo');
  return true;
}

/** Status inicial gravado junto do registro; a fila completa depois. */
export function statusFaceInicial(temFoto: boolean): 'PENDENTE' | 'SEM_FOTO' {
  return temFoto ? 'PENDENTE' : 'SEM_FOTO';
}

export async function enqueueFaceVerify(registroId: string, etapa: FaceEtapa): Promise<void> {
  if (!faceServiceConfigurado()) return;
  const payload = { registroId, etapa };
  if (queue) {
    await queue.add(etapa, payload, {
      jobId: `${registroId}-${etapa}`,
      attempts: ATTEMPTS,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 200,
    });
    return;
  }
  setImmediate(() => {
    processar(payload).catch((e) => {
      if (e instanceof FaceServiceUnavailableError) void marcarErro(payload, e);
      else console.error('[face-verify] fallback sync falhou:', (e as Error)?.message ?? e);
    });
  });
}

export async function stopFaceVerifyQueue(): Promise<void> {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}
