/**
 * Cria (idempotente) um contrato UAT com duas escalas:
 * - Escala + ponto: cobrança R$ 120/h, margem 25% → repasse R$ 90/h
 * - Somente escala: cobrança R$ 100/h, margem 25% → repasse R$ 75/h
 *
 * Dois profissionais, 2 plantões de 12h cada (17 e 18/08/2026).
 *
 * Uso:
 *   cd backend
 *   npx ts-node --transpile-only scripts/seed-faturamento-uat-demo.ts
 *
 * Conferir: Relatório financeiro → contrato "UAT Faturamento misto" → ago/2026
 * Tabela esperada: scripts/uat-faturamento-visual.html
 */
import { writeFileSync } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient, StatusCadastroMedico } from '@prisma/client';
import { htmlUatFaturamentoVisual, totaisUatFaturamento, UAT_FATURAMENTO as C } from '../src/utils/faturamento-uat-demo';

const prisma = new PrismaClient();

const POR_DIA_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;

function porDia(v: number): Record<string, number> {
  return Object.fromEntries(POR_DIA_KEYS.map((k) => [k, v]));
}

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

async function upsertMedico(
  tenantId: string,
  spec: { nome: string; email: string; cpf: string; crm: string },
  senhaHash: string
) {
  const byEmail = await prisma.medico.findFirst({
    where: { tenantId, email: { equals: spec.email, mode: 'insensitive' } },
  });
  if (byEmail) {
    return prisma.medico.update({
      where: { id: byEmail.id },
      data: {
        nomeCompleto: spec.nome,
        senhaHash,
        ativo: true,
        statusCadastro: StatusCadastroMedico.ATIVO,
        crm: spec.crm,
      },
    });
  }
  const cpfTaken = await prisma.medico.findFirst({ where: { tenantId, cpf: spec.cpf } });
  const crmTaken = await prisma.medico.findFirst({ where: { tenantId, crm: spec.crm } });
  const cpf = cpfTaken ? `${spec.cpf.slice(0, 9)}${String(Date.now()).slice(-2)}`.slice(0, 11) : spec.cpf;
  const crm = crmTaken ? `${spec.crm}-${Date.now().toString().slice(-4)}` : spec.crm;
  return prisma.medico.create({
    data: {
      tenantId,
      nomeCompleto: spec.nome,
      email: spec.email,
      cpf,
      crm,
      senhaHash,
      profissao: 'Médico',
      especialidades: ['Clínica Médica'],
      ativo: true,
      statusCadastro: StatusCadastroMedico.ATIVO,
    },
  });
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { ativo: true },
    select: { id: true, slug: true, nome: true },
  });
  if (!tenant) throw new Error('Nenhum tenant ativo');

  const senhaHash = await bcrypt.hash(C.senhaPadrao, 12);
  const dataInicio = utcDate('2026-08-01');
  const dataFim = utcDate('2026-08-31');

  let contrato = await prisma.contratoAtivo.findFirst({
    where: { tenantId: tenant.id, nome: C.contratoNome },
  });
  if (!contrato) {
    contrato = await prisma.contratoAtivo.create({
      data: {
        tenantId: tenant.id,
        nome: C.contratoNome,
        descricao:
          'UAT: uma escala com ponto (cob. 120/h, margem 25%) e uma só escala (cob. 100/h, margem 25%).',
        dataInicio,
        dataFim,
        ativo: true,
        usaEscala: true,
        usaPonto: true,
      },
    });
  } else {
    contrato = await prisma.contratoAtivo.update({
      where: { id: contrato.id },
      data: { ativo: true, usaEscala: true, usaPonto: true, dataInicio, dataFim },
    });
  }

  const subPonto =
    (await prisma.subgrupo.findFirst({
      where: { tenantId: tenant.id, nome: C.subgrupoPontoNome },
    })) ??
    (await prisma.subgrupo.create({
      data: {
        tenantId: tenant.id,
        nome: C.subgrupoPontoNome,
        usaEscala: true,
        usaPonto: true,
        ativo: true,
      },
    }));
  await prisma.subgrupo.update({
    where: { id: subPonto.id },
    data: { usaEscala: true, usaPonto: true, ativo: true },
  });

  const subEscala =
    (await prisma.subgrupo.findFirst({
      where: { tenantId: tenant.id, nome: C.subgrupoEscalaNome },
    })) ??
    (await prisma.subgrupo.create({
      data: {
        tenantId: tenant.id,
        nome: C.subgrupoEscalaNome,
        usaEscala: true,
        usaPonto: false,
        ativo: true,
      },
    }));
  await prisma.subgrupo.update({
    where: { id: subEscala.id },
    data: { usaEscala: true, usaPonto: false, ativo: true },
  });

  const eqPonto =
    (await prisma.equipe.findFirst({
      where: { tenantId: tenant.id, subgrupoId: subPonto.id, nome: C.equipePontoNome },
    })) ??
    (await prisma.equipe.create({
      data: { tenantId: tenant.id, subgrupoId: subPonto.id, nome: C.equipePontoNome, ativo: true },
    }));

  const eqEscala =
    (await prisma.equipe.findFirst({
      where: { tenantId: tenant.id, subgrupoId: subEscala.id, nome: C.equipeEscalaNome },
    })) ??
    (await prisma.equipe.create({
      data: { tenantId: tenant.id, subgrupoId: subEscala.id, nome: C.equipeEscalaNome, ativo: true },
    }));

  await prisma.contratoSubgrupo.upsert({
    where: {
      tenantId_contratoAtivoId_subgrupoId: {
        tenantId: tenant.id,
        contratoAtivoId: contrato.id,
        subgrupoId: subPonto.id,
      },
    },
    create: { tenantId: tenant.id, contratoAtivoId: contrato.id, subgrupoId: subPonto.id },
    update: {},
  });
  await prisma.contratoSubgrupo.upsert({
    where: {
      tenantId_contratoAtivoId_subgrupoId: {
        tenantId: tenant.id,
        contratoAtivoId: contrato.id,
        subgrupoId: subEscala.id,
      },
    },
    create: { tenantId: tenant.id, contratoAtivoId: contrato.id, subgrupoId: subEscala.id },
    update: {},
  });
  await prisma.contratoEquipe.upsert({
    where: {
      tenantId_contratoAtivoId_equipeId: {
        tenantId: tenant.id,
        contratoAtivoId: contrato.id,
        equipeId: eqPonto.id,
      },
    },
    create: { tenantId: tenant.id, contratoAtivoId: contrato.id, equipeId: eqPonto.id },
    update: {},
  });
  await prisma.contratoEquipe.upsert({
    where: {
      tenantId_contratoAtivoId_equipeId: {
        tenantId: tenant.id,
        contratoAtivoId: contrato.id,
        equipeId: eqEscala.id,
      },
    },
    create: { tenantId: tenant.id, contratoAtivoId: contrato.id, equipeId: eqEscala.id },
    update: {},
  });

  let tipo = await prisma.tipoPlantao.findFirst({
    where: { tenantId: tenant.id, contratoAtivoId: contrato.id, nome: C.tipoNome },
  });
  if (!tipo) {
    tipo = await prisma.tipoPlantao.create({
      data: {
        tenantId: tenant.id,
        contratoAtivoId: contrato.id,
        nome: C.tipoNome,
        horaInicio: '07:00',
        horaFim: '19:00',
        cruzaMeiaNoite: false,
        ordem: 0,
      },
    });
  }
  const gradeId = tipo.id;

  const upsertValor = async (subgrupoId: string, equipeId: string, rep: number, cob: number) => {
    const existing = await prisma.valorPlantao.findFirst({
      where: {
        tenantId: tenant.id,
        contratoAtivoId: contrato.id,
        subgrupoId,
        equipeId,
        gradeId,
      },
    });
    const data = {
      valorHora: new Prisma.Decimal(rep),
      valorHoraCobranca: new Prisma.Decimal(cob),
      valorHoraPorDia: porDia(rep),
      valorHoraCobrancaPorDia: porDia(cob),
    };
    if (existing) {
      await prisma.valorPlantao.update({ where: { id: existing.id }, data });
    } else {
      await prisma.valorPlantao.create({
        data: {
          tenantId: tenant.id,
          contratoAtivoId: contrato.id,
          subgrupoId,
          equipeId,
          gradeId,
          ...data,
        },
      });
    }
  };
  await upsertValor(subPonto.id, eqPonto.id, C.ponto.repasseHora, C.ponto.cobrancaHora);
  await upsertValor(subEscala.id, eqEscala.id, C.somenteEscala.repasseHora, C.somenteEscala.cobrancaHora);

  let escPonto = await prisma.escala.findFirst({
    where: { tenantId: tenant.id, contratoAtivoId: contrato.id, nome: C.escalaPontoNome },
  });
  if (!escPonto) {
    escPonto = await prisma.escala.create({
      data: {
        tenantId: tenant.id,
        contratoAtivoId: contrato.id,
        nome: C.escalaPontoNome,
        descricao: 'Produção usa escala + ponto',
        dataInicio,
        dataFim,
        ativo: true,
      },
    });
  }
  let escSo = await prisma.escala.findFirst({
    where: { tenantId: tenant.id, contratoAtivoId: contrato.id, nome: C.escalaSomenteNome },
  });
  if (!escSo) {
    escSo = await prisma.escala.create({
      data: {
        tenantId: tenant.id,
        contratoAtivoId: contrato.id,
        nome: C.escalaSomenteNome,
        descricao: 'Produção somente escala (sem ponto)',
        dataInicio,
        dataFim,
        ativo: true,
      },
    });
  }

  await prisma.escalaEquipe.upsert({
    where: {
      tenantId_escalaId_equipeId: { tenantId: tenant.id, escalaId: escPonto.id, equipeId: eqPonto.id },
    },
    create: { tenantId: tenant.id, escalaId: escPonto.id, equipeId: eqPonto.id },
    update: {},
  });
  await prisma.escalaEquipe.upsert({
    where: {
      tenantId_escalaId_equipeId: { tenantId: tenant.id, escalaId: escSo.id, equipeId: eqEscala.id },
    },
    create: { tenantId: tenant.id, escalaId: escSo.id, equipeId: eqEscala.id },
    update: {},
  });
  await prisma.escalaSubgrupo.upsert({
    where: {
      tenantId_escalaId_subgrupoId: {
        tenantId: tenant.id,
        escalaId: escPonto.id,
        subgrupoId: subPonto.id,
      },
    },
    create: { tenantId: tenant.id, escalaId: escPonto.id, subgrupoId: subPonto.id },
    update: {},
  });
  await prisma.escalaSubgrupo.upsert({
    where: {
      tenantId_escalaId_subgrupoId: {
        tenantId: tenant.id,
        escalaId: escSo.id,
        subgrupoId: subEscala.id,
      },
    },
    create: { tenantId: tenant.id, escalaId: escSo.id, subgrupoId: subEscala.id },
    update: {},
  });

  const medPonto = await upsertMedico(tenant.id, C.medicoPonto, senhaHash);
  const medEscala = await upsertMedico(tenant.id, C.medicoEscala, senhaHash);

  await prisma.subgrupoMedico.upsert({
    where: {
      tenantId_subgrupoId_medicoId: { tenantId: tenant.id, subgrupoId: subPonto.id, medicoId: medPonto.id },
    },
    create: { tenantId: tenant.id, subgrupoId: subPonto.id, medicoId: medPonto.id },
    update: {},
  });
  await prisma.subgrupoMedico.upsert({
    where: {
      tenantId_subgrupoId_medicoId: {
        tenantId: tenant.id,
        subgrupoId: subEscala.id,
        medicoId: medEscala.id,
      },
    },
    create: { tenantId: tenant.id, subgrupoId: subEscala.id, medicoId: medEscala.id },
    update: {},
  });
  await prisma.equipeMedico.upsert({
    where: {
      tenantId_equipeId_medicoId: { tenantId: tenant.id, equipeId: eqPonto.id, medicoId: medPonto.id },
    },
    create: { tenantId: tenant.id, equipeId: eqPonto.id, medicoId: medPonto.id },
    update: {},
  });
  await prisma.equipeMedico.upsert({
    where: {
      tenantId_equipeId_medicoId: { tenantId: tenant.id, equipeId: eqEscala.id, medicoId: medEscala.id },
    },
    create: { tenantId: tenant.id, equipeId: eqEscala.id, medicoId: medEscala.id },
    update: {},
  });

  await prisma.escalaMedico.upsert({
    where: {
      tenantId_escalaId_medicoId: { tenantId: tenant.id, escalaId: escPonto.id, medicoId: medPonto.id },
    },
    create: {
      tenantId: tenant.id,
      escalaId: escPonto.id,
      medicoId: medPonto.id,
      ativo: true,
    },
    update: { ativo: true },
  });
  await prisma.escalaMedico.upsert({
    where: {
      tenantId_escalaId_medicoId: { tenantId: tenant.id, escalaId: escSo.id, medicoId: medEscala.id },
    },
    create: {
      tenantId: tenant.id,
      escalaId: escSo.id,
      medicoId: medEscala.id,
      ativo: true,
    },
    update: { ativo: true },
  });

  const cfgPonto = await prisma.configPontoEletronico.findFirst({
    where: {
      tenantId: tenant.id,
      contratoAtivoId: contrato.id,
      subgrupoId: subPonto.id,
      equipeId: eqPonto.id,
    },
  });
  const cfgData = {
    horarioEntrada: '07:00',
    horarioSaida: '19:00',
    toleranciaMinutos: 15,
    valorHora: new Prisma.Decimal(C.ponto.repasseHora),
    valorHoraCobranca: new Prisma.Decimal(C.ponto.cobrancaHora),
  };
  if (cfgPonto) {
    await prisma.configPontoEletronico.update({ where: { id: cfgPonto.id }, data: cfgData });
  } else {
    await prisma.configPontoEletronico.create({
      data: {
        tenantId: tenant.id,
        contratoAtivoId: contrato.id,
        subgrupoId: subPonto.id,
        equipeId: eqPonto.id,
        ...cfgData,
      },
    });
  }

  const datas = C.datasIso.map(utcDate);
  await prisma.registroPonto.deleteMany({
    where: {
      tenantId: tenant.id,
      escalaId: { in: [escPonto.id, escSo.id] },
      medicoId: { in: [medPonto.id, medEscala.id] },
    },
  });
  await prisma.escalaPlantao.deleteMany({
    where: {
      tenantId: tenant.id,
      escalaId: { in: [escPonto.id, escSo.id] },
      medicoId: { in: [medPonto.id, medEscala.id] },
    },
  });

  for (const data of datas) {
    const ymd = data.toISOString().slice(0, 10);
    await prisma.escalaPlantao.create({
      data: {
        tenantId: tenant.id,
        escalaId: escPonto.id,
        medicoId: medPonto.id,
        data,
        gradeId,
        horasTurnoSnapshot: new Prisma.Decimal(C.horasTurno),
      },
    });
    await prisma.escalaPlantao.create({
      data: {
        tenantId: tenant.id,
        escalaId: escSo.id,
        medicoId: medEscala.id,
        data,
        gradeId,
        horasTurnoSnapshot: new Prisma.Decimal(C.horasTurno),
      },
    });

    const checkInAt = new Date(`${ymd}T07:00:00.000-03:00`);
    const checkOutAt = new Date(`${ymd}T19:00:00.000-03:00`);
    const repassePlantao = C.horasTurno * C.ponto.repasseHora;
    await prisma.registroPonto.create({
      data: {
        tenantId: tenant.id,
        escalaId: escPonto.id,
        medicoId: medPonto.id,
        origem: 'APP_MEDICO',
        checkInAt,
        checkOutAt,
        duracaoMinutos: C.horasTurno * 60,
        motivoCheckinSemFoto: 'UAT seed — ponto fechado para relatório',
        repasseValorCongelado: new Prisma.Decimal(repassePlantao),
      },
    });
  }

  const htmlPath = path.join(__dirname, 'uat-faturamento-visual.html');
  writeFileSync(htmlPath, htmlUatFaturamentoVisual(), 'utf8');

  const totais = totaisUatFaturamento();
  console.log(
    JSON.stringify(
      {
        ok: true,
        tenant: tenant.slug,
        contrato: C.contratoNome,
        contratoId: contrato.id,
        html: htmlPath,
        logins: {
          senha: C.senhaPadrao,
          ponto: C.medicoPonto.email,
          somenteEscala: C.medicoEscala.email,
        },
        conferirNoRelatorio: {
          contrato: C.contratoNome,
          periodo: '2026-08-01 a 2026-08-31',
          totais,
        },
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
