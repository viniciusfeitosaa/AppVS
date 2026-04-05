import { getPerfilResumoDashboardService } from './medico.service';
import { listMeusDocumentos } from './documentosenviados.service';
import { getPainelPontoEletronicoInicialService, listProximosPlantoesService } from './ponto.service';

export async function getDashboardMedicoService(tenantId: string, medicoId: string) {
  const [perfil, painel, proximosPlantoes, documentosEnviados] = await Promise.all([
    getPerfilResumoDashboardService(medicoId, tenantId),
    getPainelPontoEletronicoInicialService(tenantId, medicoId),
    listProximosPlantoesService(tenantId, medicoId, 2),
    listMeusDocumentos(medicoId, tenantId),
  ]);

  return {
    perfil,
    meuDia: painel.meuDia,
    escalas: painel.escalas,
    proximosPlantoes,
    documentosEnviados,
  };
}

