import { OrigemRegistroPonto } from '@prisma/client';
import { prisma } from '../config/database';
import { createAuditLog } from './auditoria.service';

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

export async function checkInService(
  tenantId: string,
  medicoId: string,
  escalaId: string,
  observacao?: string
) {
  const [escala, alocacao, registroAberto] = await Promise.all([
    prisma.escala.findFirst({
      where: { id: escalaId, tenantId, ativo: true },
      select: { id: true, nome: true },
    }),
    prisma.escalaMedico.findFirst({
      where: { tenantId, escalaId, medicoId, ativo: true },
      select: { id: true },
    }),
    prisma.registroPonto.findFirst({
      where: { tenantId, medicoId, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
      select: { id: true, escalaId: true, checkInAt: true },
    }),
  ]);

  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada ou inativa' };
  }

  if (!alocacao) {
    throw { statusCode: 403, message: 'Você não está alocado nesta escala' };
  }

  if (registroAberto) {
    throw { statusCode: 409, message: 'Já existe um check-in em aberto para este médico' };
  }

  const registro = await prisma.registroPonto.create({
    data: {
      tenantId,
      escalaId,
      medicoId,
      checkInAt: new Date(),
      origem: OrigemRegistroPonto.APP_MEDICO,
      observacao: observacao?.trim() || null,
    },
  });

  await createAuditLog({
    acao: 'CHECKIN_MEDICO',
    tenantId,
    medicoId,
    detalhes: { escalaId, registroPontoId: registro.id },
  });

  return registro;
}

export async function checkOutService(tenantId: string, medicoId: string, observacao?: string) {
  const registroAberto = await prisma.registroPonto.findFirst({
    where: { tenantId, medicoId, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });

  if (!registroAberto) {
    throw { statusCode: 404, message: 'Não existe check-in em aberto para checkout' };
  }

  const checkoutTime = new Date();
  if (checkoutTime <= registroAberto.checkInAt) {
    throw { statusCode: 400, message: 'Horário de checkout inválido' };
  }

  const duracaoMs = checkoutTime.getTime() - registroAberto.checkInAt.getTime();
  const duracaoMinutos = Math.max(1, Math.floor(duracaoMs / 60000));

  const registro = await prisma.registroPonto.update({
    where: { id: registroAberto.id },
    data: {
      checkOutAt: checkoutTime,
      observacao: observacao?.trim() || registroAberto.observacao,
      duracaoMinutos,
    },
  });

  await createAuditLog({
    acao: 'CHECKOUT_MEDICO',
    tenantId,
    medicoId,
    detalhes: { escalaId: registro.escalaId, registroPontoId: registro.id, duracaoMinutos },
  });

  return registro;
}

export async function getMeuDiaPontoService(tenantId: string, medicoId: string) {
  const [aberto, registros] = await Promise.all([
    prisma.registroPonto.findFirst({
      where: { tenantId, medicoId, checkOutAt: null },
      include: {
        escala: { select: { id: true, nome: true } },
      },
      orderBy: { checkInAt: 'desc' },
    }),
    prisma.registroPonto.findMany({
      where: {
        tenantId,
        medicoId,
        checkInAt: {
          gte: startOfToday(),
          lte: endOfToday(),
        },
      },
      include: {
        escala: { select: { id: true, nome: true } },
      },
      orderBy: { checkInAt: 'desc' },
    }),
  ]);

  const totalMinutos = registros.reduce((acc, item) => acc + (item.duracaoMinutos || 0), 0);

  return {
    registroAberto: aberto,
    registrosHoje: registros,
    totalMinutosHoje: totalMinutos,
  };
}

export async function listMinhasEscalasService(tenantId: string, medicoId: string) {
  const alocacoes = await prisma.escalaMedico.findMany({
    where: {
      tenantId,
      medicoId,
      ativo: true,
      escala: {
        ativo: true,
      },
    },
    select: {
      escala: {
        select: {
          id: true,
          nome: true,
          dataInicio: true,
          dataFim: true,
          ativo: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const uniqueByEscala = new Map<string, any>();
  for (const item of alocacoes) {
    if (!uniqueByEscala.has(item.escala.id)) {
      uniqueByEscala.set(item.escala.id, item.escala);
    }
  }

  return Array.from(uniqueByEscala.values());
}
