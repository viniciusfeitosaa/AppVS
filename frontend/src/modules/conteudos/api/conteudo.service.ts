import api from '../../../services/api';

export type ConteudoEventoStatus = 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO';
export type ConteudoPalestranteStatus = 'PENDENTE_FORM' | 'COMPLETO';

export type ConteudoPalestrante = {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  bio?: string | null;
  fotoUrl?: string | null;
  crm?: string | null;
  especialidade?: string | null;
  medicoId?: string | null;
  status: ConteudoPalestranteStatus;
};

export type ConteudoEvento = {
  id: string;
  titulo: string;
  capaUrl?: string | null;
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  youtubeEmbedUrl?: string | null;
  descricao?: string | null;
  iniciaEm: string;
  status: ConteudoEventoStatus;
  palestranteId?: string | null;
  palestrante?: ConteudoPalestrante | null;
  participantesCount?: number;
  jaInscrito?: boolean;
  tokenPalestrante?: string;
  tokenInscricao?: string;
  linkPalestrante?: string;
  linkInscricao?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ConteudoParticipante = {
  id: string;
  origem: 'MEDICO' | 'EXTERNO';
  nome: string;
  email: string;
  telefone?: string | null;
  crm?: string | null;
  especialidade?: string | null;
  cidade?: string | null;
  interesseCorpoClinico?: boolean;
  medicoId?: string | null;
  consentimentoLgpd: boolean;
  createdAt: string;
};

export type ConteudoPrecadastro = {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  crm?: string | null;
  especialidade?: string | null;
  cidade?: string | null;
  interesseCorpoClinico: boolean;
  consentimentoLgpd: boolean;
  createdAt: string;
  resumo: string;
  evento: {
    id: string;
    titulo: string;
    iniciaEm: string;
    status: ConteudoEventoStatus;
  };
};

export type CreateEventoPayload = {
  titulo: string;
  youtubeUrl?: string | null;
  iniciaEm: string;
  descricao?: string | null;
  palestranteId?: string | null;
  status?: ConteudoEventoStatus;
};

export const conteudoAdminService = {
  listEventos: () => api.get<{ success: boolean; data: ConteudoEvento[] }>('/admin/conteudos/eventos'),
  getEvento: (id: string) =>
    api.get<{ success: boolean; data: ConteudoEvento }>(`/admin/conteudos/eventos/${id}`),
  createEvento: (payload: CreateEventoPayload) =>
    api.post<{ success: boolean; data: ConteudoEvento }>('/admin/conteudos/eventos', payload),
  updateEvento: (id: string, payload: Partial<CreateEventoPayload>) =>
    api.patch<{ success: boolean; data: ConteudoEvento }>(`/admin/conteudos/eventos/${id}`, payload),
  publicar: (id: string) =>
    api.patch<{ success: boolean; data: ConteudoEvento }>(`/admin/conteudos/eventos/${id}/publicar`),
  encerrar: (id: string) =>
    api.patch<{ success: boolean; data: ConteudoEvento }>(`/admin/conteudos/eventos/${id}/encerrar`),
  rascunho: (id: string) =>
    api.patch<{ success: boolean; data: ConteudoEvento }>(`/admin/conteudos/eventos/${id}/rascunho`),
  regenerarToken: (id: string, tipo: 'palestrante' | 'inscricao') =>
    api.patch<{ success: boolean; data: ConteudoEvento }>(
      `/admin/conteudos/eventos/${id}/tokens/${tipo}`
    ),
  convidarPalestrante: (
    id: string,
    payload: { nome?: string; email?: string; medicoId?: string }
  ) =>
    api.post<{ success: boolean; data: ConteudoEvento }>(
      `/admin/conteudos/eventos/${id}/palestrante`,
      payload
    ),
  listPalestrantes: (q?: string) =>
    api.get<{ success: boolean; data: ConteudoPalestrante[] }>('/admin/conteudos/palestrantes', {
      params: q ? { q } : undefined,
    }),
  listParticipantes: (id: string) =>
    api.get<{ success: boolean; data: ConteudoParticipante[] }>(
      `/admin/conteudos/eventos/${id}/participantes`
    ),
  listPrecadastros: () =>
    api.get<{ success: boolean; data: ConteudoPrecadastro[] }>('/admin/conteudos/precadastros'),
  uploadCapa: (id: string, file: File) => {
    const form = new FormData();
    form.append('capa', file);
    return api.post<{ success: boolean; data: ConteudoEvento }>(
      `/admin/conteudos/eventos/${id}/capa`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  capaUrl: (id: string) => {
    const base = api.defaults.baseURL || '/api';
    return `${base}/admin/conteudos/eventos/${id}/capa`;
  },
};

export const conteudoMedicoService = {
  list: () => api.get<{ success: boolean; data: ConteudoEvento[] }>('/medico/conteudos'),
  get: (id: string) =>
    api.get<{ success: boolean; data: ConteudoEvento }>(`/medico/conteudos/${id}`),
  inscrever: (id: string) =>
    api.post<{ success: boolean; data: unknown }>(`/medico/conteudos/${id}/inscrever`),
  capaUrl: (id: string) => {
    const base = api.defaults.baseURL || '/api';
    return `${base}/medico/conteudos/${id}/capa`;
  },
};

export const conteudoPublicService = {
  getPalestrante: (token: string) =>
    api.get<{
      success: boolean;
      data: {
        evento: { id: string; titulo: string; iniciaEm: string };
        palestrante: ConteudoPalestrante | null;
      };
    }>(`/conteudos/public/palestrante/${token}`),
  submitPalestrante: (
    token: string,
    payload: {
      nome: string;
      email: string;
      telefone?: string;
      bio?: string;
      fotoUrl?: string;
      crm?: string;
      especialidade?: string;
    }
  ) => api.post(`/conteudos/public/palestrante/${token}`, payload),
  getInscricao: (token: string) =>
    api.get<{ success: boolean; data: { evento: ConteudoEvento } }>(
      `/conteudos/public/inscricao/${token}`
    ),
  submitInscricao: (
    token: string,
    payload: {
      nome: string;
      email: string;
      telefone: string;
      crm?: string;
      especialidade?: string;
      cidade?: string;
      interesseCorpoClinico?: boolean;
      consentimentoLgpd: boolean;
    }
  ) => api.post(`/conteudos/public/inscricao/${token}`, payload),
  capaUrl: (token: string) => {
    const base = api.defaults.baseURL || '/api';
    return `${base}/conteudos/public/inscricao/${token}/capa`;
  },
};
