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
