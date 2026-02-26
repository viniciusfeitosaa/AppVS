import api from './api';
import { ModuloSistema } from '../constants/modulos';

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

export interface RegisterPayload {
  nomeCompleto: string;
  email: string;
  cpf: string;
  crm: string;
  especialidade: string;
  telefone: string;
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

  register: async (payload: RegisterPayload) => {
    const response = await api.post('/auth/register', payload);
    return response.data;
  },

  getModulosAcesso: async (): Promise<{
    success: boolean;
    data: {
      perfil: 'MASTER' | 'MEDICO';
      items: Array<{ perfil: 'MASTER' | 'MEDICO'; modulo: ModuloSistema; permitido: boolean }>;
      map: Record<ModuloSistema, boolean>;
    };
  }> => {
    const response = await api.get('/auth/modulos-acesso');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
