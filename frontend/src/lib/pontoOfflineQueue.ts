import api from '../services/api';

/** Ponto capturado sem internet, guardado no aparelho até sincronizar. */
export interface PontoOfflineItem {
  clientUuid: string;
  medicoId: string;
  tipo: 'checkin' | 'checkout';
  escalaId?: string;
  observacao?: string;
  latitude?: number;
  longitude?: number;
  motivoSemFoto?: string;
  foto?: Blob;
  /** Relógio do aparelho no momento da captura. */
  capturadoEm: string;
  tentativas: number;
  /** Recusado pelo servidor: a fila para aqui até o médico descartar. */
  erro?: string;
}

const DB_NOME = 'coopvitta-ponto';
const STORE = 'fila';
export const FILA_LIMITE = 20;

/** `crypto.randomUUID` só existe em contexto seguro (HTTPS). */
function gerarUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function abrirDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NOME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'clientUuid' });
        store.createIndex('medicoId', 'medicoId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrirDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, modo).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const ouvintes = new Set<() => void>();
export function onFilaAlterada(fn: () => void) {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}
const avisar = () => ouvintes.forEach((fn) => fn());

export async function listarFila(medicoId: string): Promise<PontoOfflineItem[]> {
  const itens = await tx<PontoOfflineItem[]>('readonly', (s) => s.index('medicoId').getAll(medicoId));
  return itens.sort((a, b) => a.capturadoEm.localeCompare(b.capturadoEm));
}

export async function enfileirarPonto(
  item: Omit<PontoOfflineItem, 'clientUuid' | 'capturadoEm' | 'tentativas'>
): Promise<PontoOfflineItem> {
  const atuais = await listarFila(item.medicoId);
  if (atuais.length >= FILA_LIMITE) {
    throw new Error('Há muitos pontos guardados no aparelho. Conecte-se à internet para enviá-los.');
  }
  const novo: PontoOfflineItem = {
    ...item,
    clientUuid: gerarUuid(),
    capturadoEm: new Date().toISOString(),
    tentativas: 0,
  };
  await tx('readwrite', (s) => s.put(novo));
  avisar();
  return novo;
}

export async function descartarItem(clientUuid: string) {
  await tx('readwrite', (s) => s.delete(clientUuid));
  avisar();
}

async function salvarItem(item: PontoOfflineItem) {
  await tx('readwrite', (s) => s.put(item));
  avisar();
}

export type ResultadoSync = { enviados: number; pendentes: number; erro?: string };

let sincronizando = false;

/**
 * Envia em ordem de captura (a saída depende da entrada). Para na primeira falha:
 * sem rede tenta de novo depois; recusa do servidor fica marcada até o médico descartar.
 */
export async function sincronizarFila(medicoId: string): Promise<ResultadoSync> {
  if (sincronizando) return { enviados: 0, pendentes: (await listarFila(medicoId)).length };
  sincronizando = true;
  let enviados = 0;
  try {
    const itens = await listarFila(medicoId);
    for (const item of itens) {
      if (item.erro) return { enviados, pendentes: itens.length - enviados, erro: item.erro };
      const fd = new FormData();
      fd.append('clientUuid', item.clientUuid);
      fd.append('capturadoEm', item.capturadoEm);
      fd.append('enviadoEm', new Date().toISOString());
      if (item.escalaId) fd.append('escalaId', item.escalaId);
      if (item.observacao) fd.append('observacao', item.observacao);
      if (item.latitude != null) fd.append('latitude', String(item.latitude));
      if (item.longitude != null) fd.append('longitude', String(item.longitude));
      if (item.foto) fd.append('foto', item.foto, 'ponto-offline.jpg');
      else if (item.motivoSemFoto) fd.append('motivoSemFoto', item.motivoSemFoto);

      const base = String(api.defaults.baseURL || '').replace(/\/$/, '');
      const token = localStorage.getItem('accessToken');
      let res: Response;
      try {
        res = await fetch(`${base}/ponto/${item.tipo}-offline`, {
          method: 'POST',
          body: fd,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      } catch {
        await salvarItem({ ...item, tentativas: item.tentativas + 1 });
        return { enviados, pendentes: itens.length - enviados };
      }
      if (res.status === 401 || res.status >= 500) {
        await salvarItem({ ...item, tentativas: item.tentativas + 1 });
        return { enviados, pendentes: itens.length - enviados };
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const erro = body.error || `Recusado pelo servidor (${res.status})`;
        await salvarItem({ ...item, tentativas: item.tentativas + 1, erro });
        return { enviados, pendentes: itens.length - enviados, erro };
      }
      await descartarItem(item.clientUuid);
      enviados += 1;
    }
    return { enviados, pendentes: 0 };
  } finally {
    sincronizando = false;
  }
}
