type DateTimeFieldProps = {
  label?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
};

function splitLocal(value: string): { date: string; time: string } {
  if (!value || !value.includes('T')) return { date: '', time: '' };
  const [date, timePart] = value.split('T');
  return { date: date || '', time: (timePart || '').slice(0, 5) };
}

function joinLocal(date: string, time: string): string {
  if (!date) return '';
  return `${date}T${time || '00:00'}`;
}

function formatPreview(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DateTimeField({
  label = 'Data e hora',
  hint,
  value,
  onChange,
  required,
  disabled,
  id = 'conteudo-inicia-em',
}: DateTimeFieldProps) {
  const { date, time } = splitLocal(value);
  const preview = formatPreview(value);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`${id}-date`} className="text-sm font-medium text-viva-800">
          {label}
          {required ? <span className="text-rose-600"> *</span> : null}
        </label>
        {hint ? <span className="text-[11px] text-viva-500">{hint}</span> : null}
      </div>

      <div className="rounded-xl border border-viva-200 bg-gradient-to-b from-white to-viva-50/40 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="grid grid-cols-1 sm:grid-cols-[1.35fr_1fr] gap-2">
          <label className="relative block">
            <span className="sr-only">Data</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-viva-500" aria-hidden>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
              </svg>
            </span>
            <input
              id={`${id}-date`}
              type="date"
              required={required}
              disabled={disabled}
              value={date}
              onChange={(e) => onChange(joinLocal(e.target.value, time))}
              className="w-full rounded-lg border border-viva-200 bg-white py-2.5 pl-9 pr-3 text-sm text-viva-900 shadow-sm outline-none transition focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20 disabled:opacity-60 [color-scheme:light]"
            />
          </label>

          <label className="relative block">
            <span className="sr-only">Hora</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-viva-500" aria-hidden>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <input
              id={`${id}-time`}
              type="time"
              required={required}
              disabled={disabled || !date}
              value={time}
              onChange={(e) => onChange(joinLocal(date, e.target.value))}
              className="w-full rounded-lg border border-viva-200 bg-white py-2.5 pl-9 pr-3 text-sm text-viva-900 shadow-sm outline-none transition focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20 disabled:opacity-60 [color-scheme:light]"
            />
          </label>
        </div>

        <p className={`mt-2 px-1 text-xs ${preview ? 'text-viva-700' : 'text-viva-400'}`}>
          {preview ? (
            <>
              <span className="font-medium text-viva-800">Início:</span> {preview}
            </>
          ) : (
            'Escolha a data e o horário de início do conteúdo.'
          )}
        </p>
      </div>
    </div>
  );
}
