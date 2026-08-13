import { prisma } from '../config/database';
import {
  duracaoPlantaoHorasUtc,
  scheduleFromLegacyGradeId,
  scheduleFromTipoRow,
} from '../utils/plantao-horario';
import { isMissingDatabaseColumnError } from '../utils/prisma-column-error';

const round2 = (n: number) => Math.round(n * 100) / 100;

type PlantaoValorRow = {
  escalaId: string;
  medicoId: string;
  gradeId: string;
  valorHora: unknown;
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
 * Total do plantão para justificativa (não rateia por horas alegadas).
 * Ordem: EscalaPlantao.valorHora → max ValorPlantao → EscalaMedico.valorHora × horasTurno.
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

  const aloc = await prisma.escalaMedico.findFirst({
    where: { tenantId, escalaId: plantao.escalaId, medicoId: plantao.medicoId },
    select: { valorHora: true },
  });
  const vhAloc = aloc?.valorHora != null ? Number(aloc.valorHora) : NaN;
  if (Number.isFinite(vhAloc) && vhAloc > 0) {
    const horas = await resolveHorasTurno(tenantId, contratoId, plantao);
    if (horas > 0) return round2(vhAloc * horas);
  }

  return null;
}
