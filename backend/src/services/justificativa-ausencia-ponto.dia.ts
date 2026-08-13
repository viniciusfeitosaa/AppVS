/** Intervalo [início, fim] do dia civil local (00:00:00.000–23:59:59.999). */
export function intervaloDiaCivil(data: Date): { gte: Date; lte: Date } {
  const gte = new Date(data);
  gte.setHours(0, 0, 0, 0);
  const lte = new Date(data);
  lte.setHours(23, 59, 59, 999);
  return { gte, lte };
}
