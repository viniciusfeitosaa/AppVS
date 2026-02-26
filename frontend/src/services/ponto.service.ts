import api from './api';

interface CheckInPayload {
  escalaId?: string;
  observacao?: string;
  latitude?: number;
  longitude?: number;
}

interface CheckOutPayload {
  observacao?: string;
  latitude?: number;
  longitude?: number;
}

export const pontoService = {
  checkIn: async (payload: CheckInPayload) => {
    const response = await api.post('/ponto/checkin', payload);
    return response.data;
  },

  checkOut: async (payload?: CheckOutPayload) => {
    const response = await api.post('/ponto/checkout', payload || {});
    return response.data;
  },

  getMeuDia: async () => {
    const response = await api.get('/ponto/meu-dia');
    return response.data;
  },

  listMinhasEscalas: async () => {
    const response = await api.get('/ponto/minhas-escalas');
    return response.data;
  },
};
