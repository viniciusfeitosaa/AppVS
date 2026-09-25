import env from '../config/env';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';
import { normalizePhoneE164Br } from '../utils/phone-e164.util';
import { safeLogger } from '../utils/safe-logger';

export type EvolutionProvider = 'go' | 'legacy';

export type SendTextResult = {
  ok: boolean;
  provider: EvolutionProvider | 'twilio';
  messageId?: string;
};

export type SendWhatsAppTextOpts = {
  /** Liga delay + typing (default: WHATSAPP_HUMANIZE). */
  humanize?: boolean;
  /** Envia presence "composing" antes do texto (default: WHATSAPP_TYPING). */
  typing?: boolean;
  /** Delay fixo em ms; senão usa jitter MIN–MAX do env. */
  delayMs?: number;
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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw || '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Jitter aleatório entre MIN e MAX (ms) para parecer humano. */
export function humanizeDelayMs(explicit?: number): number {
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit >= 0) {
    return Math.floor(explicit);
  }
  const min = parsePositiveInt(env.WHATSAPP_REPLY_DELAY_MS_MIN, 5000);
  const max = parsePositiveInt(env.WHATSAPP_REPLY_DELAY_MS_MAX, 12000);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function humanizeEnabled(opts?: SendWhatsAppTextOpts): boolean {
  if (typeof opts?.humanize === 'boolean') return opts.humanize;
  return env.WHATSAPP_HUMANIZE !== 'false';
}

function typingEnabled(opts?: SendWhatsAppTextOpts): boolean {
  if (typeof opts?.typing === 'boolean') return opts.typing;
  return env.WHATSAPP_TYPING !== 'false';
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Presence no chat (digitando…). Número sem "+" (Evolution GO / nós RAW).
 * state: composing | paused | available
 */
export async function setChatPresence(
  numberE164: string,
  state: 'composing' | 'paused' | 'available' = 'composing'
): Promise<boolean> {
  if (!hasEvolutionGoConfig()) return false;
  const number = numberE164.replace(/^\+/, '').replace(/\D/g, '');
  if (!number) return false;

  const url = `${baseUrl()}/message/presence`;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: evolutionHeaders(env.EVOLUTION_INSTANCE_ID),
      body: JSON.stringify({ number, state, isAudio: false }),
    });
    if (!res.ok) {
      safeLogger.warn(`[evolution] presence falhou: ${await parseEvolutionError(res)}`);
      return false;
    }
    return true;
  } catch (err) {
    safeLogger.warn('[evolution] presence erro:', err);
    return false;
  }
}

/** Evolution GO — POST /send/text (delay opcional em ms = composing nativo). */
async function sendTextGo(
  numberE164: string,
  text: string,
  delayMs?: number
): Promise<SendTextResult> {
  const url = `${baseUrl()}/send/text`;
  const body: Record<string, unknown> = { number: numberE164, text };
  if (typeof delayMs === 'number' && delayMs > 0) {
    body.delay = delayMs;
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: evolutionHeaders(env.EVOLUTION_INSTANCE_ID),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Evolution GO ${res.status}: ${await parseEvolutionError(res)}`);
  }

  let parsed: { messageId?: string; error?: string; data?: { Info?: { ID?: string } } };
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    parsed = {};
  }
  if (parsed.error) {
    throw new Error(`Evolution GO: ${parsed.error}`);
  }
  const messageId = parsed.messageId || parsed.data?.Info?.ID;

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
 * Com humanize: presence "composing" + delay jitter antes do envio.
 */
export async function sendWhatsAppText(
  toPhone: string,
  text: string,
  opts?: SendWhatsAppTextOpts
): Promise<SendTextResult> {
  const number = normalizePhoneE164Br(toPhone);
  if (!number) {
    throw new Error('Telefone inválido para WhatsApp');
  }

  const provider = getEvolutionProvider();
  const useHumanize = humanizeEnabled(opts);
  const delayMs = useHumanize ? humanizeDelayMs(opts?.delayMs) : opts?.delayMs ?? 0;

  if (provider === 'go') {
    if (!hasEvolutionGoConfig()) {
      throw new Error(
        'Evolution GO não configurado (EVOLUTION_API_URL, EVOLUTION_INSTANCE_ID, EVOLUTION_INSTANCE_TOKEN)'
      );
    }

    if (useHumanize && typingEnabled(opts)) {
      // Sustenta “digitando…”: presence + delay nativo no /send/text.
      await setChatPresence(number, 'composing');
      // Reenvia presence a cada ~4s se o delay for longo (indicador some sozinho).
      const refreshEvery = 4000;
      let elapsed = 0;
      while (elapsed + refreshEvery < delayMs) {
        await sleep(refreshEvery);
        elapsed += refreshEvery;
        await setChatPresence(number, 'composing');
      }
      const remaining = Math.max(0, delayMs - elapsed);
      // O delay restante vai no body do send (API GO aplica composing interno).
      return sendTextGo(number, text, remaining > 0 ? remaining : undefined);
    }

    return sendTextGo(number, text, delayMs > 0 ? delayMs : undefined);
  }

  if (!hasEvolutionLegacyConfig()) {
    throw new Error('Evolution API legada não configurada');
  }
  if (useHumanize && delayMs > 0) {
    await sleep(delayMs);
  }
  return sendTextLegacy(number, text);
}

/** Verifica se instância GO responde (opcional — health operacional). */
export async function getEvolutionGoInstanceStatus(): Promise<{
  connected?: boolean;
  loggedIn?: boolean;
} | null> {
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

/**
 * Apaga mensagem para todos (útil para comandos internos da equipe como pausar/retomar).
 */
export async function deleteWhatsAppMessage(chat: string, messageId: string): Promise<boolean> {
  if (!hasEvolutionGoConfig()) return false;
  const numberOrJid = chat.includes('@') ? chat : normalizePhoneE164Br(chat);
  if (!numberOrJid || !messageId.trim()) return false;

  const url = `${baseUrl()}/message/delete`;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: evolutionHeaders(env.EVOLUTION_INSTANCE_ID),
      body: JSON.stringify({
        chat: numberOrJid,
        messageId: messageId.trim(),
      }),
    });
    if (!res.ok) {
      safeLogger.warn(`[evolution] delete message falhou: ${await parseEvolutionError(res)}`);
      return false;
    }
    return true;
  } catch (err) {
    safeLogger.warn('[evolution] delete message erro:', err);
    return false;
  }
}

type AdvancedSettings = {
  alwaysOnline?: boolean;
  rejectCall?: boolean;
  msgRejectCall?: string;
  readMessages?: boolean;
  ignoreGroups?: boolean;
  ignoreStatus?: boolean;
};

let unreadSettingsEnsured = false;

/**
 * Garante readMessages=false na instância GO para não marcar conversas como lidas
 * ao receber mensagens (ajuda a identificar o que ainda precisa de atenção humana).
 */
export async function ensureEvolutionGoUnreadSettings(): Promise<void> {
  if (unreadSettingsEnsured || !hasEvolutionGoConfig()) return;
  const instanceId = env.EVOLUTION_INSTANCE_ID!;
  const url = `${baseUrl()}/instance/${encodeURIComponent(instanceId)}/advanced-settings`;

  try {
    // advanced-settings autentica com token da instância (não a GLOBAL_API_KEY)
    const headers = evolutionHeaders(instanceId);
    const getRes = await fetchWithTimeout(url, { method: 'GET', headers });
    if (!getRes.ok) {
      safeLogger.warn('[evolution] não foi possível ler advanced-settings');
      return;
    }

    const current = (await getRes.json()) as AdvancedSettings;
    if (current.readMessages === false) {
      unreadSettingsEnsured = true;
      return;
    }

    const body: AdvancedSettings = {
      alwaysOnline: current.alwaysOnline ?? false,
      rejectCall: current.rejectCall ?? false,
      msgRejectCall: current.msgRejectCall ?? '',
      readMessages: false,
      ignoreGroups: current.ignoreGroups ?? false,
      ignoreStatus: current.ignoreStatus ?? false,
    };
    const putRes = await fetchWithTimeout(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!putRes.ok) {
      safeLogger.warn(`[evolution] PUT advanced-settings falhou: ${await parseEvolutionError(putRes)}`);
      return;
    }
    unreadSettingsEnsured = true;
    safeLogger.info('[evolution] readMessages=false aplicado (não marcar como lido ao receber)');
  } catch (err) {
    safeLogger.warn('[evolution] falha ao garantir readMessages=false:', err);
  }
}
