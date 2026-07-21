const TZ = 'America/Sao_Paulo';

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type SaoPauloClock = {
  day: number; // 0=dom … 6=sáb
  minutes: number; // minutos desde meia-noite
};

/** Horário civil em São Paulo (fuso da Viva Saúde). */
export function getSaoPauloClock(date = new Date()): SaoPauloClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );

  const day = WEEKDAY_MAP[parts.weekday] ?? 0;
  const hour = parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);

  return { day, minutes: hour * 60 + minute };
}

/** Seg–qui: 8h–12h e 13h–18h | Sex: 8h–12h e 13h–17h | Sáb/Dom: fechado */
export function isWithinBusinessHours(date = new Date()): boolean {
  const { day, minutes } = getSaoPauloClock(date);

  if (day === 0 || day === 6) return false;

  const inMorning = minutes >= 8 * 60 && minutes < 12 * 60;
  const afternoonEnd = day === 5 ? 17 * 60 : 18 * 60;
  const inAfternoon = minutes >= 13 * 60 && minutes < afternoonEnd;

  return inMorning || inAfternoon;
}

/** Texto fixo dos horários para mensagens WhatsApp. */
export function businessHoursText(): string {
  return [
    '🕐 *Horário de atendimento*',
    'Segunda a quinta: 8h às 12h e 13h às 18h',
    'Sexta: 8h às 12h e 13h às 17h',
    '(pausa para almoço das 12h às 13h)',
  ].join('\n');
}
