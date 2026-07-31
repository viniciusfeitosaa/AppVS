import { useRef, useState } from 'react';
import { AuthImage } from './AuthImage';

type CapaUploadFieldProps = {
  eventoId: string;
  capaUrl?: string | null;
  updatedAt?: string;
  uploading?: boolean;
  onUpload: (file: File) => void;
};

export function CapaUploadField({ eventoId, capaUrl, updatedAt, uploading, onUpload }: CapaUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (file?: File | null) => {
    if (!file) return;
    onUpload(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-viva-800">Capa</span>
        <span className="text-[11px] text-viva-500">JPG, PNG ou WebP</span>
      </div>

      {capaUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-viva-200 bg-viva-50">
          <AuthImage
            key={updatedAt || capaUrl}
            apiPath={`/admin/conteudos/eventos/${eventoId}/capa`}
            alt="Capa do conteúdo"
            className="h-44 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/55 to-transparent px-3 py-2.5">
            <span className="text-xs font-medium text-white/95">Capa atual</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-viva-900 shadow-sm hover:bg-white disabled:opacity-60"
            >
              {uploading ? 'Enviando…' : 'Trocar imagem'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          disabled={uploading}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragging
              ? 'border-viva-600 bg-viva-100/70'
              : 'border-viva-300 bg-viva-50/40 hover:border-viva-500 hover:bg-viva-50'
          } disabled:opacity-60`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-viva-700 shadow-sm ring-1 ring-viva-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 16V7m0 0 3.5 3.5M12 7 8.5 10.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-sm font-medium text-viva-900">
            {uploading ? 'Enviando capa…' : 'Arraste uma imagem ou clique para escolher'}
          </span>
          <span className="text-xs text-viva-600">Recomendado: 16:9, até ~2 MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
