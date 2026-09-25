import api from '../../../services/api';
import type {
  CreateEmailMensagemPayload,
  EmailMensagem,
  EmailPainelResumo,
  EnviarAgoraEmailPayload,
  SmtpTesteResultado,
} from '../types';

export const emailModuleService = {
  getResumo: async (): Promise<{ success: boolean; data: EmailPainelResumo }> => {
    const response = await api.get('/email/resumo');
    return response.data;
  },

  testarSmtp: async (): Promise<{ success: boolean; data: SmtpTesteResultado }> => {
    const response = await api.post('/email/smtp/testar');
    return response.data;
  },

  listMensagens: async (params?: {
    limit?: number;
    offset?: number;
    q?: string;
  }): Promise<{
    success: boolean;
    data: EmailMensagem[];
    total?: number;
    limit?: number;
    offset?: number;
  }> => {
    const response = await api.get('/email/mensagens', {
      params: {
        limit: params?.limit ?? 100,
        offset: params?.offset ?? 0,
        q: params?.q || undefined,
      },
    });
    return response.data;
  },

  createMensagem: async (
    payload: CreateEmailMensagemPayload
  ): Promise<{ success: boolean; data: EmailMensagem }> => {
    const response = await api.post('/email/mensagens', payload);
    return response.data;
  },

  enviarAgora: async (
    payload: EnviarAgoraEmailPayload
  ): Promise<{
    success: boolean;
    data: EmailMensagem & { anexosEnviados?: { filename: string; bytes: number }[] };
  }> => {
    const response = await api.post('/email/mensagens/enviar-agora', payload);
    return response.data;
  },

  enviarMensagem: async (id: string): Promise<{ success: boolean; data: EmailMensagem }> => {
    const response = await api.post(`/email/mensagens/${id}/enviar`);
    return response.data;
  },

  deleteMensagem: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/email/mensagens/${id}`);
    return response.data;
  },
};
