import { prisma } from '../config/database';

export const TIPO_NOTIFICACAO = {
  EQUIPE_VINCULO: 'EQUIPE_VINCULO',
  SUBGRUPO_VINCULO: 'SUBGRUPO_VINCULO',
  ESCALA_NOVA: 'ESCALA_NOVA',
  ESCALA_EQUIPE_VINCULO: 'ESCALA_EQUIPE_VINCULO',
  TROCA_PLANTAO_SOLICITADA: 'TROCA_PLANTAO_SOLICITADA',
  BOAS_VINDAS: 'BOAS_VINDAS',
} as const;

/** Após marcada como lida, a notificação é removida do banco após este período (menos linhas, consultas mais leves). */
export const RETENCAO_MS_NOTIFICACAO_LIDA = 24 * 60 * 60 * 1000;

async function removerNotificacoesLidasExpiradas(tenantId: string, medicoId: string) {
  const limite = new Date(Date.now() - RETENCAO_MS_NOTIFICACAO_LIDA);
  await prisma.notificacaoMedico.deleteMany({
    where: {
      tenantId,
      medicoId,
      lidaEm: { not: null, lt: limite },
    },
  });
}

export async function notificarBoasVindasMedico(tenantId: string, medicoId: string, nomeCompleto: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nome: true },
  });
  const marca = tenant?.nome?.trim() || 'Viva Saúde';
  const primeiro = nomeCompleto.trim().split(/\s+/)[0] || 'Profissional';

  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.BOAS_VINDAS,
      titulo: `Bem-vindo à ${marca}`,
      corpo: `Olá, ${primeiro}! Sua conta está ativa. Use o painel para ponto eletrônico, documentos e informações da sua escala. Estamos felizes em tê-lo(a) na equipe.`,
      metadata: { origem: 'cadastro' as const },
    },
  });
}

export async function notificarMedicoVinculoEquipe(
  tenantId: string,
  medicoId: string,
  equipeNome: string,
  equipeId: string
) {
  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.EQUIPE_VINCULO,
      titulo: 'Você entrou em uma equipe',
      corpo: `Você foi adicionado à equipe "${equipeNome}".`,
      metadata: { equipeId, equipeNome },
    },
  });
}

export async function notificarMedicoVinculoSubgrupo(
  tenantId: string,
  medicoId: string,
  subgrupoNome: string,
  subgrupoId: string
) {
  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.SUBGRUPO_VINCULO,
      titulo: 'Novo vínculo de subgrupo',
      corpo: `Você foi vinculado ao subgrupo "${subgrupoNome}".`,
      metadata: { subgrupoId, subgrupoNome },
    },
  });
}

export async function notificarMedicosNovaEscala(
  tenantId: string,
  contratoAtivoId: string,
  escala: { id: string; nome: string },
  contratoNome: string
) {
  const vinculos = await prisma.contratoEquipe.findMany({
    where: { tenantId, contratoAtivoId },
    select: { equipeId: true },
  });
  const equipeIds = vinculos.map((v) => v.equipeId);
  if (equipeIds.length === 0) return;

  const membros = await prisma.equipeMedico.findMany({
    where: { tenantId, equipeId: { in: equipeIds } },
    select: { medicoId: true },
  });
  const medicoIds = [...new Set(membros.map((m) => m.medicoId))];
  if (medicoIds.length === 0) return;

  const titulo = 'Nova escala disponível';
  const corpo = `A escala "${escala.nome}" foi cadastrada no contrato "${contratoNome}". Confira em Escalas quando precisar.`;

  await prisma.notificacaoMedico.createMany({
    data: medicoIds.map((medicoId) => ({
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.ESCALA_NOVA,
      titulo,
      corpo,
      metadata: { escalaId: escala.id, contratoAtivoId, escalaNome: escala.nome },
    })),
  });
}

export async function notificarMedicosEquipeNaEscala(
  tenantId: string,
  escalaId: string,
  escalaNome: string,
  equipeId: string,
  equipeNome: string
) {
  const membros = await prisma.equipeMedico.findMany({
    where: { tenantId, equipeId },
    select: { medicoId: true },
  });
  const medicoIds = [...new Set(membros.map((m) => m.medicoId))];
  if (medicoIds.length === 0) return;

  const titulo = 'Sua equipe na escala';
  const corpo = `A equipe "${equipeNome}" passou a integrar a escala "${escalaNome}".`;

  await prisma.notificacaoMedico.createMany({
    data: medicoIds.map((medicoId) => ({
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.ESCALA_EQUIPE_VINCULO,
      titulo,
      corpo,
      metadata: { escalaId, equipeId, escalaNome, equipeNome },
    })),
  });
}

/** Notifica colega e solicitante ao pedir troca de plantão (sem alterar a escala no banco). */
export async function notificarTrocaPlantaoSolicitada(
  tenantId: string,
  input: {
    medicoSolicitanteId: string;
    medicoDestinoId: string;
    solicitanteNome: string;
    destinoNome: string;
    plantaoId: string;
    escalaId: string;
    escalaNome: string;
    dataPlantaoIso: string;
    gradeLabel: string;
  }
) {
  const {
    medicoSolicitanteId,
    medicoDestinoId,
    solicitanteNome,
    destinoNome,
    plantaoId,
    escalaId,
    escalaNome,
    dataPlantaoIso,
    gradeLabel,
  } = input;

  const dataFmt = new Date(dataPlantaoIso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId: medicoDestinoId,
      tipo: TIPO_NOTIFICACAO.TROCA_PLANTAO_SOLICITADA,
      titulo: 'Pedido de troca de plantão',
      corpo: `${solicitanteNome} solicitou trocar o plantão do dia ${dataFmt} (${gradeLabel}) na escala "${escalaNome}". Confira com a pessoa ou a coordenação para alinhar a troca.`,
      metadata: {
        plantaoId,
        escalaId,
        medicoSolicitanteId,
        medicoDestinoId,
        papel: 'destino',
      },
    },
  });

  await prisma.notificacaoMedico.create({
    data: {
      tenantId,
      medicoId: medicoSolicitanteId,
      tipo: TIPO_NOTIFICACAO.TROCA_PLANTAO_SOLICITADA,
      titulo: 'Solicitação de troca enviada',
      corpo: `Seu pedido de troca de plantão com ${destinoNome} foi registrado (${escalaNome}, ${dataFmt}, ${gradeLabel}). O profissional foi notificado.`,
      metadata: {
        plantaoId,
        escalaId,
        medicoSolicitanteId,
        medicoDestinoId,
        papel: 'solicitante',
      },
    },
  });
}

export async function listNotificacoesMedicoService(tenantId: string, medicoId: string, limit = 40) {
  await removerNotificacoesLidasExpiradas(tenantId, medicoId);

  return prisma.notificacaoMedico.findMany({
    where: { tenantId, medicoId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      tipo: true,
      titulo: true,
      corpo: true,
      metadata: true,
      lidaEm: true,
      createdAt: true,
    },
  });
}

export async function marcarNotificacaoLidaService(tenantId: string, medicoId: string, notificacaoId: string) {
  await removerNotificacoesLidasExpiradas(tenantId, medicoId);

  const row = await prisma.notificacaoMedico.findFirst({
    where: { id: notificacaoId, tenantId, medicoId },
    select: { id: true },
  });
  if (!row) {
    throw { statusCode: 404, message: 'Notificação não encontrada' };
  }
  await prisma.notificacaoMedico.update({
    where: { id: notificacaoId },
    data: { lidaEm: new Date() },
  });
}

export async function marcarTodasNotificacoesLidasService(tenantId: string, medicoId: string) {
  await removerNotificacoesLidasExpiradas(tenantId, medicoId);

  await prisma.notificacaoMedico.updateMany({
    where: { tenantId, medicoId, lidaEm: null },
    data: { lidaEm: new Date() },
  });
}
