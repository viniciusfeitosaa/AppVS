import { OrigemRegistroPonto, type Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  fimPlantaoAsDate,
  inicioPlantaoAsDate,
  scheduleFromLegacyGradeId,
  scheduleFromTipoRow,
} from '../utils/plantao-horario';
import {
  batchResolveProducaoMedicoNasEscalas,
  resolveProducaoMedicoNaEscala,
} from '../utils/producao-subgrupo.util';
import { intervaloDiaCivil } from './justificativa-ausencia-ponto.dia';
import { resolverValorCheioPlantao } from './justificativa-ausencia-ponto.valor';
import { criarNotificacaoComPush, TIPO_NOTIFICACAO } from './notificacao-medico.service';

type DbClient = Prisma.TransactionClient | typeof prisma;

export type CriarJustificativaAusenciaPontoInput = {
  escalaPlantaoId: string;
  horarioAlegadoEntrada: Date;
  horarioAlegadoSaida: Date;
  motivo: string;
};

type PlantaoElegivelRow = {
  id: string;
  tenantId: string;
  escalaId: string;
  medicoId: string;
  data: Date;
  gradeId: string;
  escala: { contratoAtivoId: string | null };
};

function throwHttp(statusCode: number, message: string): never {
  throw { statusCode, message };
}

function dataStrPlantao(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Dia civil local alinhado à data de calendário do plantão (@db.Date → YYYY-MM-DD UTC). */
function intervaloDiaCivilPlantao(dataPlantao: Date): { gte: Date; lte: Date } {
  return intervaloDiaCivil(new Date(`${dataStrPlantao(dataPlantao)}T00:00:00`));
}

async function resolveScheduleForPlantao(
  tenantId: string,
  plantao: { data: Date; gradeId: string; escala: { contratoAtivoId: string | null } },
  tiposByContrato?: Map<string, Array<{ id: string; horaInicio: string; horaFim: string; cruzaMeiaNoite: boolean }>>
) {
  const g = String(plantao.gradeId || '');
  if (/^(mt|sn)$/i.test(g)) {
    return scheduleFromLegacyGradeId(g);
  }
  const cid = plantao.escala.contratoAtivoId;
  if (cid) {
    let tipos = tiposByContrato?.get(cid);
    if (!tipos) {
      tipos = await prisma.tipoPlantao.findMany({
        where: { tenantId, contratoAtivoId: cid },
        select: { id: true, horaInicio: true, horaFim: true, cruzaMeiaNoite: true },
      });
    }
    const tipo = tipos.find((t) => t.id === plantao.gradeId);
    if (tipo) return scheduleFromTipoRow(tipo);
  }
  return scheduleFromLegacyGradeId('mt');
}

function horarioOficialFromSchedule(
  plantao: { data: Date },
  schedule: ReturnType<typeof scheduleFromLegacyGradeId>
) {
  const dataStr = dataStrPlantao(plantao.data);
  return {
    horarioOficialInicio: inicioPlantaoAsDate(dataStr, schedule),
    horarioOficialFim: fimPlantaoAsDate(dataStr, schedule),
  };
}

async function temPontoFechadoNoDia(
  tenantId: string,
  medicoId: string,
  escalaId: string,
  dataPlantao: Date
): Promise<boolean> {
  const { gte, lte } = intervaloDiaCivilPlantao(dataPlantao);
  const fechado = await prisma.registroPonto.findFirst({
    where: {
      tenantId,
      medicoId,
      escalaId,
      checkOutAt: { not: null },
      checkInAt: { gte, lte },
    },
    select: { id: true },
  });
  return Boolean(fechado);
}

async function temJustificativaBloqueante(escalaPlantaoId: string): Promise<boolean> {
  const existing = await prisma.justificativaAusenciaPonto.findFirst({
    where: {
      escalaPlantaoId,
      status: { in: ['PENDENTE', 'ACEITA'] },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function assertPlantaoElegivelParaCriar(
  tenantId: string,
  medicoId: string,
  plantao: PlantaoElegivelRow
): Promise<void> {
  if (plantao.medicoId !== medicoId) {
    throwHttp(403, 'Este plantão não pertence ao médico autenticado');
  }

  const prod = await resolveProducaoMedicoNaEscala(tenantId, medicoId, plantao.escalaId);
  if (!prod.allowPonto || !prod.requireJanelaPlantao) {
    throwHttp(403, 'Justificativa de ausência não está disponível para este vínculo de escala');
  }

  if (await temPontoFechadoNoDia(tenantId, medicoId, plantao.escalaId, plantao.data)) {
    throwHttp(409, 'Já existe ponto fechado para esta escala no dia do plantão');
  }

  if (await temJustificativaBloqueante(plantao.id)) {
    throwHttp(409, 'Já existe justificativa pendente ou aceita para este plantão');
  }
}

/**
 * Plantões do médico elegíveis para pedir justificativa de ausência de ponto.
 */
export async function listPlantoesElegiveisJustificativa(tenantId: string, medicoId: string) {
  const plantoes = (await prisma.escalaPlantao.findMany({
    where: { tenantId, medicoId },
    select: {
      id: true,
      tenantId: true,
      escalaId: true,
      medicoId: true,
      data: true,
      gradeId: true,
      escala: { select: { contratoAtivoId: true } },
    },
    orderBy: [{ data: 'desc' }, { gradeId: 'asc' }],
  })) as PlantaoElegivelRow[];

  if (plantoes.length === 0) return [];

  const escalaIds = [...new Set(plantoes.map((p) => p.escalaId))];
  const prodMap = await batchResolveProducaoMedicoNasEscalas(tenantId, medicoId, escalaIds);

  const candidatos = plantoes.filter((p) => {
    const prod = prodMap.get(p.escalaId);
    return Boolean(prod?.allowPonto && prod?.requireJanelaPlantao);
  });
  if (candidatos.length === 0) return [];

  const plantaoIds = candidatos.map((p) => p.id);
  const justificativasBloqueantes = await prisma.justificativaAusenciaPonto.findMany({
    where: {
      escalaPlantaoId: { in: plantaoIds },
      status: { in: ['PENDENTE', 'ACEITA'] },
    },
    select: { escalaPlantaoId: true },
  });
  const bloqueadosPorJust = new Set(justificativasBloqueantes.map((j) => j.escalaPlantaoId));

  // Janela ampla cobrindo todos os dias civis dos candidatos
  const dias = candidatos.map((p) => intervaloDiaCivilPlantao(p.data));
  const gte = new Date(Math.min(...dias.map((d) => d.gte.getTime())));
  const lte = new Date(Math.max(...dias.map((d) => d.lte.getTime())));

  const pontosFechados = await prisma.registroPonto.findMany({
    where: {
      tenantId,
      medicoId,
      escalaId: { in: [...new Set(candidatos.map((p) => p.escalaId))] },
      checkOutAt: { not: null },
      checkInAt: { gte, lte },
    },
    select: { escalaId: true, checkInAt: true },
  });

  const contratoIds = [
    ...new Set(candidatos.map((p) => p.escala.contratoAtivoId).filter(Boolean) as string[]),
  ];
  const tiposRows =
    contratoIds.length > 0
      ? await prisma.tipoPlantao.findMany({
          where: { tenantId, contratoAtivoId: { in: contratoIds } },
          select: {
            id: true,
            contratoAtivoId: true,
            horaInicio: true,
            horaFim: true,
            cruzaMeiaNoite: true,
          },
        })
      : [];
  const tiposByContrato = new Map<
    string,
    Array<{ id: string; horaInicio: string; horaFim: string; cruzaMeiaNoite: boolean }>
  >();
  for (const t of tiposRows) {
    const list = tiposByContrato.get(t.contratoAtivoId) ?? [];
    list.push(t);
    tiposByContrato.set(t.contratoAtivoId, list);
  }

  const elegiveis = [];
  for (const p of candidatos) {
    if (bloqueadosPorJust.has(p.id)) continue;

    const dia = intervaloDiaCivilPlantao(p.data);
    const temFechado = pontosFechados.some((r) => {
      if (r.escalaId !== p.escalaId) return false;
      const t = r.checkInAt.getTime();
      return t >= dia.gte.getTime() && t <= dia.lte.getTime();
    });
    if (temFechado) continue;

    const schedule = await resolveScheduleForPlantao(tenantId, p, tiposByContrato);
    const oficial = horarioOficialFromSchedule(p, schedule);
    elegiveis.push({
      id: p.id,
      escalaId: p.escalaId,
      data: p.data,
      gradeId: p.gradeId,
      ...oficial,
    });
  }

  return elegiveis;
}

export async function criarJustificativaAusenciaPonto(
  tenantId: string,
  medicoId: string,
  input: CriarJustificativaAusenciaPontoInput
) {
  const motivo = String(input.motivo ?? '').trim();
  if (motivo.length < 10) {
    throwHttp(400, 'O motivo deve ter no mínimo 10 caracteres');
  }

  const entrada = new Date(input.horarioAlegadoEntrada);
  const saida = new Date(input.horarioAlegadoSaida);
  if (!(saida.getTime() > entrada.getTime())) {
    throwHttp(400, 'Horário de saída deve ser posterior ao de entrada');
  }

  const plantao = (await prisma.escalaPlantao.findFirst({
    where: { id: input.escalaPlantaoId, tenantId },
    select: {
      id: true,
      tenantId: true,
      escalaId: true,
      medicoId: true,
      data: true,
      gradeId: true,
      escala: { select: { contratoAtivoId: true } },
    },
  })) as PlantaoElegivelRow | null;

  if (!plantao) {
    throwHttp(404, 'Plantão não encontrado');
  }

  await assertPlantaoElegivelParaCriar(tenantId, medicoId, plantao);

  const schedule = await resolveScheduleForPlantao(tenantId, plantao);
  const { horarioOficialInicio, horarioOficialFim } = horarioOficialFromSchedule(plantao, schedule);

  return prisma.justificativaAusenciaPonto.create({
    data: {
      tenantId,
      medicoId,
      escalaId: plantao.escalaId,
      escalaPlantaoId: plantao.id,
      horarioOficialInicio,
      horarioOficialFim,
      horarioAlegadoEntrada: entrada,
      horarioAlegadoSaida: saida,
      motivo,
      status: 'PENDENTE',
    },
  });
}

export async function listMinhasJustificativas(tenantId: string, medicoId: string) {
  return prisma.justificativaAusenciaPonto.findMany({
    where: { tenantId, medicoId },
    orderBy: { createdAt: 'desc' },
    include: {
      escalaPlantao: {
        select: { id: true, data: true, gradeId: true, escalaId: true },
      },
      escala: { select: { id: true, nome: true } },
    },
  });
}

export async function listJustificativasAdmin(
  tenantId: string,
  status?: 'PENDENTE' | 'ACEITA' | 'RECUSADA'
) {
  return prisma.justificativaAusenciaPonto.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      medico: {
        select: { id: true, nomeCompleto: true, crm: true, profissao: true },
      },
      escalaPlantao: {
        select: { id: true, data: true, gradeId: true, escalaId: true },
      },
      escala: { select: { id: true, nome: true } },
    },
  });
}

export type AceitarJustificativaInput = {
  horarioAlegadoEntrada?: Date;
  horarioAlegadoSaida?: Date;
};

function truncMotivo(motivo: string, max = 200): string {
  const t = String(motivo || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Ao transferir plantão (troca/cessão), invalida pedidos PENDENTE do slot.
 * `comentarioMaster = 'Plantão transferido'`.
 */
export async function recusarJustificativasPendentesPorTransferenciaPlantao(
  db: DbClient,
  escalaPlantaoIds: string[],
  comentarioMaster = 'Plantão transferido'
): Promise<number> {
  const ids = [...new Set(escalaPlantaoIds.filter(Boolean))];
  if (ids.length === 0) return 0;
  const result = await db.justificativaAusenciaPonto.updateMany({
    where: {
      escalaPlantaoId: { in: ids },
      status: 'PENDENTE',
    },
    data: {
      status: 'RECUSADA',
      comentarioMaster,
      decididoEm: new Date(),
    },
  });
  return result.count;
}

/**
 * Aceita justificativa pendente: cancela qualquer ponto aberto da escala (sem filtro de dia civil),
 * cria RegistroPonto JUSTIFICADO_SEM_PONTO com valor cheio e notifica o médico.
 * Claim condicional (updateMany status PENDENTE) evita double JUSTIFICADO sob race.
 */
export async function aceitarJustificativa(
  tenantId: string,
  masterId: string,
  id: string,
  opts: AceitarJustificativaInput = {}
) {
  const justificativa = await prisma.justificativaAusenciaPonto.findFirst({
    where: { id, tenantId },
    include: {
      escalaPlantao: { select: { id: true, medicoId: true, data: true, escalaId: true } },
    },
  });

  if (!justificativa) {
    throwHttp(404, 'Justificativa não encontrada');
  }
  if (justificativa.status !== 'PENDENTE') {
    throwHttp(409, 'Justificativa não está pendente');
  }
  if (justificativa.escalaPlantao.medicoId !== justificativa.medicoId) {
    throwHttp(409, 'Plantão não pertence mais ao médico da justificativa');
  }

  const entrada = opts.horarioAlegadoEntrada
    ? new Date(opts.horarioAlegadoEntrada)
    : justificativa.horarioAlegadoEntrada;
  const saida = opts.horarioAlegadoSaida
    ? new Date(opts.horarioAlegadoSaida)
    : justificativa.horarioAlegadoSaida;
  if (!(saida.getTime() > entrada.getTime())) {
    throwHttp(400, 'Horário de saída deve ser posterior ao de entrada');
  }

  if (
    await temPontoFechadoNoDia(
      tenantId,
      justificativa.medicoId,
      justificativa.escalaId,
      justificativa.escalaPlantao.data
    )
  ) {
    throwHttp(409, 'Já existe ponto fechado para esta escala no dia do plantão');
  }

  const valorCheio = await resolverValorCheioPlantao(tenantId, justificativa.escalaPlantaoId);
  if (valorCheio == null) {
    throwHttp(400, 'Sem valor de plantão cadastrado');
  }

  const dia = intervaloDiaCivilPlantao(justificativa.escalaPlantao.data);
  const duracaoMinutos = Math.max(1, Math.floor((saida.getTime() - entrada.getTime()) / 60000));
  const observacao = `Justificativa ${justificativa.id}: ${truncMotivo(justificativa.motivo)}`;
  const decididoEm = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const locked = await tx.justificativaAusenciaPonto.findFirst({
      where: { id, tenantId, status: 'PENDENTE' },
      include: {
        escalaPlantao: { select: { id: true, medicoId: true, data: true, escalaId: true } },
      },
    });
    if (!locked) {
      throwHttp(409, 'Justificativa não está pendente');
    }
    if (locked.escalaPlantao.medicoId !== locked.medicoId) {
      throwHttp(409, 'Plantão não pertence mais ao médico da justificativa');
    }

    const fechado = await tx.registroPonto.findFirst({
      where: {
        tenantId,
        medicoId: locked.medicoId,
        escalaId: locked.escalaId,
        checkOutAt: { not: null },
        checkInAt: { gte: dia.gte, lte: dia.lte },
      },
      select: { id: true },
    });
    if (fechado) {
      throwHttp(409, 'Já existe ponto fechado para esta escala no dia do plantão');
    }

    // Qualquer ponto aberto da escala bloqueia checkout real; cancela sem filtro de dia civil.
    await tx.registroPonto.deleteMany({
      where: {
        tenantId,
        medicoId: locked.medicoId,
        escalaId: locked.escalaId,
        checkOutAt: null,
      },
    });

    const registro = await tx.registroPonto.create({
      data: {
        tenantId,
        medicoId: locked.medicoId,
        escalaId: locked.escalaId,
        checkInAt: entrada,
        checkOutAt: saida,
        origem: OrigemRegistroPonto.JUSTIFICADO_SEM_PONTO,
        duracaoMinutos,
        repasseValorCongelado: valorCheio,
        observacao,
      },
    });

    const claimed = await tx.justificativaAusenciaPonto.updateMany({
      where: { id: locked.id, tenantId, status: 'PENDENTE' },
      data: {
        status: 'ACEITA',
        registroPontoId: registro.id,
        decididoPorMasterId: masterId,
        decididoEm,
        horarioAlegadoEntrada: entrada,
        horarioAlegadoSaida: saida,
      },
    });
    if (claimed.count === 0) {
      await tx.registroPonto.delete({ where: { id: registro.id } });
      throwHttp(409, 'Justificativa não está pendente');
    }

    return {
      ...locked,
      status: 'ACEITA' as const,
      registroPontoId: registro.id,
      decididoPorMasterId: masterId,
      decididoEm,
      horarioAlegadoEntrada: entrada,
      horarioAlegadoSaida: saida,
    };
  });

  await criarNotificacaoComPush({
    tenantId,
    medicoId: updated.medicoId,
    tipo: TIPO_NOTIFICACAO.JUSTIFICATIVA_PONTO_ACEITA,
    titulo: 'Justificativa de ponto aceita',
    corpo: 'Sua justificativa de ausência de ponto foi aceita. O registro aparece no histórico de pontos.',
    metadata: { justificativaId: id, registroPontoId: updated.registroPontoId },
  });

  return updated;
}

/**
 * Recusa justificativa pendente. Ponto aberto (se houver) permanece intacto.
 */
export async function recusarJustificativa(
  tenantId: string,
  masterId: string,
  id: string,
  comentario?: string
) {
  const justificativa = await prisma.justificativaAusenciaPonto.findFirst({
    where: { id, tenantId },
  });

  if (!justificativa) {
    throwHttp(404, 'Justificativa não encontrada');
  }
  if (justificativa.status !== 'PENDENTE') {
    throwHttp(409, 'Justificativa não está pendente');
  }

  const comentarioMaster = comentario != null ? String(comentario).trim() || null : null;

  const updated = await prisma.justificativaAusenciaPonto.update({
    where: { id: justificativa.id },
    data: {
      status: 'RECUSADA',
      comentarioMaster,
      decididoPorMasterId: masterId,
      decididoEm: new Date(),
    },
  });

  await criarNotificacaoComPush({
    tenantId,
    medicoId: updated.medicoId,
    tipo: TIPO_NOTIFICACAO.JUSTIFICATIVA_PONTO_RECUSADA,
    titulo: 'Justificativa de ponto recusada',
    corpo: comentarioMaster
      ? `Sua justificativa de ausência de ponto foi recusada: ${comentarioMaster}`
      : 'Sua justificativa de ausência de ponto foi recusada.',
    metadata: { justificativaId: id },
  });

  return updated;
}

/**
 * True se já existe justificativa ACEITA do médico na escala cujo plantão cai no dia civil de checkInAt.
 * Usado pelo check-in (Task 5) para bloquear segundo pagamento.
 */
export async function temJustificativaAceitaNoDiaEscala(
  tenantId: string,
  medicoId: string,
  escalaId: string,
  checkInAt: Date
): Promise<boolean> {
  const { gte } = intervaloDiaCivil(checkInAt);
  const dataStr = `${gte.getFullYear()}-${String(gte.getMonth() + 1).padStart(2, '0')}-${String(gte.getDate()).padStart(2, '0')}`;
  const dataPlantao = new Date(`${dataStr}T00:00:00.000Z`);
  const found = await prisma.justificativaAusenciaPonto.findFirst({
    where: {
      tenantId,
      medicoId,
      escalaId,
      status: 'ACEITA',
      escalaPlantao: { data: dataPlantao },
    },
    select: { id: true },
  });
  return Boolean(found);
}
