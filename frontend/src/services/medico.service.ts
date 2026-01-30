import api from './api';

export interface MedicoPerfil {
  id: string;
  nomeCompleto: string;
  crm: string;
  email: string | null;
  especialidade: string | null;
  vinculo: string | null;
  telefone: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PerfilResponse {
  success: boolean;
  data: MedicoPerfil;
}

export const medicoService = {
  getPerfil: async (): Promise<PerfilResponse> => {
    const response = await api.get<PerfilResponse>('/medico/perfil');
    return response.data;
  },
};
