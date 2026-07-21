import { getRedisClient } from '../config/redis';
import { phoneFromWhatsAppJid, textFromEvolutionMessage, type EvolutionMessageData } from '../utils/whatsapp-jid.util';
import {
  businessHoursText,
  isWithinBusinessHours,
} from '../utils/whatsapp-horario-comercial.util';
import { sendWhatsAppText } from './evolution-whatsapp.service';

export type AtendimentoDepartment = 'administrativo' | 'financeiro' | 'duvidas';

export type AtendimentoContactInfo = {
  nome?: string;
  crm?: string;
  local?: string;
  raw: string;
};

type SessionState = 'menu' | 'collecting_info' | 'queued';

type AtendimentoSession = {
  state: SessionState;
  department?: AtendimentoDepartment;
  contactInfo?: AtendimentoContactInfo;
  updatedAt: string;
};

const SESSION_PREFIX = 'wa:atendimento:';
const SESSION_TTL_SEC = 4 * 60 * 60; // 4h — depois disso, novo contato recebe menu de novo

const DEPARTMENTS: Record<'1' | '2' | '3', { key: AtendimentoDepartment; label: string }> = {
  '1': { key: 'administrativo', label: 'Administrativo' },
  '2': { key: 'financeiro', label: 'Financeiro' },
  '3': { key: 'duvidas', label: 'Dúvidas' },
};

const COMMANDS_HINT = '_Digite *menu* para ver as opções • *sair* para encerrar_';

function welcomeMessage(): string {
  return [
    '*Viva Saúde* — Olá! 👋',
    '',
    businessHoursText(),
    '',
    'Escolha o assunto digitando o número:',
    '',
    '1️⃣ Administrativo',
    '2️⃣ Financeiro',
    '3️⃣ Dúvidas',
    '',
    '_Responda com 1, 2 ou 3._',
    COMMANDS_HINT,
  ].join('\n');
}

function outsideHoursMessage(): string {
  return [
    '*Viva Saúde* — Olá! 👋',
    '',
    'No momento estamos *fora do horário de atendimento*.',
    '',
    businessHoursText(),
    '',
    'Retorne nesses horários ou deixe sua mensagem — responderemos assim que possível.',
    '',
    COMMANDS_HINT,
  ].join('\n');
}

function goodbyeMessage(): string {
  return [
    'Atendimento encerrado. Obrigado por falar com a *Viva Saúde*! 🙂',
    '',
    'Quando precisar, envie uma mensagem ou digite *menu*.',
  ].join('\n');
}

function invalidOptionMessage(): string {
  return [
    'Opção inválida. Por favor, responda apenas com *1*, *2* ou *3*.',
    '',
    COMMANDS_HINT,
  ].join('\n');
}

function askContactInfoMessage(label: string): string {
  return [
    `Você selecionou *${label}*.`,
    '',
    'Para facilitar o atendimento, informe:',
    '• *Nome completo*',
    '• *CRM*',
    '• *Local onde trabalha*',
    '',
    '_Envie tudo em uma única mensagem._',
    COMMANDS_HINT,
  ].join('\n');
}

function invalidContactInfoMessage(): string {
  return [
    'Não consegui identificar seus dados. Por favor, envie em uma mensagem:',
    '• Nome completo',
    '• CRM',
    '• Local onde trabalha',
    '',
    COMMANDS_HINT,
  ].join('\n');
}

function queuedMessage(label: string): string {
  return [
    `Obrigado! Seus dados foram registrados no setor *${label}*.`,
    '',
    'Em breve você será atendido(a) por nossa equipe. Aguarde um instante, por favor. 🙏',
    '',
    COMMANDS_HINT,
  ].join('\n');
}

function alreadyQueuedMessage(label: string): string {
  return [
    `Você já está na fila do setor *${label}*. Nossa equipe responderá em breve.`,
    '',
    COMMANDS_HINT,
  ].join('\n');
}

function normalizeChoice(text: string): '1' | '2' | '3' | null {
  const t = text.trim().toLowerCase();
  if (t === '1' || t.includes('administr')) return '1';
  if (t === '2' || t.includes('financeir')) return '2';
  if (t === '3' || t.includes('duvida') || t.includes('dúvida')) return '3';
  return null;
}

function isMenuCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'menu' || t === 'inicio' || t === 'início' || t === 'voltar';
}

function isExitCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'sair' || t === 'encerrar' || t === 'cancelar' || t === 'tchau';
}

/** Interpreta resposta livre com nome, CRM e local (rótulos ou linhas). */
export function parseContactInfo(text: string): AtendimentoContactInfo {
  const raw = text.trim();
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  let nome: string | undefined;
  let crm: string | undefined;
  let local: string | undefined;

  for (const line of lines) {
    const match = line.match(/^(nome|crm|local)\s*[:=\-]\s*(.+)$/i);
    if (!match) continue;
    const value = match[2].trim();
    const key = match[1].toLowerCase();
    if (key === 'nome') nome = value;
    else if (key === 'crm') crm = value;
    else if (key === 'local') local = value;
  }

  if (!nome && !crm && !local && lines.length >= 3) {
    [nome, crm, local] = lines;
  } else if (!nome && !crm && lines.length === 2) {
    [nome, crm] = lines;
  }

  return { nome, crm, local, raw };
}

function isValidContactInfo(text: string): boolean {
  const parsed = parseContactInfo(text);
  if (parsed.raw.length < 12) return false;
  const parts = [parsed.nome, parsed.crm, parsed.local].filter(Boolean);
  if (parts.length >= 2) return true;
  return parsed.raw.split(/\s+/).length >= 4;
}

async function startDepartmentFlow(
  phone: string,
  dept: (typeof DEPARTMENTS)['1' | '2' | '3'],
  pushName?: string
): Promise<void> {
  await sendWhatsAppText(phone, askContactInfoMessage(dept.label));
  await saveSession(phone, {
    state: 'collecting_info',
    department: dept.key,
    updatedAt: new Date().toISOString(),
  });
  console.log(
    `[whatsapp-atendimento] ${phone}${pushName ? ` (${pushName})` : ''} → coletando dados (${dept.key})`
  );
}

function logQueuedContact(
  phone: string,
  department: AtendimentoDepartment,
  info: AtendimentoContactInfo,
  pushName?: string
): void {
  console.log(
    `[whatsapp-atendimento] ${phone}${pushName ? ` (${pushName})` : ''} → fila ${department} | ` +
      `nome=${info.nome ?? '-'} | crm=${info.crm ?? '-'} | local=${info.local ?? '-'} | raw=${JSON.stringify(info.raw)}`
  );
}

async function getSession(phone: string): Promise<AtendimentoSession | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  const raw = await redis.get(`${SESSION_PREFIX}${phone}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AtendimentoSession;
  } catch {
    return null;
  }
}

async function saveSession(phone: string, session: AtendimentoSession): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.set(`${SESSION_PREFIX}${phone}`, JSON.stringify(session), 'EX', SESSION_TTL_SEC);
}

async function clearSession(phone: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.del(`${SESSION_PREFIX}${phone}`);
}

function departmentLabel(key?: AtendimentoDepartment): string {
  if (key === 'financeiro') return 'Financeiro';
  if (key === 'duvidas') return 'Dúvidas';
  return 'Administrativo';
}

async function sendMenuOrClosed(phone: string, pushName?: string): Promise<void> {
  const open = isWithinBusinessHours();
  await sendWhatsAppText(phone, open ? welcomeMessage() : outsideHoursMessage());
  if (open) {
    await saveSession(phone, { state: 'menu', updatedAt: new Date().toISOString() });
    console.log(`[whatsapp-atendimento] ${phone}${pushName ? ` (${pushName})` : ''} → menu enviado`);
  } else {
    await clearSession(phone);
    console.log(`[whatsapp-atendimento] ${phone}${pushName ? ` (${pushName})` : ''} → fora do horário`);
  }
}

export type EvolutionWebhookPayload = {
  event?: string;
  data?: EvolutionMessageData;
  instanceId?: string;
  instanceToken?: string;
};

export function isIncomingUserMessage(payload: EvolutionWebhookPayload): boolean {
  const event = (payload.event || '').toLowerCase();
  if (event !== 'message') return false;

  const info = payload.data?.Info;
  if (!info || info.IsFromMe || info.IsGroup) return false;

  const phone = phoneFromWhatsAppJid(info.Chat || info.Sender);
  return !!phone;
}

/**
 * Processa mensagem recebida e responde com menu / confirmação de fila.
 * Retorna true se uma resposta foi enviada.
 */
export async function handleIncomingWhatsAppMessage(payload: EvolutionWebhookPayload): Promise<boolean> {
  if (!isIncomingUserMessage(payload)) return false;

  const info = payload.data!.Info!;
  const phone = phoneFromWhatsAppJid(info.Chat || info.Sender);
  if (!phone) return false;

  let text = textFromEvolutionMessage(payload.data);
  if (!text.trim()) {
    text = 'oi';
  }

  const pushName = info.PushName?.trim();
  const open = isWithinBusinessHours();

  if (isExitCommand(text)) {
    await clearSession(phone);
    await sendWhatsAppText(phone, goodbyeMessage());
    console.log(`[whatsapp-atendimento] ${phone}${pushName ? ` (${pushName})` : ''} → saiu`);
    return true;
  }

  if (isMenuCommand(text)) {
    await sendMenuOrClosed(phone, pushName);
    return true;
  }

  if (!open) {
    await sendWhatsAppText(phone, outsideHoursMessage());
    await clearSession(phone);
    return true;
  }

  const session = await getSession(phone);
  const choice = normalizeChoice(text);

  if (!session || session.state === 'menu') {
    if (choice) {
      await startDepartmentFlow(phone, DEPARTMENTS[choice], pushName);
      return true;
    }

    if (!session) {
      await sendMenuOrClosed(phone, pushName);
      return true;
    }

    await sendWhatsAppText(phone, invalidOptionMessage());
    return true;
  }

  if (session.state === 'collecting_info') {
    if (choice) {
      await startDepartmentFlow(phone, DEPARTMENTS[choice], pushName);
      return true;
    }

    if (!isValidContactInfo(text)) {
      await sendWhatsAppText(phone, invalidContactInfoMessage());
      return true;
    }

    const contactInfo = parseContactInfo(text);
    const label = departmentLabel(session.department);
    await sendWhatsAppText(phone, queuedMessage(label));
    await saveSession(phone, {
      state: 'queued',
      department: session.department,
      contactInfo,
      updatedAt: new Date().toISOString(),
    });
    logQueuedContact(phone, session.department!, contactInfo, pushName);
    return true;
  }

  if (session.state === 'queued') {
    if (choice) {
      await startDepartmentFlow(phone, DEPARTMENTS[choice], pushName);
      return true;
    }

    await sendWhatsAppText(phone, alreadyQueuedMessage(departmentLabel(session.department)));
    return true;
  }

  return false;
}
