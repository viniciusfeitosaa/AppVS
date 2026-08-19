/**
 * Seed local: cria pedidos de justificativa PENDENTE para testar a fila Master.
 * Uso: npx ts-node scripts/seed-justificativas-ponto-demo.ts
 */
import { PrismaClient, StatusJustificativaAusenciaPonto } from '@prisma/client';

const prisma = new PrismaClient();

function dayBounds(d: Date) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return {
    gte: new Date(Date.UTC(y, m, day, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(y, m, day, 23, 59, 59, 999)),
  };
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { ativo: true },
    select: { id: true, nome: true, slug: true },
  });
  if (!tenant) throw new Error('Nenhum tenant ativo');

  const pendingBefore = await prisma.justificativaAusenciaPonto.count({
    where: { tenantId: tenant.id, status: StatusJustificativaAusenciaPonto.PENDENTE },
  });

  const plantoes = await prisma.escalaPlantao.findMany({
    where: {
      tenantId: tenant.id,
      NOT: { medicoId: '' },
    },
    orderBy: { data: 'desc' },
    take: 40,
    include: {
      escala: { select: { nome: true } },
      medico: { select: { nomeCompleto: true, email: true } },
    },
  });

  const withMedico = plantoes.filter((p) => Boolean(p.medicoId));

  const created: Array<{ id: string; medico: string; plantao: string; data: string }> = [];
  const skipped: string[] = [];

  for (const plantao of withMedico) {
    if (created.length >= 3) break;
    const medicoId = plantao.medicoId!;

    const existingOpen = await prisma.justificativaAusenciaPonto.findFirst({
      where: {
        escalaPlantaoId: plantao.id,
        status: {
          in: [StatusJustificativaAusenciaPonto.PENDENTE, StatusJustificativaAusenciaPonto.ACEITA],
        },
      },
      select: { id: true, status: true },
    });
    if (existingOpen) {
      skipped.push(`${plantao.id} já ${existingOpen.status}`);
      continue;
    }

    const bounds = dayBounds(plantao.data);
    const pontoFechado = await prisma.registroPonto.findFirst({
      where: {
        tenantId: tenant.id,
        medicoId: medicoId,
        escalaId: plantao.escalaId,
        checkOutAt: { not: null },
        checkInAt: { gte: bounds.gte, lte: bounds.lte },
      },
      select: { id: true },
    });
    if (pontoFechado) {
      skipped.push(`${plantao.id} tem ponto fechado`);
      continue;
    }

    const dataStr = plantao.data.toISOString().slice(0, 10);
    const entrada = new Date(`${dataStr}T07:00:00.000`);
    const saida = new Date(`${dataStr}T19:00:00.000`);
    const oficialInicio = new Date(`${dataStr}T07:00:00.000`);
    const oficialFim = new Date(`${dataStr}T19:00:00.000`);

    const row = await prisma.justificativaAusenciaPonto.create({
      data: {
        tenantId: tenant.id,
        medicoId,
        escalaId: plantao.escalaId,
        escalaPlantaoId: plantao.id,
        horarioOficialInicio: oficialInicio,
        horarioOficialFim: oficialFim,
        horarioAlegadoEntrada: entrada,
        horarioAlegadoSaida: saida,
        motivo: `[DEMO UAT] Esqueci de bater o ponto — seed ${new Date().toISOString()}`,
        status: StatusJustificativaAusenciaPonto.PENDENTE,
      },
      select: { id: true },
    });

    created.push({
      id: row.id,
      medico: plantao.medico?.nomeCompleto || medicoId,
      plantao: plantao.escala?.nome || plantao.escalaId,
      data: dataStr,
    });
  }

  const pendingAfter = await prisma.justificativaAusenciaPonto.count({
    where: { tenantId: tenant.id, status: StatusJustificativaAusenciaPonto.PENDENTE },
  });

  console.log(
    JSON.stringify(
      {
        tenant: tenant.slug,
        pendingBefore,
        pendingAfter,
        created,
        skipped: skipped.slice(0, 10),
        tip: 'Recarregue /app/justificativas-ponto como MASTER',
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
