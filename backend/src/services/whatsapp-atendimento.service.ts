import { getRedisClient } from '../config/redis';
import {
  phoneFromWhatsAppJid,
  resolveChatJidFromInfo,
  resolveContactPhoneFromInfo,
  textFromEvolutionMessage,
  type EvolutionMessageData,
} from '../utils/whatsapp-jid.util';
import {
  businessHoursText,
  isWithinBusinessHours,
} from '../utils/whatsapp-horario-comercial.util';
import { sendWhatsAppText, deleteWhatsAppMessage } from './evolution-whatsapp.service';


export type AtendimentoDepartment = 'administrativo' | 'financeiro' | 'duvidas' | 'viva_atualiza';

export type AtendimentoContactInfo = {
  nome?: string;
  crm?: string;
  local?: string;
  email?: string;
  faculdade?: string;
  duvida?: string;
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
const PAUSED_PREFIX = 'wa:atendimento:paused:';
const LID_PHONE_PREFIX = 'wa:lid2phone:';
const SESSION_TTL_SEC = 4 * 60 * 60; // 4h — depois disso, novo contato recebe menu de novo
const PAUSED_TTL_SEC = 24 * 60 * 60; // 24h — pausa humana na conversa
const LID_MAP_TTL_SEC = 30 * 24 * 60 * 60;

type DepartmentChoice = '1' | '2' | '3' | '4';

const DEPARTMENTS: Record<DepartmentChoice, { key: AtendimentoDepartment; label: string }> = {
  '1': { key: 'administrativo', label: 'Administrativo' },
  '2': { key: 'financeiro', label: 'Financeiro' },
  '3': { key: 'duvidas', label: 'Dúvidas' },
  '4': { key: 'viva_atualiza', label: 'Viva Atualiza' },
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
    '4️⃣ Viva Atualiza',
    '',
    '_Responda com 1, 2, 3 ou 4._',
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
    'Opção inválida. Por favor, responda apenas com *1*, *2*, *3* ou *4*.',
    '',
    COMMANDS_HINT,
  ].join('\n');
}

function askContactInfoMessage(dept: AtendimentoDepartment, label: string): string {
  if (dept === 'viva_atualiza') {
    return [
      `Você selecionou *${label}*.`,
      '',
      'Para continuar, informe em uma mensagem:',
      '• *Nome completo*',
      '• *Faculdade* ou *CRM*',
      '• *E-mail*',
      '',
      '_Envie tudo em uma única mensagem._',
      COMMANDS_HINT,
    ].join('\n');
  }

  if (dept === 'duvidas') {
    return [
      `Você selecionou *${label}*.`,
      '',
      'Para facilitar o atendimento, informe:',
      '• *Nome completo*',
      '• *CRM*',
      '• *Local onde trabalha*',
      '• *Qual a sua dúvida?*',
      '',
      '_Envie tudo em uma única mensagem._',
      COMMANDS_HINT,
    ].join('\n');
  }

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

function invalidContactInfoMessage(dept?: AtendimentoDepartment): string {
  if (dept === 'viva_atualiza') {
    return [
      'Não consegui identificar seus dados. Por favor, envie em uma mensagem:',
      '• Nome completo',
      '• Faculdade ou CRM',
      '• E-mail',
      '',
      COMMANDS_HINT,
    ].join('\n');
  }

  if (dept === 'duvidas') {
    return [
      'Não consegui identificar seus dados. Por favor, envie em uma mensagem:',
      '• Nome completo',
      '• CRM',
      '• Local onde trabalha',
      '• Qual a sua dúvida',
      '',
      COMMANDS_HINT,
    ].join('\n');
  }

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

function normalizeChoice(text: string): DepartmentChoice | null {
  const t = text.trim().toLowerCase();
  if (t === '1' || t.includes('administr')) return '1';
  if (t === '2' || t.includes('financeir')) return '2';
  if (t === '3' || t.includes('duvida') || t.includes('dúvida')) return '3';
  if (t === '4' || t.includes('viva atualiza')) return '4';
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

export function isPauseCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'pausar' || t === 'pause' || t === 'parar robô' || t === 'parar robo';
}

export function isResumeCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === 'retomar' ||
    t === 'despausar' ||
    t === 'ativar' ||
    t === 'continuar' ||
    t === 'resume'
  );
}

/** Interpreta resposta livre conforme o setor. */
export function parseContactInfo(
  text: string,
  department: AtendimentoDepartment = 'administrativo'
): AtendimentoContactInfo {
  const raw = text.trim();
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  let nome: string | undefined;
  let crm: string | undefined;
  let local: string | undefined;
  let email: string | undefined;
  let faculdade: string | undefined;
  let duvida: string | undefined;

  for (const line of lines) {
    const match = line.match(
      /^(nome|crm|local|email|e-mail|faculdade|duvida|dúvida)\s*[:=\-]\s*(.+)$/i
    );
    if (!match) continue;
    const value = match[2].trim();
    const key = match[1].toLowerCase();
    if (key === 'nome') nome = value;
    else if (key === 'crm') crm = value;
    else if (key === 'local') local = value;
    else if (key === 'email' || key === 'e-mail') email = value;
    else if (key === 'faculdade') faculdade = value;
    else if (key === 'duvida' || key === 'dúvida') duvida = value;
  }

  if (!email) {
    const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) email = emailMatch[0];
  }

  if (department === 'viva_atualiza') {
    if (!nome && !crm && !faculdade && lines.length >= 3) {
      nome = lines[0];
      const mid = lines[1];
      email = email || lines.find((l) => l.includes('@')) || lines[2];
      if (/crm|\d{4,}/i.test(mid)) crm = mid;
      else faculdade = mid;
    } else if (!nome && lines.length >= 2) {
      nome = lines[0];
      const mid = lines[1];
      if (/@/.test(mid)) email = email || mid;
      else if (/crm|\d{4,}/i.test(mid)) crm = mid;
      else faculdade = mid;
    }
  } else if (department === 'duvidas') {
    if (!nome && !crm && !local && !duvida && lines.length >= 4) {
      nome = lines[0];
      crm = lines[1];
      local = lines[2];
      duvida = lines.slice(3).join(' ');
    } else if (!nome && !crm && !local && lines.length >= 3) {
      nome = lines[0];
      crm = lines[1];
      local = lines[2];
      if (lines.length > 3) duvida = lines.slice(3).join(' ');
    }
  } else if (!nome && !crm && !local && lines.length >= 3) {
    [nome, crm, local] = lines;
  } else if (!nome && !crm && lines.length === 2) {
    [nome, crm] = lines;
  }

  return { nome, crm, local, email, faculdade, duvida, raw };
}

function looksLikeEmail(value?: string): boolean {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidContactInfo(text: string, department: AtendimentoDepartment): boolean {
  const parsed = parseContactInfo(text, department);
  if (parsed.raw.length < 8) return false;

  if (department === 'viva_atualiza') {
    const identidade = !!(parsed.faculdade || parsed.crm);
    return !!(parsed.nome && identidade && looksLikeEmail(parsed.email));
  }

  if (department === 'duvidas') {
    const base = [parsed.nome, parsed.crm, parsed.local].filter(Boolean).length >= 2;
    const hasDuvida =
      !!(parsed.duvida && parsed.duvida.trim().length >= 5) ||
      (base && parsed.raw.split(/\s+/).length >= 8);
    return base && hasDuvida;
  }

  const parts = [parsed.nome, parsed.crm, parsed.local].filter(Boolean);
  if (parts.length >= 2) return true;
  return parsed.raw.split(/\s+/).length >= 4;
}

async function startDepartmentFlow(
  phone: string,
  dept: (typeof DEPARTMENTS)[DepartmentChoice],
  pushName?: string
): Promise<void> {
  await sendWhatsAppText(phone, askContactInfoMessage(dept.key, dept.label));
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
      `nome=${info.nome ?? '-'} | crm=${info.crm ?? '-'} | faculdade=${info.faculdade ?? '-'} | ` +
      `local=${info.local ?? '-'} | email=${info.email ?? '-'} | duvida=${info.duvida ?? '-'} | ` +
      `raw=${JSON.stringify(info.raw)}`
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

async function rememberLidPhoneMapping(phone: string, chatJid?: string | null): Promise<void> {
  if (!chatJid || !chatJid.includes('@lid')) return;
  if (!phone || phone.startsWith('lid:')) return;
  const redis = getRedisClient();
  if (!redis) return;
  await redis.set(`${LID_PHONE_PREFIX}${chatJid}`, phone, 'EX', LID_MAP_TTL_SEC);
}

async function phoneFromLidMapping(chatJid?: string | null): Promise<string | null> {
  if (!chatJid || !chatJid.includes('@lid')) return null;
  const redis = getRedisClient();
  if (!redis) return null;
  const mapped = await redis.get(`${LID_PHONE_PREFIX}${chatJid}`);
  return mapped || null;
}

async function isConversationPaused(phone: string, chatJid?: string | null): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  if ((await redis.get(`${PAUSED_PREFIX}${phone}`)) === '1') return true;
  if (chatJid) {
    const mapped = await redis.get(`${PAUSED_PREFIX}jid:${chatJid}`);
    // valor antigo '1' ou telefone real
    if (mapped) return true;
  }
  return false;
}

async function pauseConversation(phone: string, chatJid?: string | null): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  const pipeline = redis.multi();
  pipeline.set(`${PAUSED_PREFIX}${phone}`, '1', 'EX', PAUSED_TTL_SEC);
  if (chatJid) {
    // guarda o telefone no valor para o retomar via @lid achar a chave certa
    pipeline.set(`${PAUSED_PREFIX}jid:${chatJid}`, phone, 'EX', PAUSED_TTL_SEC);
  }
  await pipeline.exec();
  await rememberLidPhoneMapping(phone, chatJid);
  if (!phone.startsWith('lid:')) {
    await clearSession(phone);
  }
}

async function resumeConversation(phone: string, chatJid?: string | null): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  const toDel = [`${PAUSED_PREFIX}${phone}`];
  if (chatJid) {
    const mapped = await redis.get(`${PAUSED_PREFIX}jid:${chatJid}`);
    toDel.push(`${PAUSED_PREFIX}jid:${chatJid}`);
    if (mapped && mapped !== '1') {
      toDel.push(`${PAUSED_PREFIX}${mapped}`);
    }
  }
  await redis.del(...toDel);
}

function departmentLabel(key?: AtendimentoDepartment): string {
  if (key === 'financeiro') return 'Financeiro';
  if (key === 'duvidas') return 'Dúvidas';
  if (key === 'viva_atualiza') return 'Viva Atualiza';
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

  const phone = resolveContactPhoneFromInfo(info) || phoneFromWhatsAppJid(info.Chat || info.Sender);
  return !!phone;
}

function isStaffControlMessage(payload: EvolutionWebhookPayload): boolean {
  const event = (payload.event || '').toLowerCase();
  if (event !== 'message') return false;
  const info = payload.data?.Info;
  if (!info || !info.IsFromMe || info.IsGroup) return false;
  const text = textFromEvolutionMessage(payload.data);
  return isPauseCommand(text) || isResumeCommand(text);
}

/**
 * Processa mensagem recebida e responde com menu / confirmação de fila.
 * Retorna true se uma resposta foi enviada.
 */
export async function handleIncomingWhatsAppMessage(payload: EvolutionWebhookPayload): Promise<boolean> {
  const event = (payload.event || '').toLowerCase();
  if (event !== 'message') return false;

  const info = payload.data?.Info;
  if (!info || info.IsGroup) return false;

  const chatJid = resolveChatJidFromInfo(info);
  const phone =
    resolveContactPhoneFromInfo(info) ||
    phoneFromWhatsAppJid(info.Chat || info.Sender);

  let text = textFromEvolutionMessage(payload.data);
  if (!text.trim() && !info.IsFromMe) {
    text = 'oi';
  }

  const pushName = info.PushName?.trim();

  // Somente a equipe no WhatsApp da Viva Saúde (IsFromMe) controla pausa/retomada.
  // Silencioso para o cliente: sem confirmação no chat + tenta apagar o comando.
  if (info.IsFromMe) {
    if (!isStaffControlMessage(payload)) return false;

    if (!phone && !chatJid) {
      console.warn(
        `[whatsapp-atendimento] comando equipe sem telefone/jid resolvido chat=${info.Chat} sender=${info.Sender} alt=${info.RecipientAlt || info.SenderAlt || '-'}`
      );
      return false;
    }

    const messageId = info.ID?.trim();
    const chatRef = info.Chat || info.RecipientAlt || info.SenderAlt || phone || chatJid || '';
    const mappedFromLid = phone ? null : await phoneFromLidMapping(chatJid);
    const resolvedPhone = phone || mappedFromLid;
    const pausePhone = resolvedPhone || (chatJid ? `lid:${chatJid}` : '');
    if (!pausePhone) return false;

    if (resolvedPhone && chatJid) {
      await rememberLidPhoneMapping(resolvedPhone, chatJid);
    }

    if (isPauseCommand(text)) {
      await pauseConversation(pausePhone, chatJid);
      if (messageId && chatRef) {
        await deleteWhatsAppMessage(chatRef, messageId);
      }
      console.log(
        `[whatsapp-atendimento] ${pausePhone} → PAUSADO (equipe, silencioso) jid=${chatJid ?? '-'} chat=${info.Chat ?? '-'} alt=${info.RecipientAlt || info.SenderAlt || '-'}`
      );
      return true;
    }

    if (isResumeCommand(text)) {
      await resumeConversation(pausePhone, chatJid);
      if (resolvedPhone && resolvedPhone !== pausePhone) {
        await resumeConversation(resolvedPhone, chatJid);
      }
      if (chatJid) {
        await resumeConversation(`lid:${chatJid}`, chatJid);
      }
      if (messageId && chatRef) {
        await deleteWhatsAppMessage(chatRef, messageId);
      }
      console.log(
        `[whatsapp-atendimento] ${pausePhone} → RETOMADO (equipe, silencioso) jid=${chatJid ?? '-'} chat=${info.Chat ?? '-'} alt=${info.RecipientAlt || info.SenderAlt || '-'}`
      );
      return true;
    }

    return false;
  }

  if (!phone) return false;

  if (chatJid?.includes('@lid')) {
    await rememberLidPhoneMapping(phone, chatJid);
  }

  // Contato: se a conversa estiver pausada pela equipe, o robô não responde.
  if (await isConversationPaused(phone, chatJid)) {
    console.log(
      `[whatsapp-atendimento] ${phone}${pushName ? ` (${pushName})` : ''} → ignorado (conversa pausada pela equipe)`
    );
    return false;
  }

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

    if (!isValidContactInfo(text, session.department || 'administrativo')) {
      await sendWhatsAppText(phone, invalidContactInfoMessage(session.department));
      return true;
    }

    const contactInfo = parseContactInfo(text, session.department || 'administrativo');
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
