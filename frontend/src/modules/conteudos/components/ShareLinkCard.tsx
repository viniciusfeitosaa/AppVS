type ShareLinkCardProps = {
  label: string;
  description?: string;
  url: string;
  onCopy: () => void;
  disabledHint?: string | null;
};

export function ShareLinkCard({ label, description, url, onCopy, disabledHint }: ShareLinkCardProps) {
  const short = url.replace(/^https?:\/\//, '');
  return (
    <div
      className={`rounded-xl border p-3 ${
        disabledHint
          ? 'border-amber-200/80 bg-amber-50/60'
          : 'border-viva-200/80 bg-gradient-to-br from-viva-50/80 to-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-viva-900">{label}</p>
          {description ? <p className="text-xs text-viva-600 leading-relaxed">{description}</p> : null}
          {disabledHint ? (
            <p className="text-xs text-amber-800">{disabledHint}</p>
          ) : (
            <p className="truncate font-mono text-[11px] text-viva-500" title={url}>
              {short}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={!!disabledHint}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-viva-800 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-viva-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copiar
        </button>
      </div>
    </div>
  );
}
