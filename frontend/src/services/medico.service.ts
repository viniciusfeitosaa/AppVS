import api from './api';
import { DocumentoPerfilField } from '../constants/documentosPerfil';

export interface MedicoPerfil {
  id: string;
  tenantId: string;
  nomeCompleto: string;
  profissao: string;
  crm: string | null;
  email: string | null;
  especialidades: string[];
  vinculo: string | null;
  telefone: string | null;
  estadoCivil: string | null;
  enderecoResidencial: string | null;
  dadosBancarios: string | null;
  chavePix: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  documentos: Array<{
    id: string;
    tipo: string;
    nomeArquivo: string;
    caminhoArquivo: string;
    mimeType: string;
    tamanhoBytes: number;
    updatedAt: string;
    url: string;
  }>;
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

  updatePerfil: async (payload: {
    especialidades?: string[];
    telefone?: string;
    estadoCivil?: string;
    enderecoResidencial?: string;
    dadosBancarios?: string;
    chavePix?: string;
    documentos?: Partial<Record<DocumentoPerfilField, File>>;
  }): Promise<PerfilResponse> => {
    const formData = new FormData();
    if (payload.especialidades?.length)
      formData.append('especialidades', JSON.stringify(payload.especialidades));
    if (payload.telefone) formData.append('telefone', payload.telefone);
    if (payload.estadoCivil) formData.append('estadoCivil', payload.estadoCivil);
    if (payload.enderecoResidencial) formData.append('enderecoResidencial', payload.enderecoResidencial);
    if (payload.dadosBancarios) formData.append('dadosBancarios', payload.dadosBancarios);
    if (payload.chavePix) formData.append('chavePix', payload.chavePix);
    if (payload.documentos) {
      Object.entries(payload.documentos).forEach(([field, file]) => {
        if (file) formData.append(field, file);
      });
    }
    const response = await api.put<PerfilResponse>('/medico/perfil', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  listDocumentosEnviados: async (): Promise<{ success: boolean; data: DocumentoEnviadoItem[] }> => {
    const response = await api.get<{ success: boolean; data: DocumentoEnviadoItem[] }>('/medico/documentos-enviados');
    return response.data;
  },

  openDocumentoEnviado: async (id: string): Promise<void> => {
    const response = await api.get(`/medico/documentos-enviados/${id}/download`, {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};

export interface DocumentoEnviadoItem {
  id: string;
  titulo: string | null;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  createdAt: string;
}
