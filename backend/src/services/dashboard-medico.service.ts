import { getPerfilService } from './medico.service';
import { listMeusDocumentos } from './documentosenviados.service';
import { getMeuDiaPontoService, listMinhasEscalasService, listProximosPlantoesService } from './ponto.service';

export async function getDashboardMedicoService(tenantId: string, medicoId: string) {
  const [perfil, meuDia, escalas, proximosPlantoes, documentosEnviados] = await Promise.all([
    getPerfilService(medicoId, tenantId),
    getMeuDiaPontoService(tenantId, medicoId),
    listMinhasEscalasService(tenantId, medicoId),
    listProximosPlantoesService(tenantId, medicoId, 2),
    listMeusDocumentos(medicoId, tenantId),
  ]);

  return {
    perfil,
    meuDia,
    escalas,
    proximosPlantoes,
    documentosEnviados,
  };
}

