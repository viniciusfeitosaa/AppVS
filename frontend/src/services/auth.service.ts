import api from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    medico?: {
      id: string;
      role: 'MASTER' | 'MEDICO';
      tenantId: string;
      nomeCompleto: string;
      crm?: string;
      email: string | null;
      especialidade?: string | null;
      vinculo?: string | null;
    };
    user?: {
      id: string;
      role: 'MASTER' | 'MEDICO';
      tenantId: string;
      nomeCompleto: string;
      crm?: string;
      email: string | null;
      especialidade?: string | null;
      vinculo?: string | null;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export interface AcceptInvitePayload {
  token: string;
  password: string;
  confirmPassword: string;
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  acceptInvite: async (payload: AcceptInvitePayload): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/accept-invite', payload);
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
