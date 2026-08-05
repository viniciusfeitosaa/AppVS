import api from '../../../services/api';

export type ConteudoEventoStatus = 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO';
export type ConteudoPalestranteStatus = 'PENDENTE_FORM' | 'COMPLETO';

export type ConteudoPalestrante = {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  cpf?: string | null;
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
  presentesCount?: number;
  ausentesCount?: number;
  jaInscrito?: boolean;
  presenteEm?: string | null;
  frequenciaAberta?: boolean;
  frequenciaAbertaEm?: string | null;
  frequenciaFechadaEm?: string | null;
  tokenPalestrante?: string;
  tokenInscricao?: string;
  tokenFrequencia?: string;
  linkPalestrante?: string;
  linkInscricao?: string;
  linkFrequencia?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ConteudoParticipante = {
  id: string;
  origem: 'MEDICO' | 'EXTERNO';
  perfil?: 'MEDICO' | 'ESTUDANTE';
  nome: string;
  email: string;
  telefone?: string | null;
  cpf?: string | null;
  crm?: string | null;
  especialidade?: string | null;
  cidade?: string | null;
  faculdade?: string | null;
  semestre?: string | null;
  participaLiga?: boolean | null;
  ligaNome?: string | null;
  interesseCorpoClinico?: boolean;
  medicoId?: string | null;
  consentimentoLgpd: boolean;
  presenteEm?: string | null;
  presencaOrigem?: 'APP' | 'LINK_PUBLICO' | null;
  createdAt: string;
};

export type ConteudoPrecadastroStatus = 'AGUARDANDO' | 'ACEITO' | 'CONVERTIDO';

export type ConteudoPrecadastro = {
  id: string;
  perfil?: 'MEDICO' | 'ESTUDANTE';
  nome: string;
  email: string;
  telefone?: string | null;
  cpf?: string | null;
  crm?: string | null;
  especialidade?: string | null;
  cidade?: string | null;
  faculdade?: string | null;
  semestre?: string | null;
  participaLiga?: boolean | null;
  ligaNome?: string | null;
  interesseCorpoClinico: boolean;
  consentimentoLgpd: boolean;
  precadastroStatus?: ConteudoPrecadastroStatus;
  precadastroAceitoEm?: string | null;
  camposFaltantes?: string[];
  presenteEm?: string | null;
  presencaOrigem?: 'APP' | 'LINK_PUBLICO' | null;
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
  regenerarToken: (id: string, tipo: 'palestrante' | 'inscricao' | 'frequencia') =>
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
  deleteParticipante: (eventoId: string, participanteId: string) =>
    api.delete<{ success: boolean; data: { id: string; nome: string; email: string } }>(
      `/admin/conteudos/eventos/${eventoId}/participantes/${participanteId}`
    ),
  abrirFrequencia: (id: string) =>
    api.post<{ success: boolean; data: ConteudoEvento }>(
      `/admin/conteudos/eventos/${id}/frequencia/abrir`
    ),
  fecharFrequencia: (id: string) =>
    api.post<{ success: boolean; data: ConteudoEvento }>(
      `/admin/conteudos/eventos/${id}/frequencia/fechar`
    ),
  listPrecadastros: () =>
    api.get<{ success: boolean; data: ConteudoPrecadastro[] }>('/admin/conteudos/precadastros'),
  aceitarPrecadastros: (ids: string[]) =>
    api.post<{
      success: boolean;
      data: {
        aceitos: number;
        total: number;
        results: Array<{
          id: string;
          nome: string;
          email: string;
          ok: boolean;
          message: string;
          camposFaltantes?: string[];
          cadastroUrl?: string;
        }>;
      };
    }>('/admin/conteudos/precadastros/aceitar', { ids }),
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
  confirmarPresenca: (id: string) =>
    api.post<{ success: boolean; data: { presenteEm: string; jaRegistrado: boolean } }>(
      `/medico/conteudos/${id}/presenca`
    ),
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
      cpf: string;
      bio?: string;
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
      perfil?: 'MEDICO' | 'ESTUDANTE';
      nome: string;
      email: string;
      telefone: string;
      cpf: string;
      crm?: string;
      especialidade?: string;
      cidade?: string;
      faculdade?: string;
      semestre?: string;
      participaLiga?: boolean;
      ligaNome?: string;
      interesseCorpoClinico?: boolean;
      consentimentoLgpd: boolean;
    }
  ) => api.post(`/conteudos/public/inscricao/${token}`, payload),
  capaUrl: (token: string) => {
    const base = api.defaults.baseURL || '/api';
    return `${base}/conteudos/public/inscricao/${token}/capa`;
  },
  getFrequencia: (token: string) =>
    api.get<{
      success: boolean;
      data: {
        evento: {
          id: string;
          titulo: string;
          iniciaEm: string;
          status: ConteudoEventoStatus;
          frequenciaAberta: boolean;
        };
      };
    }>(`/conteudos/public/frequencia/${token}`),
  submitFrequencia: (token: string, email: string) =>
    api.post<{
      success: boolean;
      data: { presenteEm: string; jaRegistrado: boolean };
      message?: string;
    }>(`/conteudos/public/frequencia/${token}`, { email }),
  getCadastroCorpo: (token: string) =>
    api.get<{
      success: boolean;
      data: {
        nome: string;
        email: string;
        telefone?: string | null;
        cpf?: string | null;
        crm?: string | null;
        especialidade?: string | null;
        perfil?: 'MEDICO' | 'ESTUDANTE';
        cidade?: string | null;
        camposFaltantes: string[];
        evento: { id: string; titulo: string; iniciaEm: string };
      };
    }>(`/conteudos/public/cadastro-corpo/${token}`),
  submitCadastroCorpo: (
    token: string,
    payload: {
      nomeCompleto?: string;
      email?: string;
      telefone?: string;
      cpf?: string;
      password: string;
      confirmPassword: string;
      profissao: string;
      crm?: string;
      especialidades?: string[];
      aceitouTermos: boolean;
    }
  ) =>
    api.post<{
      success: boolean;
      data: { medico: { id: string; nomeCompleto: string; email: string | null }; message: string };
      message?: string;
    }>(`/conteudos/public/cadastro-corpo/${token}`, payload),
};
