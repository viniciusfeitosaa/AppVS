import { prisma } from '../config/database';
import {
  duracaoPlantaoHorasUtc,
  scheduleFromLegacyGradeId,
  scheduleFromTipoRow,
} from '../utils/plantao-horario';
import { isMissingDatabaseColumnError } from '../utils/prisma-column-error';
import { diaKeyFromDateUtc, pickRatePorDia } from '../utils/valor-plantao-dia.util';

const round2 = (n: number) => Math.round(n * 100) / 100;

type PlantaoValorRow = {
  escalaId: string;
  medicoId: string;
  gradeId: string;
  valorHora: unknown;
  data?: Date | string | null;
  horasTurnoSnapshot?: unknown;
};

function inferLegacyGradeFromGradeId(gradeId: string): 'mt' | 'sn' {
  const g = String(gradeId || '').toLowerCase();
  if (g === 'sn') return 'sn';
  if (g === 'mt') return 'mt';
  return 'mt';
}

async function maxValorPlantaoGrade(
  tenantId: string,
  contratoAtivoId: string,
  gradeId: string
): Promise<number | null> {
  let total: number | null = null;
  const vals = await prisma.valorPlantao.findMany({
    where: { tenantId, contratoAtivoId, gradeId },
    select: { valorHora: true },
  });
  for (const row of vals) {
    if (row.valorHora == null) continue;
    const n = Number(row.valorHora);
    if (Number.isFinite(n) && n > 0) {
      total = total == null ? n : Math.max(total, n);
    }
  }
  return total;
}

async function resolveHorasTurno(
  tenantId: string,
  contratoAtivoId: string,
  plantao: PlantaoValorRow
): Promise<number> {
  const snapH = plantao.horasTurnoSnapshot != null ? Number(plantao.horasTurnoSnapshot) : NaN;
  if (Number.isFinite(snapH) && snapH > 0) return snapH;

  const tipos = await prisma.tipoPlantao.findMany({
    where: { tenantId, contratoAtivoId },
    select: { id: true, horaInicio: true, horaFim: true, cruzaMeiaNoite: true },
  });
  const tipoScheduleByGradeId = new Map(tipos.map((t) => [t.id, scheduleFromTipoRow(t)] as const));
  const scheduleForPlantaoGrade = (gradeId: string) => {
    const fromTipo = tipoScheduleByGradeId.get(gradeId);
    if (fromTipo) return fromTipo;
    return scheduleFromLegacyGradeId(gradeId);
  };

  const gk = String(plantao.gradeId).toLowerCase();
  for (const t of tipos) {
    if (String(t.id).toLowerCase() === gk) {
      const sch = scheduleFromTipoRow(t);
      return Math.round(duracaoPlantaoHorasUtc(sch) * 10000) / 10000;
    }
  }

  return Math.round(duracaoPlantaoHorasUtc(scheduleForPlantaoGrade(plantao.gradeId)) * 10000) / 10000;
}

/**
 * Valor/hora em Configuração de Ponto (Valores de Ponto): equipe do médico na escala,
 * senão config do subgrupo (equipeId null). Preferência: linha com equipe específica.
 */
async function resolveValorHoraConfigPonto(
  tenantId: string,
  contratoAtivoId: string,
  escalaId: string,
  medicoId: string,
  dataPlantao: Date | string | null | undefined
): Promise<number | null> {
  const equipesNaEscalaDoMedico = await prisma.escalaEquipe.findMany({
    where: {
      tenantId,
      escalaId,
      equipe: {
        equipeMedicos: { some: { tenantId, medicoId } },
      },
    },
    select: { equipeId: true, equipe: { select: { subgrupoId: true } } },
  });
  const equipeIds = [...new Set(equipesNaEscalaDoMedico.map((e) => e.equipeId).filter(Boolean))];
  const subgrupoIds = [
    ...new Set(
      equipesNaEscalaDoMedico
        .map((e) => e.equipe?.subgrupoId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  type Cfg = {
    equipeId: string | null;
    valorHora: unknown;
    valorHoraPorDia?: unknown;
  };

  let configs: Cfg[] = [];
  try {
    configs = (await prisma.configPontoEletronico.findMany({
      where: {
        tenantId,
        contratoAtivoId,
        OR: [
          ...(equipeIds.length ? [{ equipeId: { in: equipeIds } }] : []),
          ...(subgrupoIds.length
            ? [{ subgrupoId: { in: subgrupoIds }, equipeId: null }]
            : []),
        ],
      },
      select: { equipeId: true, valorHora: true, valorHoraPorDia: true },
    })) as Cfg[];
  } catch (e) {
    if (
      isMissingDatabaseColumnError(e, 'valor_hora_por_dia') ||
      isMissingDatabaseColumnError(e, 'valor_hora_cobranca_por_dia')
    ) {
      configs = (await prisma.configPontoEletronico.findMany({
        where: {
          tenantId,
          contratoAtivoId,
          OR: [
            ...(equipeIds.length ? [{ equipeId: { in: equipeIds } }] : []),
            ...(subgrupoIds.length
              ? [{ subgrupoId: { in: subgrupoIds }, equipeId: null }]
              : []),
          ],
        },
        select: { equipeId: true, valorHora: true },
      })) as Cfg[];
    } else {
      throw e;
    }
  }

  if (configs.length === 0) return null;

  const preferEquipe = configs.find((c) => c.equipeId != null && equipeIds.includes(c.equipeId));
  const preferSubgrupo = configs.find((c) => c.equipeId == null);
  const chosen = preferEquipe ?? preferSubgrupo ?? configs[0];

  const data =
    dataPlantao instanceof Date
      ? dataPlantao
      : dataPlantao
        ? new Date(dataPlantao)
        : null;
  const dia = data && !Number.isNaN(data.getTime()) ? diaKeyFromDateUtc(data) : null;
  const global = chosen.valorHora != null ? Number(chosen.valorHora) : null;
  if (dia) {
    const porDia = pickRatePorDia(
      (chosen.valorHoraPorDia as Record<string, unknown> | null) ?? null,
      dia,
      global
    );
    if (porDia != null && porDia > 0) return porDia;
  }
  if (global != null && Number.isFinite(global) && global > 0) return global;
  return null;
}

/**
 * Total do plantão para justificativa (não rateia por horas alegadas).
 * Ordem: EscalaPlantao.valorHora → max ValorPlantao → ConfigPonto (R$/h × horas) →
 * EscalaMedico.valorHora × horasTurno.
 */
export async function resolverValorCheioPlantao(
  tenantId: string,
  escalaPlantaoId: string
): Promise<number | null> {
  const plantaoSelectBase = {
    escalaId: true,
    medicoId: true,
    gradeId: true,
    valorHora: true,
    data: true,
  } as const;

  let plantao: PlantaoValorRow | null;
  try {
    plantao = (await prisma.escalaPlantao.findFirst({
      where: { id: escalaPlantaoId, tenantId },
      select: { ...plantaoSelectBase, horasTurnoSnapshot: true } as any,
    })) as PlantaoValorRow | null;
  } catch (e) {
    if (isMissingDatabaseColumnError(e, 'horas_turno_snapshot')) {
      plantao = (await prisma.escalaPlantao.findFirst({
        where: { id: escalaPlantaoId, tenantId },
        select: { ...plantaoSelectBase },
      })) as PlantaoValorRow | null;
    } else {
      throw e;
    }
  }

  if (!plantao) return null;

  const vPl = plantao.valorHora != null ? Number(plantao.valorHora) : NaN;
  if (Number.isFinite(vPl) && vPl > 0) {
    return round2(vPl);
  }

  const escala = await prisma.escala.findFirst({
    where: { id: plantao.escalaId, tenantId },
    select: { contratoAtivo: { select: { id: true } } },
  });
  const contratoId = escala?.contratoAtivo?.id;
  if (!contratoId) return null;

  let total = await maxValorPlantaoGrade(tenantId, contratoId, plantao.gradeId);
  if (total == null) {
    const leg = inferLegacyGradeFromGradeId(plantao.gradeId);
    total = await maxValorPlantaoGrade(tenantId, contratoId, leg);
    if (total == null) {
      total = await maxValorPlantaoGrade(tenantId, contratoId, leg.toUpperCase());
    }
  }
  if (total != null && total > 0) {
    return round2(total);
  }

  const horas = await resolveHorasTurno(tenantId, contratoId, plantao);

  const vhConfig = await resolveValorHoraConfigPonto(
    tenantId,
    contratoId,
    plantao.escalaId,
    plantao.medicoId,
    plantao.data
  );
  if (vhConfig != null && vhConfig > 0 && horas > 0) {
    return round2(vhConfig * horas);
  }

  const aloc = await prisma.escalaMedico.findFirst({
    where: { tenantId, escalaId: plantao.escalaId, medicoId: plantao.medicoId },
    select: { valorHora: true },
  });
  const vhAloc = aloc?.valorHora != null ? Number(aloc.valorHora) : NaN;
  if (Number.isFinite(vhAloc) && vhAloc > 0) {
    if (horas > 0) return round2(vhAloc * horas);
  }

  return null;
}
