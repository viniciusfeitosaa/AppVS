import { prisma } from '../config/database';

type SubgrupoFlags = { usaPonto: boolean; usaEscala: boolean };

/**
 * Escala exige ponto em plantão se algum vínculo (equipe, subgrupo da escala ou contrato)
 * aponta para subgrupo com usaPonto + usaEscala.
 */
export async function batchEscalaRequerPontoPlantao(
  tenantId: string,
  escalaIds: string[]
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const uniq = [...new Set(escalaIds.filter(Boolean))];
  for (const id of uniq) out.set(id, false);
  if (uniq.length === 0) return out;

  const mark = (escalaId: string, sg: SubgrupoFlags | null | undefined) => {
    if (sg?.usaPonto && sg?.usaEscala) out.set(escalaId, true);
  };

  const [viaEquipe, viaSubgrupo, escalas] = await Promise.all([
    prisma.escalaEquipe.findMany({
      where: { tenantId, escalaId: { in: uniq } },
      select: {
        escalaId: true,
        equipe: { select: { subgrupo: { select: { usaPonto: true, usaEscala: true } } } },
      },
    }),
    prisma.escalaSubgrupo.findMany({
      where: { tenantId, escalaId: { in: uniq } },
      select: {
        escalaId: true,
        subgrupo: { select: { usaPonto: true, usaEscala: true } },
      },
    }),
    prisma.escala.findMany({
      where: { tenantId, id: { in: uniq } },
      select: { id: true, contratoAtivoId: true },
    }),
  ]);

  for (const row of viaEquipe) mark(row.escalaId, row.equipe.subgrupo);
  for (const row of viaSubgrupo) mark(row.escalaId, row.subgrupo);

  const semVinculo = escalas.filter((e) => !out.get(e.id) && e.contratoAtivoId);
  if (semVinculo.length > 0) {
    const contratoIds = [...new Set(semVinculo.map((e) => e.contratoAtivoId!))];
    const viaContrato = await prisma.contratoSubgrupo.findMany({
      where: { tenantId, contratoAtivoId: { in: contratoIds } },
      select: {
        contratoAtivoId: true,
        subgrupo: { select: { usaPonto: true, usaEscala: true } },
      },
    });
    const porContrato = new Map<string, SubgrupoFlags[]>();
    for (const row of viaContrato) {
      const list = porContrato.get(row.contratoAtivoId) ?? [];
      list.push(row.subgrupo);
      porContrato.set(row.contratoAtivoId, list);
    }
    for (const esc of semVinculo) {
      for (const sg of porContrato.get(esc.contratoAtivoId!) ?? []) {
        mark(esc.id, sg);
      }
    }
  }

  return out;
}

/** Plantão alocado na grade exige ponto se a escala exige ou o médico tem ponto habilitado no vínculo. */
export function plantaoExigePontoNoPlantao(
  prod: { allowPonto: boolean; requireJanelaPlantao: boolean } | undefined,
  escalaRequerPonto: boolean,
  opts: { alocadoNaGrade?: boolean } = {}
): boolean {
  if (escalaRequerPonto) return true;
  if (opts.alocadoNaGrade && prod?.allowPonto) return true;
  return Boolean(prod?.allowPonto && prod?.requireJanelaPlantao);
}
