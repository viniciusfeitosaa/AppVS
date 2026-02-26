export type ModuloSistema =
  | 'DASHBOARD'
  | 'MEDICOS'
  | 'CONTRATOS_ATIVOS'
  | 'ESCALAS'
  | 'VALORES_PLANTAO'
  | 'CONVITES'
  | 'RELATORIOS'
  | 'PONTO_ELETRONICO'
  | 'ATENDIMENTOS'
  | 'CONFIGURACOES'
  | 'PERFIL';

export const MODULO_LABEL: Record<ModuloSistema, string> = {
  DASHBOARD: 'Dashboard',
  MEDICOS: 'Médicos',
  CONTRATOS_ATIVOS: 'Contratos Ativos',
  ESCALAS: 'Escalas',
  VALORES_PLANTAO: 'Valores Hora/Plantão',
  CONVITES: 'Convites',
  RELATORIOS: 'Relatórios',
  PONTO_ELETRONICO: 'Ponto Eletrônico',
  ATENDIMENTOS: 'Atendimentos',
  CONFIGURACOES: 'Configurações',
  PERFIL: 'Minha Conta',
};
