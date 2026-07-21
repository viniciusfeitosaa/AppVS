/** Extrai dígitos E.164 BR a partir de JID WhatsApp (ex.: 5511999999999@s.whatsapp.net). */
export function phoneFromWhatsAppJid(jid: string | null | undefined): string | null {
  if (!jid || typeof jid !== 'string') return null;
  const user = jid.split('@')[0]?.split(':')[0] ?? '';
  const digits = user.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export type EvolutionMessageData = {
  Info?: {
    Chat?: string;
    Sender?: string;
    IsFromMe?: boolean;
    IsGroup?: boolean;
    PushName?: string;
  };
  Message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    buttonsResponseMessage?: { selectedDisplayText?: string; selectedButtonId?: string };
    listResponseMessage?: { title?: string; singleSelectReply?: { selectedRowId?: string } };
  };
};

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
