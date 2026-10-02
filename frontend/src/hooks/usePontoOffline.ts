import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  descartarItem,
  listarFila,
  onFilaAlterada,
  sincronizarFila,
  type PontoOfflineItem,
} from '../lib/pontoOfflineQueue';
import { notify } from '../lib/notificationEmitter';

const INTERVALO_SYNC_MS = 60_000;

/** Estado da fila de pontos offline do médico e sincronização automática (online, foco, a cada 60 s). */
export function usePontoOffline(medicoId: string | undefined) {
  const queryClient = useQueryClient();
  const [fila, setFila] = useState<PontoOfflineItem[]>([]);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);

  const recarregar = useCallback(async () => {
    if (!medicoId) return setFila([]);
    try {
      setFila(await listarFila(medicoId));
    } catch {
      setFila([]);
    }
  }, [medicoId]);

  const sincronizar = useCallback(async () => {
    if (!medicoId || !navigator.onLine) return;
    const atual = await listarFila(medicoId).catch(() => []);
    if (atual.length === 0 || atual[0].erro) return;
    setSincronizando(true);
    try {
      const r = await sincronizarFila(medicoId);
      if (r.enviados > 0) {
        await queryClient.invalidateQueries({ queryKey: ['ponto'] });
        notify({
          kind: 'success',
          title: 'Pontos enviados',
          message:
            r.enviados === 1
              ? 'O ponto guardado no aparelho foi enviado.'
              : `${r.enviados} pontos guardados no aparelho foram enviados.`,
          source: 'ponto',
        });
      }
      if (r.erro) {
        notify({ kind: 'error', title: 'Ponto offline recusado', message: r.erro, source: 'ponto' });
      }
    } finally {
      setSincronizando(false);
    }
  }, [medicoId, queryClient]);

  const descartar = useCallback(async (clientUuid: string) => {
    await descartarItem(clientUuid);
  }, []);

  useEffect(() => {
    void recarregar();
    return onFilaAlterada(() => void recarregar());
  }, [recarregar]);

  useEffect(() => {
    const aoMudar = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sincronizar();
    };
    const aoFocar = () => {
      if (document.visibilityState === 'visible') void sincronizar();
    };
    window.addEventListener('online', aoMudar);
    window.addEventListener('offline', aoMudar);
    document.addEventListener('visibilitychange', aoFocar);
    const t = window.setInterval(() => void sincronizar(), INTERVALO_SYNC_MS);
    void sincronizar();
    return () => {
      window.removeEventListener('online', aoMudar);
      window.removeEventListener('offline', aoMudar);
      document.removeEventListener('visibilitychange', aoFocar);
      window.clearInterval(t);
    };
  }, [sincronizar]);

  return { fila, online, sincronizando, sincronizar, descartar };
}
