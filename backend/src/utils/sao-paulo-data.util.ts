const TZ = 'America/Sao_Paulo';

/** Data civil YYYY-MM-DD em São Paulo. */
export function dataCivilSaoPaulo(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Início do dia civil em SP como Date UTC (para comparar com @db.Date). */
export function inicioDiaCivilSaoPauloAsUtcDate(dataYmd: string): Date {
  return new Date(`${dataYmd}T00:00:00.000Z`);
}

/** Subtrai dias de uma data YYYY-MM-DD (meio-dia UTC evita borda de fuso). */
export function subtractDiasFromYmd(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}
