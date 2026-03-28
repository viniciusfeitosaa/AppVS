import { OrigemRegistroPonto, Prisma, type TipoPlantao } from '@prisma/client';
import { prisma } from '../config/database';
import { PONTO_SEM_ESCALA_ESCALA_ID } from '../constants/ponto.const';
import { fileExistsSafe, resolveStoredFileToAbsolute } from '../utils/upload-path.util';
import { createAuditLog } from './auditoria.service';
import { fimPlantaoAsDate, inicioPlantaoAsDate } from '../utils/plantao-horario';
import {
  enrichPlantaoComTipo,
  faixaHorarioLabelExibicao,
  loadTiposMapPorContrato,
  scheduleForGradeId,
} from './tipo-plantao.service';
import { calcularRepasseCongeladoCheckout } from './repasse-registro-ponto.service';
import { isMissingDatabaseColumnError } from '../utils/prisma-column-error';

function isPontoSemEscalaEscalaId(escalaId: string) {
  return escalaId === PONTO_SEM_ESCALA_ESCALA_ID;
}

/** Contrato com usaPonto e sem usaEscala (ponto sem grade de plantão). */
export async function medicoTemContratoSoPonto(tenantId: string, medicoId: string): Promise<boolean> {
  const rows = await prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: {
      equipe: {
        select: {
          subgrupo: {
            select: {
              contratoSubgrupos: {
                select: {
                  contratoAtivo: { select: { usaPonto: true, usaEscala: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  for (const row of rows) {
    const css = row.equipe?.subgrupo?.contratoSubgrupos ?? [];
    for (const cs of css) {
      const c = cs.contratoAtivo;
      if (c?.usaPonto && c?.usaEscala === false) return true;
    }
  }
  return false;
}

/** Pelo menos um contrato vinculado às equipes do médico usa escala de plantão. */
export async function medicoTemContratoComEscala(tenantId: string, medicoId: string): Promise<boolean> {
  const rows = await prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: {
      equipe: {
        select: {
          subgrupo: {
            select: {
              contratoSubgrupos: {
                select: {
                  contratoAtivo: { select: { usaEscala: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  for (const row of rows) {
    const css = row.equipe?.subgrupo?.contratoSubgrupos ?? [];
    for (const cs of css) {
      if (cs.contratoAtivo?.usaEscala === true) return true;
    }
  }
  return false;
}

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

/** Contratos com escala + ponto: check-in só entre (início − 10 min) e o fim do plantão do dia. */
const MINUTOS_ANTES_INICIO_CHECKIN_PONTO_ESCALA = 10;

type ResultadoJanelaCheckinEscala = { ok: true } | { ok: false; message: string };

async function validarJanelaCheckinPlantaoEscalaHoje(
  tenantId: string,
  medicoId: string,
  escalaId: string
): Promise<ResultadoJanelaCheckinEscala> {
  const plantaoHoje = await prisma.escalaPlantao.findFirst({
    where: {
      tenantId,
      escalaId,
      medicoId,
      data: { gte: startOfToday(), lte: endOfToday() },
    },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escala: { select: { contratoAtivoId: true } },
    },
  });
  if (!plantaoHoje) {
    return { ok: false, message: 'Você não possui plantão nesta escala para hoje' };
  }
  const cid = plantaoHoje.escala?.contratoAtivoId;
  if (!cid) {
    return { ok: false, message: 'Escala sem contrato vinculado para calcular o horário do plantão.' };
  }
  const tipoMaps = await loadTiposMapPorContrato(tenantId, [cid]);
  const schedule = scheduleForGradeId(plantaoHoje.gradeId, tipoMaps.get(cid));
  const dataStr = plantaoHoje.data.toISOString().slice(0, 10);
  const inicio = inicioPlantaoAsDate(dataStr, schedule);
  const fim = fimPlantaoAsDate(dataStr, schedule);
  const now = new Date();
  const abertura = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_CHECKIN_PONTO_ESCALA * 60 * 1000);
  if (now.getTime() < abertura.getTime()) {
    const hm = abertura.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return {
      ok: false,
      message: `Check-in liberado a partir das ${hm}.`,
    };
  }
  if (now.getTime() > fim.getTime()) {
    return { ok: false, message: 'Entrada não permitida neste horário.' };
  }
  return { ok: true };
}

const startOfWeek = () => {
  const date = new Date();
  const day = date.getDay(); // 0 domingo, 1 segunda...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfWeek = () => {
  const date = startOfWeek();
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
};

export async function checkInService(
  tenantId: string,
  medicoId: string,
  escalaId: string,
  observacao?: string,
  latitude?: number | null,
  longitude?: number | null,
  fotoCheckinCaminho?: string | null,
  motivoCheckinSemFoto?: string | null
) {
  const hasFoto = !!fotoCheckinCaminho?.trim();
  const motivo = motivoCheckinSemFoto?.trim();
  if (hasFoto && motivo) {
    throw { statusCode: 400, message: 'Não envie motivo quando houver foto de check-in.' };
  }
  if (!hasFoto) {
    if (!motivo || motivo.length < 15) {
      throw {
        statusCode: 400,
        message:
          'Sem foto é obrigatório informar o motivo (mínimo 15 caracteres). Ex.: permissão de câmera negada no navegador.',
      };
    }
    if (motivo.length > 500) {
      throw { statusCode: 400, message: 'O motivo deve ter no máximo 500 caracteres.' };
    }
  }
  const registroAberto = await prisma.registroPonto.findFirst({
    where: { tenantId, medicoId, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
    select: { id: true, escalaId: true, checkInAt: true },
  });

  if (registroAberto) {
    throw { statusCode: 409, message: 'Já existe um check-in em aberto para este médico' };
  }

  if (isPontoSemEscalaEscalaId(escalaId)) {
    const pode = await medicoTemContratoSoPonto(tenantId, medicoId);
    if (!pode) {
      throw {
        statusCode: 403,
        message: 'Ponto sem escala de plantão não está disponível para o seu vínculo com o contrato.',
      };
    }
    const configGeoSemEscala = await getConfigPontoParaMedico(tenantId, medicoId, null);
    if (configGeoSemEscala) {
      if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
        throw {
          statusCode: 400,
          message:
            'É necessário informar sua localização para bater ponto neste local. Permita o acesso à localização no navegador ou no app.',
        };
      }
      const dist = distanciaMetros(
        configGeoSemEscala.latitude,
        configGeoSemEscala.longitude,
        latitude,
        longitude
      );
      if (dist > configGeoSemEscala.raioMetros) {
        throw {
          statusCode: 400,
          message: `Você está fora do raio permitido para bater ponto (distância: ${Math.round(dist)} m, raio: ${configGeoSemEscala.raioMetros} m).`,
        };
      }
    }

    return prisma.$transaction(async (tx: any) => {
      const registroAbertoTx = await tx.registroPonto.findFirst({
        where: { tenantId, medicoId, checkOutAt: null },
        orderBy: { checkInAt: 'desc' },
        select: { id: true },
      });
      if (registroAbertoTx) {
        throw { statusCode: 409, message: 'Já existe um check-in em aberto para este médico' };
      }
      const registro = await tx.registroPonto.create({
        data: {
          tenantId,
          escalaId: null,
          medicoId,
          checkInAt: new Date(),
          origem: OrigemRegistroPonto.APP_MEDICO,
          observacao: observacao?.trim() || null,
          fotoCheckinCaminho: hasFoto ? fotoCheckinCaminho!.trim() : null,
          motivoCheckinSemFoto: hasFoto ? null : motivo!,
        },
      });
      await createAuditLog(
        {
          acao: 'CHECKIN_MEDICO',
          tenantId,
          medicoId,
          detalhes: {
            escalaId: null,
            pontoSemEscala: true,
            registroPontoId: registro.id,
            checkInSemFoto: !hasFoto,
            ...(hasFoto ? {} : { motivoResumo: motivo!.slice(0, 120) }),
          },
        },
        tx
      );
      return registro;
    });
  }

  // Com escala real: check-in vinculado à escala (e plantão hoje se o contrato usa escala).
  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId, ativo: true },
    select: { id: true, nome: true, contratoAtivo: { select: { usaEscala: true, usaPonto: true } } },
  });
  if (!escala) {
    throw { statusCode: 404, message: 'Escala não encontrada ou inativa' };
  }
  if (!escala.contratoAtivo?.usaPonto) {
    throw { statusCode: 403, message: 'Ponto eletrônico não está habilitado para este contrato' };
  }

  if (escala.contratoAtivo?.usaEscala) {
    const janela = await validarJanelaCheckinPlantaoEscalaHoje(tenantId, medicoId, escalaId);
    if (!janela.ok) {
      throw { statusCode: 403, message: janela.message };
    }
  }

  const configGeo = await getConfigPontoParaMedico(tenantId, medicoId, escalaId);
  if (configGeo) {
    if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw { statusCode: 400, message: 'É necessário informar sua localização para bater ponto neste local. Permita o acesso à localização no navegador ou no app.' };
    }
    const dist = distanciaMetros(configGeo.latitude, configGeo.longitude, latitude, longitude);
    if (dist > configGeo.raioMetros) {
      throw { statusCode: 400, message: `Você está fora do raio permitido para bater ponto (distância: ${Math.round(dist)} m, raio: ${configGeo.raioMetros} m).` };
    }
  }

  return prisma.$transaction(async (tx: any) => {
    // Revalida em transação para evitar race condition (dois check-ins simultâneos)
    const registroAbertoTx = await tx.registroPonto.findFirst({
      where: { tenantId, medicoId, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
      select: { id: true },
    });

    if (registroAbertoTx) {
      throw { statusCode: 409, message: 'Já existe um check-in em aberto para este médico' };
    }

    const registro = await tx.registroPonto.create({
      data: {
        tenantId,
        escalaId,
        medicoId,
        checkInAt: new Date(),
        origem: OrigemRegistroPonto.APP_MEDICO,
        observacao: observacao?.trim() || null,
        fotoCheckinCaminho: hasFoto ? fotoCheckinCaminho!.trim() : null,
        motivoCheckinSemFoto: hasFoto ? null : motivo!,
      },
    });

    await createAuditLog(
      {
        acao: 'CHECKIN_MEDICO',
        tenantId,
        medicoId,
        detalhes: {
          escalaId: registro.escalaId,
          registroPontoId: registro.id,
          checkInSemFoto: !hasFoto,
          ...(hasFoto ? {} : { motivoResumo: motivo!.slice(0, 120) }),
        },
      },
      tx
    );

    return registro;
  });
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

  let repasseValorCongelado: number | null = null;
  if (registroAberto.escalaId) {
    try {
      repasseValorCongelado = await calcularRepasseCongeladoCheckout(tenantId, {
        escalaId: registroAberto.escalaId,
        medicoId,
        checkInAt: new Date(registroAberto.checkInAt),
        duracaoMinutos,
      });
    } catch (e) {
      console.warn('[ponto] checkout: cálculo de repasse congelado ignorado:', (e as Error)?.message ?? e);
    }
  }

  return prisma.$transaction(async (tx: any) => {
    const baseCheckoutData = {
      checkOutAt: checkoutTime,
      observacao: observacao?.trim() || registroAberto.observacao,
      duracaoMinutos,
    };
    let updated;
    try {
      updated = await tx.registroPonto.updateMany({
        where: { id: registroAberto.id, tenantId, medicoId, checkOutAt: null },
        data: {
          ...baseCheckoutData,
          ...(repasseValorCongelado != null ? { repasseValorCongelado } : {}),
        },
      });
    } catch (e) {
      if (
        isMissingDatabaseColumnError(e, 'repasse_valor_congelado') &&
        repasseValorCongelado != null
      ) {
        updated = await tx.registroPonto.updateMany({
          where: { id: registroAberto.id, tenantId, medicoId, checkOutAt: null },
          data: baseCheckoutData,
        });
      } else {
        throw e;
      }
    }

    if (updated.count !== 1) {
      throw { statusCode: 409, message: 'Checkout já foi processado ou não existe check-in em aberto.' };
    }

    const registro = await tx.registroPonto.findFirst({
      where: { id: registroAberto.id },
      select: { id: true, escalaId: true },
    });

    if (!registro) {
      throw { statusCode: 404, message: 'Registro de ponto não encontrado após update.' };
    }

    await createAuditLog(
      {
        acao: 'CHECKOUT_MEDICO',
        tenantId,
        medicoId,
        detalhes: { escalaId: registro.escalaId, registroPontoId: registro.id, duracaoMinutos },
      },
      tx
    );

    return registro;
  });
}

export async function getMeuDiaPontoService(tenantId: string, medicoId: string) {
  const now = new Date();
  const hojeInicio = startOfToday();
  const hojeFim = endOfToday();
  const semanaInicio = startOfWeek();
  const semanaFim = endOfWeek();

  const [aberto, registros, registrosSemana, ultimoRegistro, temContratoComEscala] = await Promise.all([
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
          gte: hojeInicio,
          lte: hojeFim,
        },
      },
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
          gte: semanaInicio,
          lte: semanaFim,
        },
      },
      select: {
        id: true,
        checkInAt: true,
        checkOutAt: true,
        duracaoMinutos: true,
      },
    }),
    prisma.registroPonto.findFirst({
      where: { tenantId, medicoId },
      select: { id: true, checkInAt: true, checkOutAt: true },
      orderBy: { checkInAt: 'desc' },
    }),
    medicoTemContratoComEscala(tenantId, medicoId),
  ]);

  const totalMinutosHojeFechado = registros.reduce((acc, item) => acc + (item.duracaoMinutos || 0), 0);
  const minutosEmAbertoHoje =
    aberto && aberto.checkInAt >= hojeInicio
      ? Math.max(0, Math.floor((now.getTime() - new Date(aberto.checkInAt).getTime()) / 60000))
      : 0;
  const totalMinutos = totalMinutosHojeFechado + minutosEmAbertoHoje;

  const totalSemanaFechado = registrosSemana.reduce((acc, item) => acc + (item.duracaoMinutos || 0), 0);
  const minutosEmAbertoSemana = aberto
    ? Math.max(
        0,
        Math.floor(
          (now.getTime() - Math.max(new Date(aberto.checkInAt).getTime(), semanaInicio.getTime())) / 60000
        )
      )
    : 0;
  const totalMinutosSemana = totalSemanaFechado + minutosEmAbertoSemana;

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

  const plantoesHojeRows = await prisma.escalaPlantao.findMany({
    where: {
      tenantId,
      medicoId,
      data: { gte: hojeInicio, lte: hojeFim },
      escala: { ativo: true },
    },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escalaId: true,
      escala: { select: { contratoAtivoId: true } },
    },
  });
  const cidsHoje = [...new Set(plantoesHojeRows.map((p) => p.escala?.contratoAtivoId).filter(Boolean) as string[])];
  const tipoMapsHoje = await loadTiposMapPorContrato(tenantId, cidsHoje);
  const plantoesHoje = plantoesHojeRows.map((p) => {
    const cid = p.escala?.contratoAtivoId ?? '';
    const base = {
      id: p.id,
      data: p.data.toISOString().slice(0, 10),
      gradeId: p.gradeId,
      escalaId: p.escalaId,
    };
    return enrichPlantaoComTipo(base, cid, tipoMapsHoje);
  });

  return {
    registroAberto: aberto,
    registrosHoje: registros,
    totalMinutosHoje: totalMinutos,
    totalMinutosSemana,
    ultimoRegistroPonto: ultimoRegistro,
    equipeDoDia,
    minhasEquipes: minhasEquipesNomes,
    configHorario,
    exigeGeolocalizacao,
    temContratoComEscala,
    plantoesHoje,
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

  // Incluir escalas em que o médico tem plantão mas não tem EscalaMedico (ex.: foi alocado só na grade)
  const plantoesDoMedico = await prisma.escalaPlantao.findMany({
    where: { tenantId, medicoId },
    select: { escalaId: true, escala: { select: { id: true, nome: true, dataInicio: true, dataFim: true, ativo: true } } },
    distinct: ['escalaId'],
  });
  for (const p of plantoesDoMedico) {
    if (p.escala?.ativo && !uniqueByEscala.has(p.escala.id)) {
      uniqueByEscala.set(p.escala.id, { ...p.escala, equipes: [] as string[] });
    }
  }

  // Escalas em que o médico participa via equipe (EscalaEquipe + EquipeMedico), sem estar em EscalaMedico
  // — necessário para contratos só com ponto ou quando o vínculo é só pela equipe.
  const equipesDoMedico = await prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: { equipeId: true },
  });
  const meuEquipeIds = [...new Set(equipesDoMedico.map((e) => e.equipeId))];
  if (meuEquipeIds.length > 0) {
    const escalasPorEquipe = await prisma.escalaEquipe.findMany({
      where: { tenantId, equipeId: { in: meuEquipeIds } },
      select: {
        escala: {
          select: {
            id: true,
            nome: true,
            dataInicio: true,
            dataFim: true,
            ativo: true,
            contratoAtivo: { select: { usaPonto: true } },
          },
        },
      },
    });
    for (const row of escalasPorEquipe) {
      const e = row.escala;
      if (!e?.ativo || !e.contratoAtivo?.usaPonto) continue;
      if (!uniqueByEscala.has(e.id)) {
        uniqueByEscala.set(e.id, {
          id: e.id,
          nome: e.nome,
          dataInicio: e.dataInicio,
          dataFim: e.dataFim,
          ativo: e.ativo,
          equipes: [] as string[],
        });
      }
    }
  }

  const escalaIds = Array.from(uniqueByEscala.keys());
  const escalasMeta =
    escalaIds.length > 0
      ? await prisma.escala.findMany({
          where: { id: { in: escalaIds }, tenantId },
          select: { id: true, contratoAtivoId: true },
        })
      : [];
  const contratoPorEscala = new Map(escalasMeta.map((e) => [e.id, e.contratoAtivoId]));
  const contratoIdsUnicos = [...new Set(escalasMeta.map((e) => e.contratoAtivoId))];
  const tipoMapsPorContrato =
    contratoIdsUnicos.length > 0
      ? await loadTiposMapPorContrato(tenantId, contratoIdsUnicos)
      : new Map<string, Map<string, TipoPlantao>>();

  for (const escalaId of escalaIds) {
    const [equipesNaEscala, gradeIdsDoMedico] = await Promise.all([
      prisma.escalaEquipe.findMany({
        where: { tenantId, escalaId },
        select: { equipeId: true },
      }),
      prisma.escalaPlantao.findMany({
        where: { tenantId, escalaId, medicoId },
        select: { gradeId: true },
        distinct: ['gradeId'],
      }),
    ]);
    const equipeIds = new Set(equipesNaEscala.map((e) => e.equipeId));
    const minhasEquipes = await prisma.equipeMedico.findMany({
      where: { tenantId, medicoId, equipeId: { in: Array.from(equipeIds) } },
      select: { equipe: { select: { nome: true } } },
    });
    const entry = uniqueByEscala.get(escalaId);
    if (entry) {
      entry.equipes = minhasEquipes.map((em) => em.equipe.nome);
      const gids = gradeIdsDoMedico.map((p) => p.gradeId?.toLowerCase()).filter(Boolean) as string[];
      entry.gradeIds = gids;
      const cid = contratoPorEscala.get(escalaId);
      const tmap = cid ? tipoMapsPorContrato.get(cid) : undefined;
      entry.gradeFaixas = gids.map((gid) => {
        const t = tmap?.get(gid);
        return faixaHorarioLabelExibicao(gid, t ?? null);
      });
    }
  }

  const result = Array.from(uniqueByEscala.values());
  if ((await medicoTemContratoSoPonto(tenantId, medicoId)) && !result.some((e) => e.id === PONTO_SEM_ESCALA_ESCALA_ID)) {
    result.push({
      id: PONTO_SEM_ESCALA_ESCALA_ID,
      nome: 'Ponto (sem escala de plantão)',
      dataInicio: null,
      dataFim: null,
      ativo: true,
      equipes: [],
      gradeIds: [],
      gradeFaixas: [],
    });
  }
  return result;
}

/** Lista colegas (outros médicos) das mesmas equipes do médico na escala informada, para troca de plantão. */
export async function listEquipeColegasService(
  tenantId: string,
  medicoId: string,
  escalaId: string
) {
  // Fail-closed: se a escala/contrato não permite troca, não expor lista de colegas.
  const escala = await prisma.escala.findFirst({
    where: { tenantId, id: escalaId, ativo: true },
    select: { id: true, contratoAtivo: { select: { permiteTrocaPlantao: true } } },
  });
  if (!escala?.contratoAtivo?.permiteTrocaPlantao) return [];

  const equipesNaEscala = await prisma.escalaEquipe.findMany({
    where: { tenantId, escalaId },
    select: { equipeId: true },
  });
  const equipeIds = equipesNaEscala.map((e) => e.equipeId);
  const meuEquipeIds = await prisma.equipeMedico.findMany({
    where: { tenantId, medicoId, equipeId: { in: equipeIds } },
    select: { equipeId: true },
  });
  const idsEquipesQueParticipo = new Set(meuEquipeIds.map((e) => e.equipeId));
  if (idsEquipesQueParticipo.size === 0) return [];

  const colegas = await prisma.equipeMedico.findMany({
    where: {
      tenantId,
      equipeId: { in: Array.from(idsEquipesQueParticipo) },
      medicoId: { not: medicoId },
      medico: { ativo: true },
    },
    select: {
      medicoId: true,
      medico: {
        select: { id: true, nomeCompleto: true, crm: true },
      },
    },
    distinct: ['medicoId'],
  });

  return colegas
    .filter((c) => c.medico)
    .map((c) => ({
      id: c.medico!.id,
      nomeCompleto: c.medico!.nomeCompleto,
      crm: c.medico!.crm,
    }));
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Próximos plantões do médico (data >= hoje), ordenados por data, no máximo 2. Apenas escalas ativas. */
export async function listProximosPlantoesService(tenantId: string, medicoId: string, limit = 2) {
  const hoje = startOfDay(new Date());
  const plantoes = await prisma.escalaPlantao.findMany({
    where: {
      tenantId,
      medicoId,
      data: { gte: hoje },
      escala: { ativo: true },
    },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escalaId: true,
      escala: {
        select: {
          nome: true,
          contratoAtivoId: true,
          contratoAtivo: { select: { permiteTrocaPlantao: true, usaPonto: true, usaEscala: true } },
        },
      },
    },
    orderBy: { data: 'asc' },
    take: limit,
  });

  const cids = [...new Set(plantoes.map((p) => p.escala?.contratoAtivoId).filter(Boolean) as string[])];
  const tipoMaps = await loadTiposMapPorContrato(tenantId, cids);

  return plantoes.map((p) => {
    const cid = p.escala?.contratoAtivoId ?? '';
    const base = {
      id: p.id,
      data: p.data.toISOString().slice(0, 10),
      gradeId: p.gradeId,
      escalaId: p.escalaId,
      escalaNome: p.escala?.nome ?? null,
      permiteTrocaPlantao: !!p.escala?.contratoAtivo?.permiteTrocaPlantao,
      usaPonto: !!p.escala?.contratoAtivo?.usaPonto,
      usaEscala: !!p.escala?.contratoAtivo?.usaEscala,
    };
    return enrichPlantaoComTipo(base, cid, tipoMaps);
  });
}

/** Plantões do médico em um mês (calendário). Escala ativa. */
export async function listMeusPlantoesMesCalendarioService(
  tenantId: string,
  medicoId: string,
  ano: number,
  mes: number,
  equipeIds?: string[]
) {
  if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
    throw { statusCode: 400, message: 'Período inválido' };
  }
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);

  let escalaIdFilter: string[] | undefined = undefined;
  if (equipeIds && equipeIds.length > 0) {
    // Fail-closed: só considera equipeIds em que o médico realmente participa.
    const equipesDoMedico = await prisma.equipeMedico.findMany({
      where: { tenantId, medicoId, equipeId: { in: equipeIds } },
      select: { equipeId: true },
    });

    const allowedEquipeIds = equipesDoMedico.map((e) => e.equipeId);
    if (allowedEquipeIds.length === 0) {
      return [];
    }

    const escalasPorEquipe = await prisma.escalaEquipe.findMany({
      where: { tenantId, equipeId: { in: allowedEquipeIds } },
      select: { escalaId: true },
    });

    const allowedEscalaIds = Array.from(new Set(escalasPorEquipe.map((e) => e.escalaId)));
    if (allowedEscalaIds.length === 0) {
      return [];
    }

    escalaIdFilter = allowedEscalaIds;
  }

  const plantoes = await prisma.escalaPlantao.findMany({
    where: {
      tenantId,
      medicoId,
      data: { gte: inicio, lte: fim },
      escala: { ativo: true },
      ...(escalaIdFilter ? { escalaId: { in: escalaIdFilter } } : {}),
    },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escalaId: true,
      escala: {
        select: {
          nome: true,
          contratoAtivoId: true,
          contratoAtivo: { select: { permiteTrocaPlantao: true } },
        },
      },
    },
    orderBy: [{ data: 'asc' }, { gradeId: 'asc' }],
  });

  const cids = [...new Set(plantoes.map((p) => p.escala?.contratoAtivoId).filter(Boolean) as string[])];
  const tipoMaps = await loadTiposMapPorContrato(tenantId, cids);

  return plantoes.map((p) => {
    const cid = p.escala?.contratoAtivoId ?? '';
    const base = {
      id: p.id,
      data: p.data.toISOString().slice(0, 10),
      gradeId: p.gradeId,
      escalaId: p.escalaId,
      escalaNome: p.escala?.nome ?? null,
      permiteTrocaPlantao: !!p.escala?.contratoAtivo?.permiteTrocaPlantao,
    };
    return enrichPlantaoComTipo(base, cid, tipoMaps);
  });
}

/** Lista as equipes em que o médico participa (para o filtro do calendário). */
export async function listMinhasEquipesCalendarioService(tenantId: string, medicoId: string) {
  const rows = await prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: {
      equipeId: true,
      equipe: { select: { nome: true } },
    },
    orderBy: { equipe: { nome: 'asc' } },
  });

  return rows
    .filter((r) => !!r.equipeId && !!r.equipe?.nome)
    .map((r) => ({
      id: r.equipeId,
      nome: r.equipe.nome,
    }));
}

const MINUTOS_ANTES_INICIO_PARA_TROCA = 10;

/**
 * Registra solicitação de troca: notifica colega e solicitante (não altera escala_plantoes).
 */
export async function solicitarTrocaPlantaoService(
  tenantId: string,
  medicoSolicitanteId: string,
  plantaoId: string,
  medicoDestinoId: string
) {
  if (medicoSolicitanteId === medicoDestinoId) {
    throw { statusCode: 400, message: 'Selecione outro profissional para a troca' };
  }

  const plantao = await prisma.escalaPlantao.findFirst({
    where: { id: plantaoId, tenantId, medicoId: medicoSolicitanteId },
    select: {
      id: true,
      data: true,
      gradeId: true,
      escalaId: true,
      escala: {
        select: {
          nome: true,
          ativo: true,
          contratoAtivoId: true,
          contratoAtivo: { select: { permiteTrocaPlantao: true } },
        },
      },
    },
  });

  if (!plantao) {
    throw { statusCode: 404, message: 'Plantão não encontrado' };
  }
  if (!plantao.escala.ativo) {
    throw { statusCode: 400, message: 'Escala inativa' };
  }
  if (!plantao.escala.contratoAtivo?.permiteTrocaPlantao) {
    throw { statusCode: 403, message: 'Troca de plantão não permitida para este contrato' };
  }

  const dataStr = plantao.data.toISOString().slice(0, 10);
  const tipoMaps = await loadTiposMapPorContrato(tenantId, [plantao.escala.contratoAtivoId]);
  const tipoMap = tipoMaps.get(plantao.escala.contratoAtivoId);
  const schedule = scheduleForGradeId(plantao.gradeId, tipoMap);
  const inicio = inicioPlantaoAsDate(dataStr, schedule);
  const limiteTroca = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_TROCA * 60 * 1000);
  if (new Date() >= limiteTroca) {
    throw { statusCode: 400, message: 'Período para solicitar troca encerrado' };
  }
  const tipoRow = tipoMap?.get(plantao.gradeId);
  const gradeLabel = faixaHorarioLabelExibicao(plantao.gradeId, tipoRow ?? null);

  const colegas = await listEquipeColegasService(tenantId, medicoSolicitanteId, plantao.escalaId);
  if (!colegas.some((c) => c.id === medicoDestinoId)) {
    throw { statusCode: 403, message: 'Profissional não pertence às mesmas equipes nesta escala' };
  }

  const [solicitante, destino] = await Promise.all([
    prisma.medico.findFirst({
      where: { id: medicoSolicitanteId, tenantId, ativo: true },
      select: { nomeCompleto: true },
    }),
    prisma.medico.findFirst({
      where: { id: medicoDestinoId, tenantId, ativo: true },
      select: { nomeCompleto: true },
    }),
  ]);

  if (!solicitante || !destino) {
    throw { statusCode: 404, message: 'Profissional não encontrado' };
  }

  const solicitacao = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const row = await tx.solicitacaoTrocaPlantao.create({
      data: {
        tenantId,
        escalaPlantaoId: plantao.id,
        medicoSolicitanteId,
        medicoDestinoId,
      },
    });
    await createAuditLog(
      {
        acao: 'SOLICITAR_TROCA_PLANTAO',
        tenantId,
        medicoId: medicoSolicitanteId,
        detalhes: {
          solicitacaoId: row.id,
          plantaoId: plantao.id,
          escalaId: plantao.escalaId,
          medicoDestinoId,
        },
      },
      tx
    );
    return row;
  });

  try {
    const { notificarTrocaPlantaoSolicitada } = await import('./notificacao-medico.service');
    await notificarTrocaPlantaoSolicitada(tenantId, {
      solicitacaoId: solicitacao.id,
      medicoSolicitanteId,
      medicoDestinoId,
      solicitanteNome: solicitante.nomeCompleto.trim(),
      destinoNome: destino.nomeCompleto.trim(),
      plantaoId: plantao.id,
      escalaId: plantao.escalaId,
      escalaNome: plantao.escala.nome,
      dataPlantaoIso: dataStr,
      gradeLabel,
    });
  } catch (e) {
    console.error('[troca-plantao] Falha ao enviar notificações (registro persistido):', e);
  }

  return { ok: true as const, solicitacaoId: solicitacao.id };
}

function mimeFromFotoPath(fotoPath: string): string {
  const lower = fotoPath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Foto de check-in: apenas o próprio médico (mesmo tenant). */
export async function getFotoCheckinRegistroForMedico(tenantId: string, medicoId: string, registroId: string) {
  const r = await prisma.registroPonto.findFirst({
    where: { id: registroId, tenantId, medicoId },
    select: { fotoCheckinCaminho: true },
  });
  if (!r?.fotoCheckinCaminho?.trim()) {
    throw { statusCode: 404, message: 'Registro sem foto de check-in' };
  }
  const fullPath = resolveStoredFileToAbsolute(r.fotoCheckinCaminho);
  if (!fileExistsSafe(fullPath)) {
    throw { statusCode: 404, message: 'Arquivo não encontrado no servidor' };
  }
  return { path: fullPath, mimeType: mimeFromFotoPath(r.fotoCheckinCaminho) };
}

/** Foto de check-in: master com acesso ao relatório (tenant). */
export async function getFotoCheckinRegistroForAdmin(tenantId: string, registroId: string) {
  const r = await prisma.registroPonto.findFirst({
    where: { id: registroId, tenantId },
    select: { fotoCheckinCaminho: true },
  });
  if (!r?.fotoCheckinCaminho?.trim()) {
    throw { statusCode: 404, message: 'Registro sem foto de check-in' };
  }
  const fullPath = resolveStoredFileToAbsolute(r.fotoCheckinCaminho);
  if (!fileExistsSafe(fullPath)) {
    throw { statusCode: 404, message: 'Arquivo não encontrado no servidor' };
  }
  return { path: fullPath, mimeType: mimeFromFotoPath(r.fotoCheckinCaminho) };
}

export async function canCheckInService(tenantId: string, medicoId: string, escalaId: string) {
  if (isPontoSemEscalaEscalaId(escalaId)) {
    const ok = await medicoTemContratoSoPonto(tenantId, medicoId);
    return {
      allowed: ok,
      reason: ok
        ? null
        : ('Ponto sem escala de plantão não está disponível para o seu vínculo com o contrato.' as const),
    };
  }

  const escala = await prisma.escala.findFirst({
    where: { id: escalaId, tenantId, ativo: true },
    select: {
      id: true,
      contratoAtivo: { select: { usaEscala: true, usaPonto: true } },
    },
  });
  if (!escala) {
    return { allowed: false, reason: 'Escala não encontrada ou inativa' as const };
  }
  if (!escala.contratoAtivo?.usaPonto) {
    return { allowed: false, reason: 'Ponto eletrônico não está habilitado para este contrato' as const };
  }
  if (escala.contratoAtivo?.usaEscala) {
    const janela = await validarJanelaCheckinPlantaoEscalaHoje(tenantId, medicoId, escalaId);
    if (!janela.ok) {
      return { allowed: false, reason: janela.message };
    }
  }
  return { allowed: true, reason: null };
}
