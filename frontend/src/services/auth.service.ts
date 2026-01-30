import api from './api';

export interface LoginCredentials {
  cpf: string;
  crm: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    medico: {
      id: string;
      nomeCompleto: string;
      crm: string;
      email: string | null;
      especialidade: string | null;
      vinculo?: string | null;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
