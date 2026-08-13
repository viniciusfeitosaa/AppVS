import fs from 'fs';
import admin from 'firebase-admin';
import { prisma } from '../config/database';
import type { PushJobPayload } from '../jobs/push.types';
import { pathForNotificacaoTipo } from '../utils/push-deep-link.util';

let initialized = false;

function tryInitFirebase(): boolean {
  if (initialized) return true;
  try {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
    if (json) {
      const cred = JSON.parse(json) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(cred) });
      initialized = true;
      return true;
    }
    if (path && fs.existsSync(path)) {
      const cred = JSON.parse(fs.readFileSync(path, 'utf8')) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(cred) });
      initialized = true;
      return true;
    }
  } catch (err) {
    console.error('[push-fcm] falha ao inicializar Firebase:', (err as Error)?.message ?? err);
  }
  return false;
}

export function isFirebasePushReady(): boolean {
  return tryInitFirebase();
}

export async function sendPushToMedico(payload: PushJobPayload): Promise<void> {
  if (!tryInitFirebase()) {
    console.warn('[push-fcm] Firebase não configurado; job ignorado');
    return;
  }

  const tokens = await prisma.devicePushToken.findMany({
    where: { tenantId: payload.tenantId, medicoId: payload.medicoId },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return;

  const path = payload.path || pathForNotificacaoTipo(payload.tipo);
  const message: admin.messaging.MulticastMessage = {
    tokens: tokens.map((t) => t.token),
    notification: {
      title: payload.titulo.slice(0, 100),
      body: payload.corpo.slice(0, 240),
    },
    data: {
      tipo: payload.tipo,
      path,
      notificacaoId: payload.notificacaoId || '',
    },
    android: {
      priority: 'high',
      notification: { channelId: 'viva_default', sound: 'default' },
    },
    apns: {
      payload: {
        aps: { sound: 'default', badge: 1 },
      },
    },
  };

  const res = await admin.messaging().sendEachForMulticast(message);
  const toDelete: string[] = [];
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code || '';
    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token') ||
      code.includes('invalid-argument')
    ) {
      toDelete.push(tokens[i].id);
    } else {
      console.error('[push-fcm] erro envio:', code, r.error?.message);
    }
  });
  if (toDelete.length > 0) {
    await prisma.devicePushToken.deleteMany({ where: { id: { in: toDelete } } });
  }
}
