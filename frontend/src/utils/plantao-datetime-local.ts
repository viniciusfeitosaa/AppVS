/**
 * Horarios oficiais/alegados de plantao no backend usam a convencao
 * "face do relogio civil = componentes UTC" (ex.: 09:00 do turno -> ...T09:00:00.000Z).
 * datetime-local e labels devem ler/gravar com getUTC* e Date.UTC para nao
 * deslocar 3h no fuso America/Sao_Paulo.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → valor de `<input type="datetime-local">` (face do relógio do plantão). */
export function toPlantaoDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Valor de datetime-local → ISO com a mesma face de relógio em UTC. */
export function fromPlantaoDatetimeLocalValue(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(local || '').trim());
  if (!m) {
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  return new Date(Date.UTC(y, mo - 1, day, h, mi, 0, 0)).toISOString();
}

/** Exibição pt-BR da face do relógio do plantão (sem converter fuso do browser). */
export function formatPlantaoDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatPlantaoDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
