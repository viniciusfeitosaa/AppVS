import api from './api';

interface CheckInPayload {
  escalaId?: string;
  observacao?: string;
  latitude?: number;
  longitude?: number;
  foto: File;
}

interface CheckInSemFotoPayload {
  escalaId?: string;
  observacao?: string;
  latitude?: number;
  longitude?: number;
  motivoSemFoto: string;
}

interface CheckOutPayload {
  observacao?: string;
  latitude?: number;
  longitude?: number;
}

export const pontoService = {
  checkIn: async (payload: CheckInPayload) => {
    const formData = new FormData();
    if (payload.escalaId) formData.append('escalaId', payload.escalaId);
    if (payload.observacao) formData.append('observacao', payload.observacao);
    if (payload.latitude != null) formData.append('latitude', String(payload.latitude));
    if (payload.longitude != null) formData.append('longitude', String(payload.longitude));
    formData.append('foto', payload.foto);
    const response = await api.post('/ponto/checkin', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** Check-in quando a câmera não pode ser usada (motivo obrigatório no servidor). */
  checkInSemFoto: async (payload: CheckInSemFotoPayload) => {
    const response = await api.post('/ponto/checkin-sem-foto', payload);
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

  listEquipeColegas: async (escalaId: string) => {
    const response = await api.get('/ponto/equipe-colegas', { params: { escalaId } });
    return response.data;
  },

  listProximosPlantoes: async () => {
    const response = await api.get('/ponto/proximos-plantoes');
    return response.data;
  },

  canCheckIn: async (escalaId: string) => {
    const response = await api.get('/ponto/can-checkin', { params: { escalaId } });
    return response.data;
  },

  solicitarTrocaPlantao: async (payload: { plantaoId: string; medicoDestinoId: string }) => {
    const response = await api.post('/ponto/solicitar-troca-plantao', payload);
    return response.data as { success: boolean; message?: string; data?: unknown };
  },
};
