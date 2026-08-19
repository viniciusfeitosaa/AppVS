/**
 * Prepara um plantão elegível SEM justificativa, para o médico pedir na UI.
 * Cenário: esqueceu de bater o ponto e ainda não justificou.
 *
 * Uso: npx ts-node --transpile-only scripts/seed-plantao-sem-justificativa-demo.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function utcDateOnly(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Garante equipe do médico na escala com subgrupo usaEscala+usaPonto (elegibilidade da justificativa). */
async function ensureProducaoPontoEscala(
  tenantId: string,
  escalaId: string,
  medicoId: string
) {
  const escalaEquipes = await prisma.escalaEquipe.findMany({
    where: { tenantId, escalaId },
    select: {
      equipeId: true,
      equipe: {
        select: {
          id: true,
          subgrupo: { select: { usaEscala: true, usaPonto: true } },
        },
      },
    },
  });

  const okNaEscala = escalaEquipes.find(
    (e) => e.equipe.subgrupo?.usaEscala && e.equipe.subgrupo?.usaPonto
  );

  if (okNaEscala) {
    await prisma.equipeMedico.upsert({
      where: {
        tenantId_equipeId_medicoId: {
          tenantId,
          equipeId: okNaEscala.equipeId,
          medicoId,
        },
      },
      create: { tenantId, equipeId: okNaEscala.equipeId, medicoId },
      update: {},
    });
    return;
  }

  // Cria subgrupo + equipe + vínculos
  let sub = await prisma.subgrupo.findFirst({
    where: { tenantId, usaEscala: true, usaPonto: true, ativo: true },
  });
  if (!sub) {
    sub = await prisma.subgrupo.create({
      data: {
        tenantId,
        nome: `DEMO UAT Ponto+Escala ${Date.now()}`,
        usaEscala: true,
        usaPonto: true,
      },
    });
  }

  let equipe = await prisma.equipe.findFirst({
    where: { tenantId, subgrupoId: sub.id, ativo: true },
  });
  if (!equipe) {
    equipe = await prisma.equipe.create({
      data: {
        tenantId,
        subgrupoId: sub.id,
        nome: `DEMO EQ ${Date.now()}`,
      },
    });
  }

  await prisma.escalaEquipe.upsert({
    where: {
      tenantId_escalaId_equipeId: {
        tenantId,
        escalaId,
        equipeId: equipe.id,
      },
    },
    create: { tenantId, escalaId, equipeId: equipe.id },
    update: {},
  });

  await prisma.equipeMedico.upsert({
    where: {
      tenantId_equipeId_medicoId: {
        tenantId,
        equipeId: equipe.id,
        medicoId,
      },
    },
    create: { tenantId, equipeId: equipe.id, medicoId },
    update: {},
  });
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { ativo: true },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error('Sem tenant');

  // Preferência: Vinicius Alves (plantões na TESTEEE) — evita "Marcos Vinicius…"
  let medico = await prisma.medico.findFirst({
    where: {
      tenantId: tenant.id,
      ativo: true,
      statusCadastro: 'ATIVO',
      OR: [
        { email: { equals: 'viniciusalves919@gmail.com', mode: 'insensitive' } },
        { nomeCompleto: { startsWith: 'Vinicius Alves', mode: 'insensitive' } },
        { cpf: '06568126306' },
      ],
    },
    select: { id: true, nomeCompleto: true, email: true, cpf: true, crm: true },
  });

  if (!medico) {
    const plantaoRecente = await prisma.escalaPlantao.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { data: 'desc' },
      select: {
        medico: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            crm: true,
            ativo: true,
            statusCadastro: true,
          },
        },
      },
    });
    if (plantaoRecente?.medico?.ativo && plantaoRecente.medico.statusCadastro === 'ATIVO') {
      medico = {
        id: plantaoRecente.medico.id,
        nomeCompleto: plantaoRecente.medico.nomeCompleto,
        email: plantaoRecente.medico.email,
        cpf: plantaoRecente.medico.cpf,
        crm: plantaoRecente.medico.crm,
      };
    }
  }
  if (!medico) throw new Error('Nenhum médico ATIVO');

  let vinculo = await prisma.escalaMedico.findFirst({
    where: { tenantId: tenant.id, medicoId: medico.id, ativo: true },
    select: {
      escalaId: true,
      escala: { select: { id: true, nome: true, contratoAtivoId: true } },
    },
  });

  if (!vinculo) {
    const plantaoBase = await prisma.escalaPlantao.findFirst({
      where: { tenantId: tenant.id, medicoId: medico.id },
      orderBy: { data: 'desc' },
      select: {
        escala: { select: { id: true, nome: true, contratoAtivoId: true } },
      },
    });
    if (!plantaoBase) throw new Error('Médico sem plantão e sem vínculo em escala');

    await prisma.escalaMedico.upsert({
      where: {
        tenantId_escalaId_medicoId: {
          tenantId: tenant.id,
          escalaId: plantaoBase.escala.id,
          medicoId: medico.id,
        },
      },
      create: {
        tenantId: tenant.id,
        escalaId: plantaoBase.escala.id,
        medicoId: medico.id,
        ativo: true,
      },
      update: { ativo: true },
    });
    vinculo = {
      escalaId: plantaoBase.escala.id,
      escala: plantaoBase.escala,
    };
  }

  const escalaEscolhida = {
    id: vinculo.escala.id,
    nome: vinculo.escala.nome,
    contratoAtivoId: vinculo.escala.contratoAtivoId,
  };

  await ensureProducaoPontoEscala(tenant.id, escalaEscolhida.id, medico.id);

  let tipo = await prisma.tipoPlantao.findFirst({
    where: { tenantId: tenant.id, contratoAtivoId: escalaEscolhida.contratoAtivoId },
    orderBy: { ordem: 'asc' },
    select: { id: true, nome: true, horaInicio: true, horaFim: true },
  });
  if (!tipo) {
    tipo = await prisma.tipoPlantao.findFirst({
      where: { tenantId: tenant.id },
      select: { id: true, nome: true, horaInicio: true, horaFim: true },
    });
  }
  if (!tipo) throw new Error('Sem tipo de plantão (grade) no tenant');

  const hoje = new Date();

  async function prepararDia(data: Date) {
    const plantao = await prisma.escalaPlantao.upsert({
      where: {
        escalaId_data_gradeId_medicoId: {
          escalaId: escalaEscolhida.id,
          data,
          gradeId: tipo!.id,
          medicoId: medico!.id,
        },
      },
      create: {
        tenantId: tenant!.id,
        escalaId: escalaEscolhida.id,
        data,
        gradeId: tipo!.id,
        medicoId: medico!.id,
        valorHora: 150,
        horasTurnoSnapshot: 12,
      },
      update: { valorHora: 150, horasTurnoSnapshot: 12 },
      select: { id: true, data: true, escalaId: true },
    });

    // Libera PENDENTE anterior neste plantão (para poder pedir de novo na UI)
    await prisma.justificativaAusenciaPonto.updateMany({
      where: { escalaPlantaoId: plantao.id, status: 'PENDENTE' },
      data: {
        status: 'RECUSADA',
        comentarioMaster: '[DEMO] liberado para novo pedido manual',
        decididoEm: new Date(),
      },
    });

    const aceita = await prisma.justificativaAusenciaPonto.findFirst({
      where: { escalaPlantaoId: plantao.id, status: 'ACEITA' },
      select: { id: true },
    });
    if (aceita) return null;

    const dayStart = new Date(data);
    const dayEnd = new Date(data);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Remove qualquer ponto do dia (fechado ou aberto) — cenário “esqueceu de bater”
    await prisma.registroPonto.deleteMany({
      where: {
        tenantId: tenant!.id,
        medicoId: medico!.id,
        escalaId: escalaEscolhida.id,
        checkInAt: { gte: dayStart, lte: dayEnd },
      },
    });

    return plantao;
  }

  let plantaoFinal = null as Awaited<ReturnType<typeof prepararDia>>;
  for (const daysAgo of [1, 2, 3, 4, 5]) {
    const dia = utcDateOnly(
      new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - daysAgo))
    );
    plantaoFinal = await prepararDia(dia);
    if (plantaoFinal) break;
  }
  if (!plantaoFinal) {
    throw new Error('Não foi possível achar um dia livre de justificativa ACEITA');
  }

  const dataStr = plantaoFinal.data.toISOString().slice(0, 10);

  console.log(
    JSON.stringify(
      {
        ok: true,
        cenario: 'Esqueceu de bater o ponto — ainda NÃO pediu justificativa',
        medico: {
          nome: medico.nomeCompleto,
          email: medico.email,
          cpf: medico.cpf,
          crm: medico.crm,
        },
        escala: escalaEscolhida.nome,
        plantaoId: plantaoFinal.id,
        dataPlantao: dataStr,
        tipoPlantao: `${tipo.nome} (${tipo.horaInicio}–${tipo.horaFim})`,
        comoTestar: [
          '1. Logout do MASTER',
          '2. Login como este MÉDICO (CPF/CRM ou e-mail+senha)',
          '3. Abrir menu Ponto → Justificar ausência de ponto',
          `4. Deve aparecer o plantão de ${dataStr} na lista elegível`,
          '5. Preencher motivo + horários e enviar → fica PENDENTE',
          '6. Voltar como MASTER em /app/justificativas-ponto para aceitar/recusar',
        ],
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
