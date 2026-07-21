import { Router, Request, Response } from 'express';
import env from '../config/env';
import {
  handleIncomingWhatsAppMessage,
  type EvolutionWebhookPayload,
} from '../services/whatsapp-atendimento.service';
import { safeLogger } from '../utils/safe-logger';

const router = Router();

function isWebhookAuthorized(req: Request, body: EvolutionWebhookPayload): boolean {
  const secret = env.EVOLUTION_WEBHOOK_SECRET?.trim();
  if (secret) {
    const header = (req.headers['x-evolution-secret'] as string | undefined)?.trim();
    if (header !== secret) return false;
  }

  const expectedToken = env.EVOLUTION_INSTANCE_TOKEN?.trim();
  if (expectedToken && body.instanceToken && body.instanceToken !== expectedToken) {
    return false;
  }

  const expectedInstance = env.EVOLUTION_INSTANCE_ID?.trim();
  if (expectedInstance && body.instanceId && body.instanceId !== expectedInstance) {
    return false;
  }

  return true;
}

router.post('/evolution-go', async (req: Request, res: Response) => {
  const body = req.body as EvolutionWebhookPayload;

  if (!isWebhookAuthorized(req, body)) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }

  res.status(200).json({ success: true, received: true });

  if (env.WHATSAPP_ATENDIMENTO_ENABLED === 'false') {
    return undefined;
  }

  setImmediate(() => {
    handleIncomingWhatsAppMessage(body).catch((err) => {
      safeLogger.error('[evolution-webhook] falha ao processar mensagem:', err);
    });
  });

  return undefined;
});

export default router;
