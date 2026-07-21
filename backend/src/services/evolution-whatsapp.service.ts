import env from '../config/env';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';
import { normalizePhoneE164Br } from '../utils/phone-e164.util';

export type EvolutionProvider = 'go' | 'legacy';

export type SendTextResult = {
  ok: boolean;
  provider: EvolutionProvider | 'twilio';
  messageId?: string;
};

function baseUrl(): string {
  return (env.EVOLUTION_API_URL || '').replace(/\/$/, '');
}

export function getEvolutionProvider(): EvolutionProvider {
  const p = (env.EVOLUTION_PROVIDER || 'go').toLowerCase();
  return p === 'legacy' ? 'legacy' : 'go';
}

function evolutionGoApiKey(): string | undefined {
  return env.EVOLUTION_INSTANCE_TOKEN || env.EVOLUTION_API_KEY;
}

export function hasEvolutionGoConfig(): boolean {
  return !!(env.EVOLUTION_API_URL && evolutionGoApiKey() && env.EVOLUTION_INSTANCE_ID);
}

export function hasEvolutionLegacyConfig(): boolean {
  return !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
}

export function hasEvolutionConfig(): boolean {
  const provider = getEvolutionProvider();
  return provider === 'go' ? hasEvolutionGoConfig() : hasEvolutionLegacyConfig();
}

function evolutionHeaders(instanceId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: evolutionGoApiKey()!,
  };
  if (instanceId) {
    headers.instanceId = instanceId;
  }
  return headers;
}

async function parseEvolutionError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof json.error === 'string') return json.error;
    return json.error?.message || json.message || text || `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

/** Evolution GO — POST /send/text */
async function sendTextGo(numberE164: string, text: string): Promise<SendTextResult> {
  const url = `${baseUrl()}/send/text`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: evolutionHeaders(env.EVOLUTION_INSTANCE_ID),
    body: JSON.stringify({ number: numberE164, text }),
  });

  if (!res.ok) {
    throw new Error(`Evolution GO ${res.status}: ${await parseEvolutionError(res)}`);
  }

  let messageId: string | undefined;
  let body: { messageId?: string; error?: string; data?: { Info?: { ID?: string } } };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    body = {};
  }
  if (body.error) {
    throw new Error(`Evolution GO: ${body.error}`);
  }
  messageId = body.messageId || body.data?.Info?.ID;

  return { ok: true, provider: 'go', messageId };
}

/** Evolution API legada (Node) — POST /message/sendText/{instance} */
async function sendTextLegacy(numberE164: string, text: string): Promise<SendTextResult> {
  const instance = env.EVOLUTION_INSTANCE!;
  const url = `${baseUrl()}/message/sendText/${encodeURIComponent(instance)}`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.EVOLUTION_API_KEY}`,
    },
    body: JSON.stringify({ number: numberE164, text }),
  });

  if (!res.ok) {
    throw new Error(`Evolution API ${res.status}: ${await parseEvolutionError(res)}`);
  }

  return { ok: true, provider: 'legacy' };
}

/**
 * Envia texto WhatsApp via Evolution (GO ou legada).
 * @param toPhone telefone com ou sem máscara (BR)
 */
export async function sendWhatsAppText(toPhone: string, text: string): Promise<SendTextResult> {
  const number = normalizePhoneE164Br(toPhone);
  if (!number) {
    throw new Error('Telefone inválido para WhatsApp');
  }

  const provider = getEvolutionProvider();
  if (provider === 'go') {
    if (!hasEvolutionGoConfig()) {
      throw new Error('Evolution GO não configurado (EVOLUTION_API_URL, EVOLUTION_INSTANCE_ID, EVOLUTION_INSTANCE_TOKEN)');
    }
    return sendTextGo(number, text);
  }

  if (!hasEvolutionLegacyConfig()) {
    throw new Error('Evolution API legada não configurada');
  }
  return sendTextLegacy(number, text);
}

/** Verifica se instância GO responde (opcional — health operacional). */
export async function getEvolutionGoInstanceStatus(): Promise<{ connected?: boolean; loggedIn?: boolean } | null> {
  if (!hasEvolutionGoConfig()) return null;
  const url = `${baseUrl()}/instance/status`;
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: evolutionHeaders(env.EVOLUTION_INSTANCE_ID),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { Connected?: boolean; LoggedIn?: boolean } };
  return {
    connected: body.data?.Connected,
    loggedIn: body.data?.LoggedIn,
  };
}
