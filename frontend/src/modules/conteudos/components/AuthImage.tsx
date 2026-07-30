import { useEffect, useState } from 'react';
import api from '../../../services/api';

/** Carrega imagem de rota autenticada (Bearer) via blob URL. */
export function AuthImage({
  apiPath,
  alt,
  className,
}: {
  /** Caminho relativo à base da API, ex.: `/admin/conteudos/eventos/:id/capa` */
  apiPath: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(apiPath, { responseType: 'blob' });
        if (cancelled) return;
        const url = URL.createObjectURL(res.data);
        revoked = url;
        setSrc(url);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [apiPath]);

  if (!src) {
    return (
      <div className={`bg-viva-100 flex items-center justify-center text-viva-500 text-sm ${className || ''}`}>
        Sem capa
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}
