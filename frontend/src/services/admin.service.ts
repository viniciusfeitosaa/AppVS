import api from './api';

export interface AdminMedico {
  id: string;
  nomeCompleto: string;
  cpf: string;
  crm: string;
  email: string | null;
  especialidade: string | null;
  vinculo: string | null;
  telefone: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
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

export const adminService = {
  listMedicos: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get<ListMedicosResponse>('/admin/medicos', {
      params,
    });
    return response.data;
  },
};
