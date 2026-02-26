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

export interface ConfigPontoEletronico {
  id: string;
  tenantId: string;
  contratoAtivoId: string;
  subgrupoId: string;
  equipeId: string | null;
  horasPrevistasMes: number | null;
  valorHora: string | null;
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

export interface Subgrupo {
  id: string;
  tenantId: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { subgrupoMedicos: number; escalaSubgrupos: number };
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

  createEscalaPlantao: async (
    escalaId: string,
    payload: { data: string; gradeId: string; medicoId: string; valorHora?: number | null }
  ) => {
    const response = await api.post(`/admin/escalas/${escalaId}/plantoes`, payload);
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
    };
  }> => {
    const response = await api.get('/admin/valores-plantao/opcoes');
    return response.data;
  },

  getValoresPlantao: async (
    contratoId: string,
    subgrupoId: string
  ): Promise<{ success: boolean; data: ValorPlantaoConfig[] }> => {
    const response = await api.get('/admin/valores-plantao', {
      params: { contratoId, subgrupoId },
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

  getConfigPontoOpcoes: async (): Promise<{
    success: boolean;
    data: {
      contratos: { id: string; nome: string }[];
      subgrupos: { id: string; nome: string; ativo: boolean }[];
      equipes: { id: string; nome: string; ativo: boolean; subgrupoId: string | null }[];
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
};
