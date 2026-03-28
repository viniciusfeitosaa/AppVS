import api from './api';
import { ModuloSistema } from '../constants/modulos';

export interface AdminMedico {
  id: string;
  nomeCompleto: string;
  cpf: string;
  profissao: string;
  crm: string | null;
  email: string | null;
  especialidades: string[];
  vinculo: string | null;
  telefone: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContratoAtivo {
  id: string;
  nome: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string | null;
  ativo: boolean;
  usaEscala: boolean;
  usaPonto: boolean;
  permiteTrocaPlantao?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Escala {
  id: string;
  tenantId: string;
  contratoAtivoId: string;
  nome: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  contratoAtivo?: {
    id: string;
    nome: string;
    ativo: boolean;
  };
  _count?: {
    alocacoes: number;
  };
}

export interface EscalaMedicoAlocacao {
  id: string;
  tenantId: string;
  escalaId: string;
  medicoId: string;
  cargo: string | null;
  valorHora: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  medico: {
    id: string;
    nomeCompleto: string;
    crm: string | null;
    email: string | null;
    especialidades: string[];
    vinculo: string | null;
    ativo: boolean;
  };
}

export interface ValorPlantaoConfig {
  id: string;
  tenantId: string;
  contratoAtivoId?: string;
  subgrupoId?: string;
  gradeId: string;
  valorHora: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TipoPlantaoConfig {
  id: string;
  tenantId: string;
  contratoAtivoId: string;
  nome: string;
  horaInicio: string;
  horaFim: string;
  cruzaMeiaNoite: boolean;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigPontoEletronico {
  id: string;
  tenantId: string;
  contratoAtivoId: string;
  subgrupoId: string;
  equipeId: string | null;
  horasPrevistasMes: number | null;
  valorHora: string | null;
  valorHoraCobranca: string | null;
  horarioEntrada: string | null;
  horarioSaida: string | null;
  toleranciaMinutos: number | null;
  latitude: string | null;
  longitude: string | null;
  raioMetros: number | null;
  enderecoPonto: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EscalaPlantao {
  id: string;
  escalaId: string;
  data: string;
  gradeId: string;
  medicoId: string;
  valorHora: string | null;
  medico: {
    id: string;
    nomeCompleto: string;
    crm: string;
    email: string | null;
    telefone: string | null;
  };
}

export interface AdicionalPlantaoData {
  id: string;
  tenantId: string;
  contratoAtivoId: string;
  data: string;
  gradeId: string;
  percentual: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subgrupo {
  id: string;
  tenantId: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { subgrupoMedicos: number; escalaSubgrupos: number; equipes?: number };
  contratoSubgrupos?: { contratoAtivo: { id: string; nome: string; usaEscala: boolean; usaPonto: boolean } }[];
}

export interface Equipe {
  id: string;
  tenantId: string;
  subgrupoId: string | null;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { equipeMedicos: number; escalaEquipes: number };
  subgrupo?: { id: string; nome: string } | null;
}

export interface DocumentoEnviado {
  id: string;
  tenantId: string;
  medicoId: string;
  titulo: string | null;
  nomeArquivo: string;
  caminhoArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  enviadoPorId: string | null;
  createdAt: string;
  medico?: {
    id: string;
    nomeCompleto: string;
    crm: string | null;
    email: string | null;
  };
}

interface ListMedicosResponse {
  success: boolean;
  data: AdminMedico[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ListContratosAtivosResponse {
  success: boolean;
  data: ContratoAtivo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ListEscalasResponse {
  success: boolean;
  data: Escala[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ContratoAtivoPayload {
  nome: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  ativo?: boolean;
  usaEscala?: boolean;
  usaPonto?: boolean;
  permiteTrocaPlantao?: boolean;
}

interface EscalaPayload {
  contratoAtivoId: string;
  nome: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim: string;
  ativo?: boolean;
}

interface AlocarMedicoEscalaPayload {
  medicoId: string;
  cargo?: string | null;
  valorHora?: number | null;
}

export interface AcessoModuloItem {
  perfil: 'MASTER' | 'MEDICO';
  modulo: ModuloSistema;
  permitido: boolean;
}

export const adminService = {
  listMedicos: async (params?: { page?: number; limit?: number; search?: string; ativo?: boolean }) => {
    const response = await api.get<ListMedicosResponse>('/admin/medicos', {
      params,
    });
    return response.data;
  },

  listContratosAtivos: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get<ListContratosAtivosResponse>('/admin/contratos-ativos', { params });
    return response.data;
  },

  createContratoAtivo: async (payload: ContratoAtivoPayload) => {
    const response = await api.post('/admin/contratos-ativos', payload);
    return response.data;
  },

  updateContratoAtivo: async (id: string, payload: ContratoAtivoPayload) => {
    const response = await api.put(`/admin/contratos-ativos/${id}`, payload);
    return response.data;
  },

  deleteContratoAtivo: async (id: string) => {
    const response = await api.delete(`/admin/contratos-ativos/${id}`);
    return response.data;
  },

  listContratoSubgrupos: async (contratoId: string) => {
    const response = await api.get<{ success: boolean; data: { id: string; subgrupo: { id: string; nome: string; ativo: boolean } }[] }>(
      `/admin/contratos-ativos/${contratoId}/subgrupos`
    );
    return response.data;
  },

  addContratoSubgrupo: async (contratoId: string, subgrupoId: string) => {
    const response = await api.post(`/admin/contratos-ativos/${contratoId}/subgrupos`, { subgrupoId });
    return response.data;
  },

  removeContratoSubgrupo: async (contratoId: string, subgrupoId: string) => {
    const response = await api.delete(`/admin/contratos-ativos/${contratoId}/subgrupos/${subgrupoId}`);
    return response.data;
  },

  listContratoEquipes: async (contratoId: string) => {
    const response = await api.get<{
      success: boolean;
      data: { id: string; equipe: { id: string; nome: string; ativo: boolean; subgrupo?: { id: string; nome: string } } }[];
    }>(`/admin/contratos-ativos/${contratoId}/equipes`);
    return response.data;
  },

  addContratoEquipe: async (contratoId: string, equipeId: string) => {
    const response = await api.post(`/admin/contratos-ativos/${contratoId}/equipes`, { equipeId });
    return response.data;
  },

  removeContratoEquipe: async (contratoId: string, equipeId: string) => {
    const response = await api.delete(`/admin/contratos-ativos/${contratoId}/equipes/${equipeId}`);
    return response.data;
  },

  listEscalas: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get<ListEscalasResponse>('/admin/escalas', { params });
    return response.data;
  },

  createEscala: async (payload: EscalaPayload) => {
    const response = await api.post('/admin/escalas', payload);
    return response.data;
  },

  updateEscala: async (id: string, payload: Partial<EscalaPayload>) => {
    const response = await api.put(`/admin/escalas/${id}`, payload);
    return response.data;
  },

  deleteEscala: async (id: string) => {
    const response = await api.delete(`/admin/escalas/${id}`);
    return response.data;
  },

  listEscalaMedicos: async (escalaId: string) => {
    const response = await api.get<{ success: boolean; data: EscalaMedicoAlocacao[] }>(
      `/admin/escalas/${escalaId}/medicos`
    );
    return response.data;
  },

  alocarMedicoEscala: async (escalaId: string, payload: AlocarMedicoEscalaPayload) => {
    const response = await api.post(`/admin/escalas/${escalaId}/medicos`, payload);
    return response.data;
  },

  removerMedicoEscala: async (escalaId: string, medicoId: string) => {
    const response = await api.delete(`/admin/escalas/${escalaId}/medicos/${medicoId}`);
    return response.data;
  },

  listEscalaPlantoes: async (
    escalaId: string,
    params?: { dataInicio?: string; dataFim?: string }
  ): Promise<{ success: boolean; data: EscalaPlantao[] }> => {
    const response = await api.get(`/admin/escalas/${escalaId}/plantoes`, { params });
    return response.data;
  },

  listEquipePlantoes: async (
    equipeId: string,
    params?: { dataInicio?: string; dataFim?: string }
  ): Promise<{ success: boolean; data: EscalaPlantao[] }> => {
    const response = await api.get(`/admin/equipes/${equipeId}/plantoes`, { params });
    return response.data;
  },

  listEscalasByEquipe: async (equipeId: string): Promise<{ success: boolean; data: Escala[] }> => {
    const response = await api.get(`/admin/equipes/${equipeId}/escalas`);
    return response.data;
  },

  createEscalaPlantao: async (
    escalaId: string,
    payload: { data: string; gradeId: string; medicoId: string; valorHora?: number | null }
  ) => {
    const response = await api.post(`/admin/escalas/${escalaId}/plantoes`, payload);
    return response.data;
  },

  listAdicionaisPlantao: async (params: {
    contratoAtivoId: string;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<{ success: boolean; data: AdicionalPlantaoData[] }> => {
    const response = await api.get('/admin/adicionais-plantao', { params });
    return response.data;
  },

  upsertAdicionalPlantao: async (payload: {
    contratoAtivoId: string;
    data: string;
    gradeId: string;
    percentual: number;
  }): Promise<{ success: boolean; data: AdicionalPlantaoData }> => {
    const response = await api.put('/admin/adicionais-plantao', payload);
    return response.data;
  },

  removerAdicionalPlantao: async (params: {
    contratoAtivoId: string;
    data: string;
    gradeId: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const response = await api.delete('/admin/adicionais-plantao', { params });
    return response.data;
  },

  removerEscalaPlantao: async (escalaId: string, plantaoId: string) => {
    const response = await api.delete(`/admin/escalas/${escalaId}/plantoes/${plantaoId}`);
    return response.data;
  },

  getValoresPlantaoOpcoes: async (): Promise<{
    success: boolean;
    data: {
      contratos: { id: string; nome: string }[];
      subgrupos: { id: string; nome: string; ativo: boolean }[];
      contratoSubgrupos: { contratoAtivoId: string; subgrupoId: string }[];
    };
  }> => {
    const response = await api.get('/admin/valores-plantao/opcoes');
    return response.data;
  },

  getValoresPlantao: async (
    contratoId: string,
    subgrupoId?: string
  ): Promise<{ success: boolean; data: ValorPlantaoConfig[] }> => {
    const response = await api.get('/admin/valores-plantao', {
      params: subgrupoId ? { contratoId, subgrupoId } : { contratoId },
    });
    return response.data;
  },

  setValorPlantao: async (
    contratoId: string,
    subgrupoId: string,
    gradeId: string,
    valorHora: number | null
  ) => {
    const response = await api.put('/admin/valores-plantao', {
      contratoId,
      subgrupoId,
      gradeId,
      valorHora,
    });
    return response.data;
  },

  listTiposPlantao: async (
    contratoAtivoId: string
  ): Promise<{ success: boolean; data: TipoPlantaoConfig[] }> => {
    const response = await api.get('/admin/tipos-plantao', {
      params: { contratoAtivoId },
    });
    return response.data;
  },

  createTipoPlantao: async (payload: {
    contratoAtivoId: string;
    nome: string;
    horaInicio: string;
    horaFim: string;
    cruzaMeiaNoite?: boolean;
  }) => {
    const response = await api.post('/admin/tipos-plantao', payload);
    return response.data;
  },

  updateTipoPlantao: async (
    id: string,
    payload: { nome?: string; horaInicio?: string; horaFim?: string; cruzaMeiaNoite?: boolean }
  ) => {
    const response = await api.put(`/admin/tipos-plantao/${id}`, payload);
    return response.data;
  },

  deleteTipoPlantao: async (id: string) => {
    const response = await api.delete(`/admin/tipos-plantao/${id}`);
    return response.data;
  },

  getConfigPontoOpcoes: async (): Promise<{
    success: boolean;
    data: {
      contratos: { id: string; nome: string }[];
      subgrupos: { id: string; nome: string; ativo: boolean }[];
      equipes: { id: string; nome: string; ativo: boolean; subgrupoId: string | null }[];
      contratoSubgrupos: { contratoAtivoId: string; subgrupoId: string }[];
    };
  }> => {
    const response = await api.get('/admin/config-ponto/opcoes');
    return response.data;
  },

  getConfigPonto: async (
    contratoId: string,
    subgrupoId: string,
    equipeId: string | null
  ): Promise<{ success: boolean; data: ConfigPontoEletronico | null }> => {
    const response = await api.get('/admin/config-ponto', {
      params: { contratoId, subgrupoId, ...(equipeId ? { equipeId } : {}) },
    });
    return response.data;
  },

  setConfigPonto: async (
    contratoId: string,
    subgrupoId: string,
    equipeId: string | null,
    payload: {
      horasPrevistasMes: number | null;
      valorHora: number | null;
      valorHoraCobranca: number | null;
      horarioEntrada?: string | null;
      horarioSaida?: string | null;
      toleranciaMinutos?: number | null;
      latitude?: string | number | null;
      longitude?: string | number | null;
      raioMetros?: number | null;
      enderecoPonto?: string | null;
    }
  ) => {
    const response = await api.put('/admin/config-ponto', {
      contratoId,
      subgrupoId,
      ...(equipeId ? { equipeId } : {}),
      ...payload,
    });
    return response.data;
  },

  listRegistrosPonto: async (params?: {
    escalaId?: string;
    medicoId?: string;
    contratoAtivoId?: string;
    subgrupoId?: string;
    equipeId?: string;
    dataInicio?: string;
    dataFim?: string;
  }) => {
    const response = await api.get('/admin/registros-ponto', { params });
    return response.data;
  },

  openRegistroPontoFotoCheckin: async (registroId: string) => {
    const response = await api.get(`/admin/registros-ponto/${registroId}/foto-checkin`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'image/jpeg',
    });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    // libera depois (tempo para o navegador carregar o blob)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  getMatrizAcessosModulos: async (): Promise<{
    success: boolean;
    data: {
      master: AcessoModuloItem[];
      medico: AcessoModuloItem[];
    };
  }> => {
    const response = await api.get('/admin/acessos-modulos');
    return response.data;
  },

  salvarMatrizAcessosModulos: async (items: AcessoModuloItem[]) => {
    const response = await api.put('/admin/acessos-modulos', { items });
    return response.data;
  },

  listSubgrupos: async () => {
    const response = await api.get<{ success: boolean; data: Subgrupo[] }>('/admin/subgrupos');
    return response.data;
  },
  createSubgrupo: async (payload: { nome: string; descricao?: string | null; ativo?: boolean }) => {
    const response = await api.post('/admin/subgrupos', payload);
    return response.data;
  },
  updateSubgrupo: async (id: string, payload: { nome?: string; descricao?: string | null; ativo?: boolean }) => {
    const response = await api.put(`/admin/subgrupos/${id}`, payload);
    return response.data;
  },
  deleteSubgrupo: async (id: string) => {
    const response = await api.delete(`/admin/subgrupos/${id}`);
    return response.data;
  },
  listSubgrupoMedicos: async (id: string) => {
    const response = await api.get(`/admin/subgrupos/${id}/medicos`);
    return response.data;
  },
  addMedicoToSubgrupo: async (id: string, medicoId: string) => {
    const response = await api.post(`/admin/subgrupos/${id}/medicos`, { medicoId });
    return response.data;
  },
  removeMedicoFromSubgrupo: async (id: string, medicoId: string) => {
    const response = await api.delete(`/admin/subgrupos/${id}/medicos/${medicoId}`);
    return response.data;
  },

  listEquipes: async (params?: { subgrupoId?: string | null }) => {
    const response = await api.get<{ success: boolean; data: Equipe[] }>('/admin/equipes', { params });
    return response.data;
  },
  createEquipe: async (payload: { nome: string; descricao?: string | null; ativo?: boolean; subgrupoId?: string | null }) => {
    const response = await api.post('/admin/equipes', payload);
    return response.data;
  },
  updateEquipe: async (id: string, payload: { nome?: string; descricao?: string | null; ativo?: boolean; subgrupoId?: string | null }) => {
    const response = await api.put(`/admin/equipes/${id}`, payload);
    return response.data;
  },
  deleteEquipe: async (id: string) => {
    const response = await api.delete(`/admin/equipes/${id}`);
    return response.data;
  },
  listEquipeMedicos: async (id: string) => {
    const response = await api.get(`/admin/equipes/${id}/medicos`);
    return response.data;
  },
  addMedicoToEquipe: async (id: string, medicoId: string) => {
    const response = await api.post(`/admin/equipes/${id}/medicos`, { medicoId });
    return response.data;
  },
  removeMedicoFromEquipe: async (id: string, medicoId: string) => {
    const response = await api.delete(`/admin/equipes/${id}/medicos/${medicoId}`);
    return response.data;
  },

  listEscalaSubgrupos: async (escalaId: string) => {
    const response = await api.get(`/admin/escalas/${escalaId}/subgrupos`);
    return response.data;
  },
  addSubgrupoToEscala: async (escalaId: string, subgrupoId: string) => {
    const response = await api.post(`/admin/escalas/${escalaId}/subgrupos`, { subgrupoId });
    return response.data;
  },
  removeSubgrupoFromEscala: async (escalaId: string, subgrupoId: string) => {
    const response = await api.delete(`/admin/escalas/${escalaId}/subgrupos/${subgrupoId}`);
    return response.data;
  },
  listEscalaEquipes: async (escalaId: string) => {
    const response = await api.get(`/admin/escalas/${escalaId}/equipes`);
    return response.data;
  },
  addEquipeToEscala: async (escalaId: string, equipeId: string) => {
    const response = await api.post(`/admin/escalas/${escalaId}/equipes`, { equipeId });
    return response.data;
  },
  removeEquipeFromEscala: async (escalaId: string, equipeId: string) => {
    const response = await api.delete(`/admin/escalas/${escalaId}/equipes/${equipeId}`);
    return response.data;
  },

  listDocumentosEnviados: async (medicoId?: string) => {
    const response = await api.get<{ success: boolean; data: DocumentoEnviado[] }>('/admin/documentos-enviados', {
      params: medicoId ? { medicoId } : undefined,
    });
    return response.data;
  },
  uploadDocumentoEnviado: async (arquivo: File, medicoId: string, titulo?: string) => {
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('medicoId', medicoId);
    if (titulo != null && titulo.trim()) formData.append('titulo', titulo.trim());
    const response = await api.post<{ success: boolean; data: DocumentoEnviado; message?: string }>(
      '/admin/documentos-enviados',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },
  deleteDocumentoEnviado: async (id: string) => {
    const response = await api.delete(`/admin/documentos-enviados/${id}`);
    return response.data;
  },
};
