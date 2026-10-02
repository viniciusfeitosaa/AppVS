import { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';

/** As fotos exigem token; carrega como blob e revoga ao desmontar. */
export const FotoFacialProtegida = ({
  tipo,
  id,
  legenda,
}: {
  tipo: 'checkin' | 'checkout' | 'biometria';
  id: string | null;
  legenda: string;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    let criada: string | null = null;
    setFalhou(false);
    adminService
      .getFotoFacialUrl(tipo, id)
      .then((u) => {
        criada = u;
        if (ativo) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => ativo && setFalhou(true));
    return () => {
      ativo = false;
      if (criada) URL.revokeObjectURL(criada);
      setUrl(null);
    };
  }, [tipo, id]);

  return (
    <figure className="flex flex-col items-center gap-1">
      <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-viva-100 border border-viva-200 flex items-center justify-center">
        {!id ? (
          <span className="text-[10px] text-viva-500 px-2 text-center">Sem foto</span>
        ) : falhou ? (
          <span className="text-[10px] text-red-600 px-2 text-center">Não foi possível carregar</span>
        ) : url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="w-full h-full">
            <img src={url} alt={legenda} className="w-full h-full object-cover" />
          </a>
        ) : (
          <span className="text-[10px] text-viva-500">Carregando…</span>
        )}
      </div>
      <figcaption className="text-[10px] font-semibold text-viva-700 text-center">{legenda}</figcaption>
    </figure>
  );
};
