import { Queue, Worker, type Job } from 'bullmq';
import type { PushJobPayload } from './push.types';
import { sendPushToMedico } from '../services/push-fcm.service';

let queue: Queue<PushJobPayload> | null = null;
let worker: Worker<PushJobPayload> | null = null;

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

async function processPushJob(job: Job<PushJobPayload>): Promise<void> {
  await sendPushToMedico(job.data);
}

export function startPushQueue(): boolean {
  const connection = bullConnection();
  if (!connection) return false;

  queue = new Queue<PushJobPayload>('viva-push', { connection });
  worker = new Worker<PushJobPayload>('viva-push', processPushJob, {
    connection,
    concurrency: Math.max(1, parseInt(process.env.PUSH_QUEUE_CONCURRENCY || '4', 10)),
  });

  worker.on('failed', (job, err) => {
    console.error('[push-queue] falha:', job?.id, job?.data?.tipo, err.message);
  });

  console.log('[push-queue] worker ativo');
  return true;
}

export async function enqueuePushJob(payload: PushJobPayload): Promise<boolean> {
  if (!queue) {
    // Fallback: envia síncrono se Redis/fila não estiver disponível
    try {
      await sendPushToMedico(payload);
      return true;
    } catch (err) {
      console.error('[push-queue] fallback sync falhou:', (err as Error)?.message ?? err);
      return false;
    }
  }
  await queue.add(payload.tipo, payload, {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  });
  return true;
}

export async function stopPushQueue(): Promise<void> {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}
