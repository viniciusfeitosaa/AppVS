/** Extrai dígitos E.164 BR a partir de JID WhatsApp (ex.: 5511999999999@s.whatsapp.net). */
export function phoneFromWhatsAppJid(jid: string | null | undefined): string | null {
  if (!jid || typeof jid !== 'string') return null;
  // LID / IDs internos do WhatsApp não são telefone (ex.: 222088598184178@lid)
  if (jid.includes('@lid') || jid.includes('@hosted') || jid.includes('@broadcast')) {
    return null;
  }
  const user = jid.split('@')[0]?.split(':')[0] ?? '';
  const digits = user.replace(/\D/g, '');
  if (digits.length < 10) return null;
  // BR local 10/11 dígitos
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  // E.164 BR: 55 + DDD + número → 12 ou 13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return null;
}

function normalizeJidKey(jid: string): string {
  return jid.trim().toLowerCase();
}

export function chatJidKey(jid: string | null | undefined): string | null {
  if (!jid || typeof jid !== 'string') return null;
  const j = jid.trim();
  if (!j) return null;
  return normalizeJidKey(j);
}

export type EvolutionMessageInfo = {
  ID?: string;
  Chat?: string;
  Sender?: string;
  IsFromMe?: boolean;
  IsGroup?: boolean;
  PushName?: string;
  /** Campos alternativos (WhatsApp LID addressing) */
  SenderAlt?: string;
  RecipientAlt?: string;
  ChatAlt?: string;
  AddressingMode?: string;
};

export type EvolutionMessageData = {
  Info?: EvolutionMessageInfo;
  Message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    buttonsResponseMessage?: { selectedDisplayText?: string; selectedButtonId?: string };
    listResponseMessage?: { title?: string; singleSelectReply?: { selectedRowId?: string } };
  };
};

/**
 * Resolve o telefone do contato (não o da conta da clínica) a partir do Info do webhook.
 * Prefere JID @s.whatsapp.net; ignora @lid.
 */
export function resolveContactPhoneFromInfo(info: EvolutionMessageInfo | undefined | null): string | null {
  if (!info) return null;

  const raw = info as EvolutionMessageInfo & Record<string, unknown>;
  const candidates: Array<string | undefined> = [
    info.Chat,
    info.RecipientAlt,
    info.ChatAlt,
    info.SenderAlt,
    typeof raw.recipientAlt === 'string' ? raw.recipientAlt : undefined,
    typeof raw.senderAlt === 'string' ? raw.senderAlt : undefined,
    typeof raw.chatAlt === 'string' ? raw.chatAlt : undefined,
    // Em mensagens IsFromMe, Sender costuma ser a própria clínica — Chat/Alt têm o contato.
    info.IsFromMe ? undefined : info.Sender,
    info.Sender,
  ];

  for (const jid of candidates) {
    if (jid && jid.includes('@s.whatsapp.net')) {
      const phone = phoneFromWhatsAppJid(jid);
      if (phone) return phone;
    }
  }

  for (const jid of candidates) {
    const phone = phoneFromWhatsAppJid(jid);
    if (phone) return phone;
  }

  return null;
}

/** JID bruto do chat (para chave Redis auxiliar quando só há LID). */
export function resolveChatJidFromInfo(info: EvolutionMessageInfo | undefined | null): string | null {
  if (!info) return null;
  return chatJidKey(info.Chat) || chatJidKey(info.RecipientAlt) || chatJidKey(info.ChatAlt);
}

/** Texto legível de um payload Message da Evolution GO. */
export function textFromEvolutionMessage(data: EvolutionMessageData | undefined): string {
  if (!data?.Message) return '';
  const m = data.Message;
  const raw =
    m.conversation?.trim() ||
    m.extendedTextMessage?.text?.trim() ||
    m.buttonsResponseMessage?.selectedDisplayText?.trim() ||
    m.buttonsResponseMessage?.selectedButtonId?.trim() ||
    m.listResponseMessage?.title?.trim() ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId?.trim() ||
    '';
  return raw;
}
