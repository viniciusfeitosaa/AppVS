import { OrigemRegistroPonto, Prisma, type TipoPlantao } from '@prisma/client';
import { prisma } from '../config/database';
import { PONTO_SEM_ESCALA_ESCALA_ID } from '../constants/ponto.const';
import { fileExistsSafe, resolveStoredFileToAbsolute } from '../utils/upload-path.util';
import { createAuditLog } from './auditoria.service';
import { fimPlantaoAsDate, inicioPlantaoAsDate } from '../utils/plantao-horario';
import {
  enrichPlantaoComTipo,
  faixaHorarioLabelExibicao,
  loadTiposMapPorContratoLeitura,
  scheduleForGradeId,
} from './tipo-plantao.service';
import { calcularRepasseCongeladoCheckout } from './repasse-registro-ponto.service';
import { isMissingDatabaseColumnError } from '../utils/prisma-column-error';
import {
  pickGeoConfigParaEscala,
  pickGeoConfigSemEscala,
  type MedicoEquipeGeoLinha,
} from '../utils/ponto-geo-config.util';

function isPontoSemEscalaEscalaId(escalaId: string) {
  return escalaId === PONTO_SEM_ESCALA_ESCALA_ID;
}

/** Contrato com usaPonto e sem usaEscala (ponto sem grade de plantão). */
export async function medicoTemContratoSoPonto(tenantId: string, medicoId: string): Promise<boolean> {
  const row = await prisma.equipeMedico.findFirst({
    where: {
      tenantId,
      medicoId,
      equipe: {
        subgrupo: {
          contratoSubgrupos: {
            some: { contratoAtivo: { usaPonto: true, usaEscala: false } },
          },
        },
      },
    },
    select: { id: true },
  });
  return !!row;
}

/** Pelo menos um contrato vinculado às equipes do médico usa escala de plantão. */
export async function medicoTemContratoComEscala(tenantId: string, medicoId: string): Promise<boolean> {
  const row = await prisma.equipeMedico.findFirst({
    where: {
      tenantId,
      medicoId,
      equipe: {
        subgrupo: {
          contratoSubgrupos: { some: { contratoAtivo: { usaEscala: true } } },
        },
      },
    },
    select: { id: true },
  });
  return !!row;
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

type PreloadedMedicoEquipesGeo = MedicoEquipeGeoLinha[];

/** Retorna a config de ponto (com geolocalização) que se aplica ao médico, ou null. */
async function getConfigPontoParaMedico(
  tenantId: string,
  medicoId: string,
  escalaId: string | null,
  preloadedMedicoEquipes?: PreloadedMedicoEquipesGeo
): Promise<{ latitude: number; longitude: number; raioMetros: number } | null> {
  const medicoEquipes: MedicoEquipeGeoLinha[] =
    preloadedMedicoEquipes ??
    (
      await prisma.equipeMedico.findMany({
        where: { tenantId, medicoId },
        select: { equipeId: true, equipe: { select: { subgrupoId: true } } },
      })
    ).map((r) => ({ equipeId: r.equipeId, subgrupoId: r.equipe.subgrupoId ?? null }));

  if (medicoEquipes.length === 0) return null;

  if (escalaId) {
    const [escala, equipesNaEscala] = await Promise.all([
      prisma.escala.findFirst({
        where: { id: escalaId, tenantId },
        select: { contratoAtivoId: true },
      }),
      prisma.escalaEquipe.findMany({
        where: { tenantId, escalaId },
        select: { equipeId: true },
      }),
    ]);
    if (!escala?.contratoAtivoId) return null;
    const equipeIdsEscala = new Set(equipesNaEscala.map((e) => e.equipeId));
    const candidatos = medicoEquipes.filter(
      (em) => equipeIdsEscala.has(em.equipeId) && em.subgrupoId
    );
    if (candidatos.length === 0) return null;

    const configs = await prisma.configPontoEletronico.findMany({
      where: {
        tenantId,
        contratoAtivoId: escala.contratoAtivoId,
        OR: candidatos.map((em) => ({
          equipeId: em.equipeId,
          subgrupoId: em.subgrupoId!,
        })),
        latitude: { not: null },
        longitude: { not: null },
        raioMetros: { not: null },
      },
      select: {
        equipeId: true,
        subgrupoId: true,
        latitude: true,
        longitude: true,
        raioMetros: true,
      },
    });
    return pickGeoConfigParaEscala(candidatos, configs);
  }

  const equipeIdsList = medicoEquipes.map((e) => e.equipeId);
  const configs = await prisma.configPontoEletronico.findMany({
    where: {
      tenantId,
      equipeId: { in: equipeIdsList },
      latitude: { not: null },
      longitude: { not: null },
      raioMetros: { not: null },
    },
    select: {
      equipeId: true,
      subgrupoId: true,
      latitude: true,
      longitude: true,
      raioMetros: true,
    },
  });
  return pickGeoConfigSemEscala(medicoEquipes, configs);
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

type LinhaPlantaoJanelaCheckin = {
  id: string;
  data: Date;
  gradeId: string;
  escala: { contratoAtivoId: string | null };
};

/**
 * Mesma prioridade que `escolherPlantaoMaisRelevante` no app (em andamento → próximo → último que acabou).
 * Evita `findFirst` sem ordem quando há mais de um grade no mesmo dia na escala.
 */
function escolherPlantaoParaJanelaCheckinHoje(
  lista: LinhaPlantaoJanelaCheckin[],
  tipoMaps: Awaited<ReturnType<typeof loadTiposMapPorContratoLeitura>>,
  at: Date
): LinhaPlantaoJanelaCheckin | null {
  if (lista.length === 0) return null;
  if (lista.length === 1) return lista[0];

  const scored = lista.map((p) => {
    const cid = p.escala?.contratoAtivoId ?? '';
    const schedule = scheduleForGradeId(p.gradeId, tipoMaps.get(cid));
    const dataStr = p.data.toISOString().slice(0, 10);
    const inicio = inicioPlantaoAsDate(dataStr, schedule);
    const fim = fimPlantaoAsDate(dataStr, schedule);
    return { p, inicio, fim };
  });

  const t = at.getTime();
  const emAndamento = scored.find((s) => t >= s.inicio.getTime() && t <= s.fim.getTime());
  if (emAndamento) return emAndamento.p;

  const futuros = scored
    .filter((s) => s.inicio.getTime() > t)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  if (futuros.length > 0) return futuros[0].p;

  const passados = scored
    .filter((s) => s.fim.getTime() < t)
    .sort((a, b) => b.fim.getTime() - a.fim.getTime());
  return passados[0]?.p ?? lista[0];
}

async function validarJanelaCheckinPlantaoEscalaHoje(
  tenantId: string,
  medicoId: string,
  escalaId: string
): Promise<ResultadoJanelaCheckinEscala> {
  const plantoesHoje = await prisma.escalaPlantao.findMany({
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
  if (!plantoesHoje.length) {
    return { ok: false, message: 'Você não possui plantão nesta escala para hoje' };
  }
  const cid = plantoesHoje[0].escala?.contratoAtivoId;
  if (!cid) {
    return { ok: false, message: 'Escala sem contrato vinculado para calcular o horário do plantão.' };
  }
  const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, [cid]);
  const plantaoHoje = escolherPlantaoParaJanelaCheckinHoje(plantoesHoje, tipoMaps, new Date());
  if (!plantaoHoje) {
    return { ok: false, message: 'Você não possui plantão nesta escala para hoje' };
  }
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

type CacheEntry<T> = { exp: number; value: T };
const CACHE_TTL_MS = Math.max(0, parseInt(process.env.PONTO_CACHE_TTL_MS || '', 10) || 10_000);
const meuDiaCache = new Map<string, CacheEntry<unknown>>();
const minhasEscalasCache = new Map<string, CacheEntry<unknown>>();

function cacheKey(tenantId: string, medicoId: string) {
  return `${tenantId}:${medicoId}`;
}

function getCached<T>(m: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = m.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    m.delete(key);
    return null;
  }
  return hit.value;
}

function setCached<T>(m: Map<string, CacheEntry<T>>, key: string, value: T) {
  m.set(key, { exp: Date.now() + CACHE_TTL_MS, value });
}

function clearPontoCaches(tenantId: string, medicoId: string) {
  const key = cacheKey(tenantId, medicoId);
  meuDiaCache.delete(key);
  minhasEscalasCache.delete(key);
}

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
      clearPontoCaches(tenantId, medicoId);
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

    clearPontoCaches(tenantId, medicoId);
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

    clearPontoCaches(tenantId, medicoId);
    return registro;
  });
}

export async function getMeuDiaPontoService(tenantId: string, medicoId: string) {
  if (CACHE_TTL_MS > 0) {
    const hit = getCached(meuDiaCache, cacheKey(tenantId, medicoId));
    if (hit) return hit as any;
  }

  const now = new Date();
  const hojeInicio = startOfToday();
  const hojeFim = endOfToday();
  const semanaInicio = startOfWeek();
  const semanaFim = endOfWeek();

  const [aberto, registrosSemanaCompletos, ultimoRegistro, temContratoComEscala] = await Promise.all([
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
          gte: semanaInicio,
          lte: semanaFim,
        },
      },
      include: {
        escala: { select: { id: true, nome: true } },
      },
      orderBy: { checkInAt: 'desc' },
    }),
    prisma.registroPonto.findFirst({
      where: { tenantId, medicoId },
      select: { id: true, checkInAt: true, checkOutAt: true },
      orderBy: { checkInAt: 'desc' },
    }),
    medicoTemContratoComEscala(tenantId, medicoId),
  ]);

  const registros = registrosSemanaCompletos.filter(
    (r) => r.checkInAt >= hojeInicio && r.checkInAt <= hojeFim
  );
  const registrosSemana = registrosSemanaCompletos.map((r) => ({
    id: r.id,
    checkInAt: r.checkInAt,
    checkOutAt: r.checkOutAt,
    duracaoMinutos: r.duracaoMinutos,
  }));

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

  const escalaEquipeDoDiaP = aberto?.escalaId
    ? prisma.escalaEquipe.findMany({
        where: { tenantId, escalaId: aberto.escalaId },
        select: { equipeId: true },
      })
    : Promise.resolve([] as Array<{ equipeId: string }>);

  const minhasEquipesP = prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: {
      equipeId: true,
      equipe: { select: { nome: true, subgrupoId: true } },
    },
    orderBy: { equipe: { nome: 'asc' } },
  });

  const plantoesHojeRowsP = prisma.escalaPlantao.findMany({
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

  const [equipesNaEscalaRows, minhasEquipes, plantoesHojeRows] = await Promise.all([
    escalaEquipeDoDiaP,
    minhasEquipesP,
    plantoesHojeRowsP,
  ]);

  const equipeIdsNaEscala = new Set(equipesNaEscalaRows.map((e) => e.equipeId));
  const equipeDoDia: string[] =
    aberto?.escalaId != null
      ? minhasEquipes.filter((em) => equipeIdsNaEscala.has(em.equipeId)).map((em) => em.equipe.nome)
      : [];

  const minhasEquipesNomes = minhasEquipes.map((em) => em.equipe.nome);
  const equipeIds = minhasEquipes.map((em) => em.equipeId);
  const medicoEquipesGeo: MedicoEquipeGeoLinha[] = minhasEquipes.map((em) => ({
    equipeId: em.equipeId,
    subgrupoId: em.equipe.subgrupoId ?? null,
  }));

  const configHorarioP =
    equipeIds.length > 0
      ? prisma.configPontoEletronico.findFirst({
          where: { tenantId, equipeId: { in: equipeIds } },
          select: { horarioEntrada: true, horarioSaida: true },
        })
      : Promise.resolve(null);

  const configGeoP = getConfigPontoParaMedico(
    tenantId,
    medicoId,
    aberto?.escalaId ?? null,
    medicoEquipesGeo
  );

  const [configRow, configGeo] = await Promise.all([configHorarioP, configGeoP]);

  let configHorario: { horarioEntrada: string | null; horarioSaida: string | null } = {
    horarioEntrada: null,
    horarioSaida: null,
  };
  if (configRow) {
    configHorario = {
      horarioEntrada: configRow.horarioEntrada ?? null,
      horarioSaida: configRow.horarioSaida ?? null,
    };
  }

  const exigeGeolocalizacao = configGeo != null;
  const cidsHoje = [...new Set(plantoesHojeRows.map((p) => p.escala?.contratoAtivoId).filter(Boolean) as string[])];
  const tipoMapsHoje = await loadTiposMapPorContratoLeitura(tenantId, cidsHoje);
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

  const payload = {
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
  if (CACHE_TTL_MS > 0) {
    setCached(meuDiaCache, cacheKey(tenantId, medicoId), payload);
  }
  return payload;
}

export async function listMinhasEscalasService(tenantId: string, medicoId: string) {
  if (CACHE_TTL_MS > 0) {
    const hit = getCached(minhasEscalasCache, cacheKey(tenantId, medicoId));
    if (hit) return hit as any;
  }

  const alocacoesP = prisma.escalaMedico.findMany({
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

  /** groupBy evita varrer todos os plantões do médico (findMany+distinct ficava O(n) com histórico grande). */
  const plantoesEscalaIdsP = prisma.escalaPlantao.groupBy({
    by: ['escalaId'],
    where: { tenantId, medicoId },
  });

  const equipesDoMedicoP = prisma.equipeMedico.findMany({
    where: { tenantId, medicoId },
    select: { equipeId: true },
  });

  const temSoPontoP = medicoTemContratoSoPonto(tenantId, medicoId);

  const [alocacoes, plantoesEscalaIds, equipesDoMedico, temContratoSoPontoFlag] = await Promise.all([
    alocacoesP,
    plantoesEscalaIdsP,
    equipesDoMedicoP,
    temSoPontoP,
  ]);

  const uniqueByEscala = new Map<string, any>();
  for (const item of alocacoes) {
    if (!uniqueByEscala.has(item.escala.id)) {
      uniqueByEscala.set(item.escala.id, { ...item.escala, equipes: [] as string[] });
    }
  }

  const escalaIdsDePlantoes = plantoesEscalaIds.map((r) => r.escalaId).filter(Boolean) as string[];
  if (escalaIdsDePlantoes.length > 0) {
    const escalasDePlantoes = await prisma.escala.findMany({
      where: { tenantId, id: { in: escalaIdsDePlantoes }, ativo: true },
      select: { id: true, nome: true, dataInicio: true, dataFim: true, ativo: true },
    });
    for (const e of escalasDePlantoes) {
      if (!uniqueByEscala.has(e.id)) {
        uniqueByEscala.set(e.id, { ...e, equipes: [] as string[] });
      }
    }
  }

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
      ? await loadTiposMapPorContratoLeitura(tenantId, contratoIdsUnicos)
      : new Map<string, Map<string, TipoPlantao>>();

  // Evita N+1: buscar equipes/grades em lote para todas as escalas do médico.
  const [equipesNaEscalaRows, plantoesGradeRows] = await Promise.all([
    escalaIds.length > 0
      ? prisma.escalaEquipe.findMany({
          where: { tenantId, escalaId: { in: escalaIds } },
          select: { escalaId: true, equipeId: true },
        })
      : Promise.resolve([] as Array<{ escalaId: string; equipeId: string }>),
    escalaIds.length > 0
      ? prisma.escalaPlantao.findMany({
          where: { tenantId, medicoId, escalaId: { in: escalaIds } },
          select: { escalaId: true, gradeId: true },
        })
      : Promise.resolve([] as Array<{ escalaId: string; gradeId: string }>),
  ]);

  const equipeIdsAll = Array.from(new Set(equipesNaEscalaRows.map((r) => r.equipeId)));
  const minhasEquipesRows =
    equipeIdsAll.length > 0
      ? await prisma.equipeMedico.findMany({
          where: { tenantId, medicoId, equipeId: { in: equipeIdsAll } },
          select: { equipeId: true, equipe: { select: { nome: true } } },
        })
      : [];
  const equipeNomePorId = new Map(minhasEquipesRows.map((r) => [r.equipeId, r.equipe.nome]));

  const equipeIdsPorEscala = new Map<string, Set<string>>();
  for (const row of equipesNaEscalaRows) {
    let set = equipeIdsPorEscala.get(row.escalaId);
    if (!set) {
      set = new Set<string>();
      equipeIdsPorEscala.set(row.escalaId, set);
    }
    set.add(row.equipeId);
  }

  const gradeIdsPorEscala = new Map<string, Set<string>>();
  for (const row of plantoesGradeRows) {
    const gid = (row.gradeId || '').toLowerCase().trim();
    if (!gid) continue;
    let set = gradeIdsPorEscala.get(row.escalaId);
    if (!set) {
      set = new Set<string>();
      gradeIdsPorEscala.set(row.escalaId, set);
    }
    set.add(gid);
  }

  for (const escalaId of escalaIds) {
    const entry = uniqueByEscala.get(escalaId);
    if (!entry) continue;

    const eids = Array.from(equipeIdsPorEscala.get(escalaId) ?? []);
    entry.equipes = eids.map((id) => equipeNomePorId.get(id)).filter(Boolean);

    const gids = Array.from(gradeIdsPorEscala.get(escalaId) ?? []);
    entry.gradeIds = gids;

    const cid = contratoPorEscala.get(escalaId);
    const tmap = cid ? tipoMapsPorContrato.get(cid) : undefined;
    entry.gradeFaixas = gids.map((gid) => {
      const t = tmap?.get(gid);
      return faixaHorarioLabelExibicao(gid, t ?? null);
    });
  }

  const result = Array.from(uniqueByEscala.values());
  if (temContratoSoPontoFlag && !result.some((e) => e.id === PONTO_SEM_ESCALA_ESCALA_ID)) {
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
  if (CACHE_TTL_MS > 0) {
    setCached(minhasEscalasCache, cacheKey(tenantId, medicoId), result);
  }
  return result;
}

/**
 * Uma ida ao banco em paralelo: dados do dia + escalas (tela Ponto Eletrônico).
 * Reduz round-trips HTTP quando o cliente usa um único GET.
 */
const painelTiming = process.env.MEDICO_DASHBOARD_TIMING === '1';

export async function getPainelPontoEletronicoInicialService(tenantId: string, medicoId: string) {
  const t0 = Date.now();
  const [meuDia, escalas] = await Promise.all([
    (async () => {
      const t = Date.now();
      const r = await getMeuDiaPontoService(tenantId, medicoId);
      if (painelTiming) console.log(`[medico/dashboard]   └ meuDia ${Date.now() - t}ms`);
      return r;
    })(),
    (async () => {
      const t = Date.now();
      const r = await listMinhasEscalasService(tenantId, medicoId);
      if (painelTiming) console.log(`[medico/dashboard]   └ minhasEscalas ${Date.now() - t}ms`);
      return r;
    })(),
  ]);
  if (painelTiming) {
    console.log(`[medico/dashboard] painel interno ${Date.now() - t0}ms (paralelo meuDia+escalas)`);
  }
  return { meuDia, escalas };
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
  const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, cids);

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
  const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, cids);

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
const STATUS_TROCA_PENDENTE = 'PENDENTE';
const STATUS_TROCA_ACEITA = 'ACEITA';
const STATUS_TROCA_RECUSADA = 'RECUSADA';

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
  const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, [plantao.escala.contratoAtivoId]);
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
        status: STATUS_TROCA_PENDENTE,
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

export async function listTrocasPlantaoPendentesService(tenantId: string, medicoId: string) {
  const rows = await prisma.solicitacaoTrocaPlantao.findMany({
    where: {
      tenantId,
      status: STATUS_TROCA_PENDENTE,
      OR: [{ medicoDestinoId: medicoId }, { medicoSolicitanteId: medicoId }],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      solicitante: { select: { id: true, nomeCompleto: true } },
      destino: { select: { id: true, nomeCompleto: true } },
      plantao: {
        select: {
          id: true,
          data: true,
          gradeId: true,
          escalaId: true,
          escala: { select: { nome: true } },
        },
      },
    },
  });

  const mapRow = (r: (typeof rows)[number]) => ({
    id: r.id,
    createdAt: r.createdAt,
    plantaoId: r.plantao.id,
    dataPlantao: r.plantao.data,
    escalaId: r.plantao.escalaId,
    escalaNome: r.plantao.escala?.nome ?? null,
    gradeId: r.plantao.gradeId,
    solicitante: { id: r.solicitante.id, nomeCompleto: r.solicitante.nomeCompleto },
    destino: { id: r.destino.id, nomeCompleto: r.destino.nomeCompleto },
  });

  return {
    recebidas: rows.filter((r) => r.medicoDestinoId === medicoId).map(mapRow),
    enviadas: rows.filter((r) => r.medicoSolicitanteId === medicoId).map(mapRow),
  };
}

export async function aceitarTrocaPlantaoService(tenantId: string, medicoId: string, solicitacaoId: string) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const solic = await tx.solicitacaoTrocaPlantao.findFirst({
      where: { id: solicitacaoId, tenantId, medicoDestinoId: medicoId },
      include: { plantao: { include: { escala: { select: { contratoAtivoId: true } } } } },
    });
    if (!solic) throw { statusCode: 404, message: 'Solicitação não encontrada' };
    if (solic.status !== STATUS_TROCA_PENDENTE) {
      throw { statusCode: 400, message: 'Solicitação já respondida' };
    }

    const tipoMaps = await loadTiposMapPorContratoLeitura(tenantId, [solic.plantao.escala.contratoAtivoId]);
    const schedule = scheduleForGradeId(
      solic.plantao.gradeId,
      tipoMaps.get(solic.plantao.escala.contratoAtivoId)
    );
    const inicio = inicioPlantaoAsDate(solic.plantao.data.toISOString().slice(0, 10), schedule);
    const limiteTroca = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_TROCA * 60 * 1000);
    if (new Date() >= limiteTroca) {
      throw { statusCode: 400, message: 'Período para aceitar troca encerrado' };
    }

    const updatedPlantao = await tx.escalaPlantao.updateMany({
      where: { id: solic.escalaPlantaoId, tenantId, medicoId: solic.medicoSolicitanteId },
      data: { medicoId: solic.medicoDestinoId },
    });
    if (updatedPlantao.count === 0) {
      throw { statusCode: 409, message: 'Plantão já não pertence mais ao solicitante' };
    }

    await tx.solicitacaoTrocaPlantao.update({
      where: { id: solic.id },
      data: { status: STATUS_TROCA_ACEITA, respondidaEm: now },
    });

    await tx.solicitacaoTrocaPlantao.updateMany({
      where: {
        tenantId,
        escalaPlantaoId: solic.escalaPlantaoId,
        id: { not: solic.id },
        status: STATUS_TROCA_PENDENTE,
      },
      data: { status: STATUS_TROCA_RECUSADA, respondidaEm: now },
    });

    return solic;
  });

  await createAuditLog({
    acao: 'ACEITAR_TROCA_PLANTAO',
    tenantId,
    medicoId,
    detalhes: {
      solicitacaoId,
      plantaoId: result.escalaPlantaoId,
      medicoSolicitanteId: result.medicoSolicitanteId,
      medicoDestinoId: result.medicoDestinoId,
    },
  });

  return { ok: true as const };
}

export async function recusarTrocaPlantaoService(tenantId: string, medicoId: string, solicitacaoId: string) {
  const row = await prisma.solicitacaoTrocaPlantao.findFirst({
    where: { id: solicitacaoId, tenantId, medicoDestinoId: medicoId },
    select: { id: true, status: true, escalaPlantaoId: true, medicoSolicitanteId: true, medicoDestinoId: true },
  });
  if (!row) throw { statusCode: 404, message: 'Solicitação não encontrada' };
  if (row.status !== STATUS_TROCA_PENDENTE) throw { statusCode: 400, message: 'Solicitação já respondida' };

  await prisma.solicitacaoTrocaPlantao.update({
    where: { id: row.id },
    data: { status: STATUS_TROCA_RECUSADA, respondidaEm: new Date() },
  });

  await createAuditLog({
    acao: 'RECUSAR_TROCA_PLANTAO',
    tenantId,
    medicoId,
    detalhes: {
      solicitacaoId,
      plantaoId: row.escalaPlantaoId,
      medicoSolicitanteId: row.medicoSolicitanteId,
      medicoDestinoId: row.medicoDestinoId,
    },
  });

  return { ok: true as const };
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
