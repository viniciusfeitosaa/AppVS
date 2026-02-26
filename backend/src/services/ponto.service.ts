import { OrigemRegistroPonto } from '@prisma/client';
import { prisma } from '../config/database';
import { createAuditLog } from './auditoria.service';

/** Distância em metros entre dois pontos (fórmula de Haversine). */
function distanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // raio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Retorna a config de ponto (com geolocalização) que se aplica ao médico, ou null. */
async function getConfigPontoParaMedico(
  tenantId: string,
  medicoId: string,
  escalaId: string | null
): Promise<{ latitude: number; longitude: number; raioMetros: number } | null> {
  const medicoEquipes = await prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: { equipeId: true, equipe: { select: { subgrupoId: true } } },
  });
  if (medicoEquipes.length === 0) return null;

  let config: { latitude: unknown; longitude: unknown; raioMetros: number | null } | null = null;

  if (escalaId) {
    const escala = await prisma.escala.findFirst({
      where: { id: escalaId, tenantId },
      select: { contratoAtivoId: true },
    });
    if (!escala) return null;
    const equipesNaEscala = await prisma.escalaEquipe.findMany({
      where: { tenantId, escalaId },
      select: { equipeId: true },
    });
    const equipeIdsEscala = new Set(equipesNaEscala.map((e) => e.equipeId));
    for (const em of medicoEquipes) {
      if (!equipeIdsEscala.has(em.equipeId) || !em.equipe.subgrupoId) continue;
      const c = await prisma.configPontoEletronico.findFirst({
        where: {
          tenantId,
          contratoAtivoId: escala.contratoAtivoId,
          subgrupoId: em.equipe.subgrupoId,
          equipeId: em.equipeId,
          latitude: { not: null },
          longitude: { not: null },
          raioMetros: { not: null },
        },
        select: { latitude: true, longitude: true, raioMetros: true },
      });
      if (c?.latitude != null && c?.longitude != null && c?.raioMetros != null) {
        config = c;
        break;
      }
    }
  } else {
    for (const em of medicoEquipes) {
      const c = await prisma.configPontoEletronico.findFirst({
        where: {
          tenantId,
          equipeId: em.equipeId,
          latitude: { not: null },
          longitude: { not: null },
          raioMetros: { not: null },
        },
        select: { latitude: true, longitude: true, raioMetros: true },
      });
      if (c?.latitude != null && c?.longitude != null && c?.raioMetros != null) {
        config = c;
        break;
      }
    }
  }

  if (!config) return null;
  const lat = Number(config.latitude);
  const lon = Number(config.longitude);
  const raio = config.raioMetros ?? 0;
  if (Number.isNaN(lat) || Number.isNaN(lon) || raio <= 0) return null;
  return { latitude: lat, longitude: lon, raioMetros: raio };
}

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
  escalaId: string | undefined,
  observacao?: string,
  latitude?: number | null,
  longitude?: number | null
) {
  const registroAberto = await prisma.registroPonto.findFirst({
    where: { tenantId, medicoId, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
    select: { id: true, escalaId: true, checkInAt: true },
  });

  if (registroAberto) {
    throw { statusCode: 409, message: 'Já existe um check-in em aberto para este médico' };
  }

  if (escalaId) {
    const [escala, alocacao] = await Promise.all([
      prisma.escala.findFirst({
        where: { id: escalaId, tenantId, ativo: true },
        select: { id: true, nome: true },
      }),
      prisma.escalaMedico.findFirst({
        where: { tenantId, escalaId, medicoId, ativo: true },
        select: { id: true },
      }),
    ]);

    if (!escala) {
      throw { statusCode: 404, message: 'Escala não encontrada ou inativa' };
    }

    if (!alocacao) {
      throw { statusCode: 403, message: 'Você não está alocado nesta escala' };
    }
  }

  const configGeo = await getConfigPontoParaMedico(tenantId, medicoId, escalaId ?? null);
  if (configGeo) {
    if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw { statusCode: 400, message: 'É necessário informar sua localização para bater ponto neste local. Permita o acesso à localização no navegador ou no app.' };
    }
    const dist = distanciaMetros(configGeo.latitude, configGeo.longitude, latitude, longitude);
    if (dist > configGeo.raioMetros) {
      throw { statusCode: 400, message: `Você está fora do raio permitido para bater ponto (distância: ${Math.round(dist)} m, raio: ${configGeo.raioMetros} m).` };
    }
  }

  const registro = await prisma.registroPonto.create({
    data: {
      tenantId,
      escalaId: escalaId || null,
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
    detalhes: { escalaId: registro.escalaId, registroPontoId: registro.id },
  });

  return registro;
}

export async function checkOutService(
  tenantId: string,
  medicoId: string,
  observacao?: string,
  latitude?: number | null,
  longitude?: number | null
) {
  const registroAberto = await prisma.registroPonto.findFirst({
    where: { tenantId, medicoId, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });

  if (!registroAberto) {
    throw { statusCode: 404, message: 'Não existe check-in em aberto para checkout' };
  }

  const configGeo = await getConfigPontoParaMedico(tenantId, medicoId, registroAberto.escalaId);
  if (configGeo) {
    if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw { statusCode: 400, message: 'É necessário informar sua localização para bater ponto neste local. Permita o acesso à localização no navegador ou no app.' };
    }
    const dist = distanciaMetros(configGeo.latitude, configGeo.longitude, latitude, longitude);
    if (dist > configGeo.raioMetros) {
      throw { statusCode: 400, message: `Você está fora do raio permitido para bater ponto (distância: ${Math.round(dist)} m, raio: ${configGeo.raioMetros} m).` };
    }
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

  let equipeDoDia: string[] = [];
  if (aberto?.escalaId) {
    const equipesNaEscala = await prisma.escalaEquipe.findMany({
      where: { tenantId, escalaId: aberto.escalaId },
      select: { equipeId: true },
    });
    const equipeIdsNaEscala = new Set(equipesNaEscala.map((e) => e.equipeId));
    const minhasEquipesNaEscala = await prisma.equipeMedico.findMany({
      where: { tenantId, medicoId, equipeId: { in: Array.from(equipeIdsNaEscala) } },
      select: { equipe: { select: { nome: true } } },
    });
    equipeDoDia = minhasEquipesNaEscala.map((em) => em.equipe.nome);
  }

  const minhasEquipes = await prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: { equipeId: true, equipe: { select: { nome: true } } },
    orderBy: { equipe: { nome: 'asc' } },
  });
  const minhasEquipesNomes = minhasEquipes.map((em) => em.equipe.nome);
  const equipeIds = minhasEquipes.map((em) => em.equipeId);

  let configHorario: { horarioEntrada: string | null; horarioSaida: string | null } = { horarioEntrada: null, horarioSaida: null };
  if (equipeIds.length > 0) {
    const config = await prisma.configPontoEletronico.findFirst({
      where: { tenantId, equipeId: { in: equipeIds } },
      select: { horarioEntrada: true, horarioSaida: true },
    });
    if (config) {
      configHorario = {
        horarioEntrada: config.horarioEntrada ?? null,
        horarioSaida: config.horarioSaida ?? null,
      };
    }
  }

  const configGeo = await getConfigPontoParaMedico(tenantId, medicoId, aberto?.escalaId ?? null);
  const exigeGeolocalizacao = configGeo != null;

  return {
    registroAberto: aberto,
    registrosHoje: registros,
    totalMinutosHoje: totalMinutos,
    equipeDoDia,
    minhasEquipes: minhasEquipesNomes,
    configHorario,
    exigeGeolocalizacao,
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
      uniqueByEscala.set(item.escala.id, { ...item.escala, equipes: [] as string[] });
    }
  }

  const escalaIds = Array.from(uniqueByEscala.keys());
  for (const escalaId of escalaIds) {
    const equipesNaEscala = await prisma.escalaEquipe.findMany({
      where: { tenantId, escalaId },
      select: { equipeId: true },
    });
    const equipeIds = new Set(equipesNaEscala.map((e) => e.equipeId));
    const minhasEquipes = await prisma.equipeMedico.findMany({
      where: { tenantId, medicoId, equipeId: { in: Array.from(equipeIds) } },
      select: { equipe: { select: { nome: true } } },
    });
    const entry = uniqueByEscala.get(escalaId);
    if (entry) entry.equipes = minhasEquipes.map((em) => em.equipe.nome);
  }

  return Array.from(uniqueByEscala.values());
}
