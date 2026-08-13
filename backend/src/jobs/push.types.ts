export type PushPlatform = 'ios' | 'android';

export type PushJobPayload = {
  tenantId: string;
  medicoId: string;
  notificacaoId?: string;
  tipo: string;
  titulo: string;
  corpo: string;
  /** Rota frontend, ex.: /dashboard */
  path: string;
};
