import { prisma } from '../config/database';
import { resolveProducaoMedicoNaEscala, batchResolveProducaoMedicoNasEscalas } from '../utils/producao-subgrupo.util';
import { pathForNotificacaoTipo } from '../utils/push-deep-link.util';
import { criarNotificacaoComPush, TIPO_NOTIFICACAO } from './notificacao-medico.service';
import { resolverValorCheioPlantao } from './justificativa-ausencia-ponto.valor';
import {
  aceitarJustificativa,
  criarJustificativaAusenciaPonto,
  listJustificativasAdmin,
  listMinhasJustificativas,
  listPlantoesElegiveisJustificativa,
  recusarJustificativa,
  temJustificativaAceitaNoDiaEscala,
} from './justificativa-ausencia-ponto.service';

jest.mock('../config/database', () => ({
  prisma: {
    escalaPlantao: { findFirst: jest.fn(), findMany: jest.fn() },
    registroPonto: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    justificativaAusenciaPonto: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tipoPlantao: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../utils/producao-subgrupo.util', () => ({
  resolveProducaoMedicoNaEscala: jest.fn(),
  batchResolveProducaoMedicoNasEscalas: jest.fn(),
}));

jest.mock('./justificativa-ausencia-ponto.valor', () => ({
  resolverValorCheioPlantao: jest.fn(),
}));

jest.mock('./notificacao-medico.service', () => ({
  TIPO_NOTIFICACAO: {
    JUSTIFICATIVA_PONTO_ACEITA: 'JUSTIFICATIVA_PONTO_ACEITA',
    JUSTIFICATIVA_PONTO_RECUSADA: 'JUSTIFICATIVA_PONTO_RECUSADA',
  },
  criarNotificacaoComPush: jest.fn(),
}));

const mockPlantaoFindFirst = prisma.escalaPlantao.findFirst as jest.Mock;
const mockPlantaoFindMany = prisma.escalaPlantao.findMany as jest.Mock;
const mockRegistroFindFirst = prisma.registroPonto.findFirst as jest.Mock;
const mockRegistroDeleteMany = prisma.registroPonto.deleteMany as jest.Mock;
const mockRegistroCreate = prisma.registroPonto.create as jest.Mock;
const mockRegistroDelete = prisma.registroPonto.delete as jest.Mock;
const mockJustificativaFindFirst = prisma.justificativaAusenciaPonto.findFirst as jest.Mock;
const mockJustificativaFindMany = prisma.justificativaAusenciaPonto.findMany as jest.Mock;
const mockJustificativaCreate = prisma.justificativaAusenciaPonto.create as jest.Mock;
const mockJustificativaUpdate = prisma.justificativaAusenciaPonto.update as jest.Mock;
const mockJustificativaUpdateMany = prisma.justificativaAusenciaPonto.updateMany as jest.Mock;
const mockTipoFindMany = prisma.tipoPlantao.findMany as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;
const mockResolveProducao = resolveProducaoMedicoNaEscala as jest.Mock;
const mockBatchProducao = batchResolveProducaoMedicoNasEscalas as jest.Mock;
const mockResolverValor = resolverValorCheioPlantao as jest.Mock;
const mockCriarNotif = criarNotificacaoComPush as jest.Mock;

const tenantId = 'tenant-1';
const medicoId = 'medico-1';
const escalaId = 'escala-1';
const escalaPlantaoId = 'plantao-1';
const contratoId = 'contrato-1';
const dataPlantao = new Date('2026-08-10T00:00:00.000Z');

function plantaoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: escalaPlantaoId,
    tenantId,
    escalaId,
    medicoId,
    data: dataPlantao,
    gradeId: 'mt',
    escala: { contratoAtivoId: contratoId },
    ...overrides,
  };
}

function inputBase(overrides: Record<string, unknown> = {}) {
  return {
    escalaPlantaoId,
    horarioAlegadoEntrada: new Date('2026-08-10T07:00:00'),
    horarioAlegadoSaida: new Date('2026-08-10T19:00:00'),
    motivo: 'Esqueci de bater o ponto na saída do plantão',
    ...overrides,
  };
}

describe('criarJustificativaAusenciaPonto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlantaoFindFirst.mockResolvedValue(plantaoRow());
    mockResolveProducao.mockResolvedValue({ allowPonto: true, requireJanelaPlantao: true });
    mockRegistroFindFirst.mockResolvedValue(null);
    mockJustificativaFindFirst.mockResolvedValue(null);
    mockTipoFindMany.mockResolvedValue([]);
    mockJustificativaCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'just-1',
      ...data,
    }));
  });

  it('cria justificativa PENDENTE quando sem ponto fechado', async () => {
    const created = await criarJustificativaAusenciaPonto(tenantId, medicoId, inputBase());

    expect(created.status).toBe('PENDENTE');
    expect(mockJustificativaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId,
          medicoId,
          escalaId,
          escalaPlantaoId,
          status: 'PENDENTE',
          motivo: 'Esqueci de bater o ponto na saída do plantão',
        }),
      })
    );
  });

  it('permite criar quando existe apenas check-in aberto (checkOutAt null)', async () => {
    // ponto aberto não deve ser retornado pela busca de fechado
    mockRegistroFindFirst.mockResolvedValue(null);

    const created = await criarJustificativaAusenciaPonto(tenantId, medicoId, inputBase());

    expect(created.status).toBe('PENDENTE');
    expect(mockRegistroFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          checkOutAt: { not: null },
        }),
      })
    );
  });

  it('rejeita com 409 quando já existe ponto fechado no dia civil', async () => {
    mockRegistroFindFirst.mockResolvedValue({
      id: 'reg-1',
      checkOutAt: new Date('2026-08-10T19:00:00'),
    });

    await expect(
      criarJustificativaAusenciaPonto(tenantId, medicoId, inputBase())
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mockJustificativaCreate).not.toHaveBeenCalled();
  });

  it('rejeita com 400 quando motivo tem menos de 10 caracteres', async () => {
    await expect(
      criarJustificativaAusenciaPonto(tenantId, medicoId, inputBase({ motivo: 'curto' }))
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mockJustificativaCreate).not.toHaveBeenCalled();
  });

  it('rejeita com 400 quando saída <= entrada', async () => {
    await expect(
      criarJustificativaAusenciaPonto(
        tenantId,
        medicoId,
        inputBase({
          horarioAlegadoEntrada: new Date('2026-08-10T19:00:00'),
          horarioAlegadoSaida: new Date('2026-08-10T07:00:00'),
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejeita com 409 quando já existe justificativa PENDENTE', async () => {
    mockJustificativaFindFirst.mockResolvedValue({ id: 'j-pend', status: 'PENDENTE' });

    await expect(
      criarJustificativaAusenciaPonto(tenantId, medicoId, inputBase())
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('listPlantoesElegiveisJustificativa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna plantão elegível sem ponto fechado', async () => {
    mockPlantaoFindMany.mockResolvedValue([plantaoRow()]);
    mockBatchProducao.mockResolvedValue(
      new Map([[escalaId, { allowPonto: true, requireJanelaPlantao: true }]])
    );
    mockRegistroFindFirst.mockResolvedValue(null);
    mockJustificativaFindFirst.mockResolvedValue(null);
    mockTipoFindMany.mockResolvedValue([]);
    (prisma.registroPonto.findMany as jest.Mock).mockResolvedValue([]);
    mockJustificativaFindMany.mockResolvedValue([]);

    const list = await listPlantoesElegiveisJustificativa(tenantId, medicoId);

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(escalaPlantaoId);
    expect(list[0].situacaoPonto).toBe('NENHUM');
    expect(list[0].checkInAt).toBeNull();
    expect(list[0].horarioOficialInicio).toBeInstanceOf(Date);
    expect(list[0].horarioOficialFim).toBeInstanceOf(Date);
  });

  it('marca SO_ENTRADA quando há check-in aberto no dia', async () => {
    const checkInAt = new Date('2026-08-10T07:05:00');
    mockPlantaoFindMany.mockResolvedValue([plantaoRow()]);
    mockBatchProducao.mockResolvedValue(
      new Map([[escalaId, { allowPonto: true, requireJanelaPlantao: true }]])
    );
    (prisma.registroPonto.findMany as jest.Mock).mockResolvedValue([
      { escalaId, checkInAt, checkOutAt: null },
    ]);
    mockJustificativaFindMany.mockResolvedValue([]);
    mockTipoFindMany.mockResolvedValue([]);

    const list = await listPlantoesElegiveisJustificativa(tenantId, medicoId);

    expect(list).toHaveLength(1);
    expect(list[0].situacaoPonto).toBe('SO_ENTRADA');
    expect(list[0].checkInAt).toEqual(checkInAt);
  });

  it('exclui plantão com ponto fechado no dia', async () => {
    mockPlantaoFindMany.mockResolvedValue([plantaoRow()]);
    mockBatchProducao.mockResolvedValue(
      new Map([[escalaId, { allowPonto: true, requireJanelaPlantao: true }]])
    );
    (prisma.registroPonto.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'reg-1',
        escalaId,
        checkInAt: new Date('2026-08-10T08:00:00'),
        checkOutAt: new Date('2026-08-10T18:00:00'),
      },
    ]);
    mockJustificativaFindMany.mockResolvedValue([]);
    mockTipoFindMany.mockResolvedValue([]);

    const list = await listPlantoesElegiveisJustificativa(tenantId, medicoId);

    expect(list).toHaveLength(0);
  });
});

describe('listMinhasJustificativas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista justificativas do médico ordenadas', async () => {
    mockJustificativaFindMany.mockResolvedValue([
      { id: 'j1', status: 'PENDENTE', medicoId },
      { id: 'j2', status: 'RECUSADA', medicoId },
    ]);

    const list = await listMinhasJustificativas(tenantId, medicoId);

    expect(list).toHaveLength(2);
    expect(mockJustificativaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, medicoId },
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});

const masterId = 'master-1';
const justId = 'just-1';
const entradaAlegada = new Date('2026-08-10T07:00:00');
const saidaAlegada = new Date('2026-08-10T19:00:00');

function justificativaPendente(overrides: Record<string, unknown> = {}) {
  return {
    id: justId,
    tenantId,
    medicoId,
    escalaId,
    escalaPlantaoId,
    motivo: 'Esqueci de bater o ponto na saída do plantão',
    status: 'PENDENTE',
    horarioAlegadoEntrada: entradaAlegada,
    horarioAlegadoSaida: saidaAlegada,
    escalaPlantao: {
      id: escalaPlantaoId,
      medicoId,
      data: dataPlantao,
      escalaId,
    },
    ...overrides,
  };
}

describe('aceitarJustificativa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolverValor.mockResolvedValue(1200);
    mockCriarNotif.mockResolvedValue({ id: 'notif-1' });
    mockRegistroDeleteMany.mockResolvedValue({ count: 1 });
    mockRegistroCreate.mockResolvedValue({
      id: 'reg-just',
      origem: 'JUSTIFICADO_SEM_PONTO',
      repasseValorCongelado: 1200,
    });
    mockJustificativaUpdateMany.mockResolvedValue({ count: 1 });
    mockJustificativaUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...justificativaPendente(),
      ...data,
    }));
    mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
    mockJustificativaFindFirst.mockResolvedValue(justificativaPendente());
    mockRegistroFindFirst.mockResolvedValue(null);
  });

  it('cancela ponto aberto da mesma escala (qualquer dia) e cria JUSTIFICADO_SEM_PONTO com valor cheio', async () => {
    const updated = await aceitarJustificativa(tenantId, masterId, justId);

    expect(mockRegistroDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId,
          medicoId,
          escalaId,
          checkOutAt: null,
        },
      })
    );
    const deleteWhere = mockRegistroDeleteMany.mock.calls[0][0].where;
    expect(deleteWhere.checkInAt).toBeUndefined();
    expect(mockRegistroCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          origem: 'JUSTIFICADO_SEM_PONTO',
          repasseValorCongelado: 1200,
          checkInAt: entradaAlegada,
          checkOutAt: saidaAlegada,
          duracaoMinutos: 12 * 60,
        }),
      })
    );
    expect(mockJustificativaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: justId, tenantId, status: 'PENDENTE' },
        data: expect.objectContaining({
          status: 'ACEITA',
          registroPontoId: 'reg-just',
          decididoPorMasterId: masterId,
        }),
      })
    );
    expect(updated.status).toBe('ACEITA');
    expect(mockCriarNotif).toHaveBeenCalledWith(
      expect.objectContaining({
        medicoId,
        tipo: TIPO_NOTIFICACAO.JUSTIFICATIVA_PONTO_ACEITA,
      })
    );
    expect(pathForNotificacaoTipo(TIPO_NOTIFICACAO.JUSTIFICATIVA_PONTO_ACEITA)).toBe('/historico-pontos');
  });

  it('rejeita com 409 quando já existe ponto fechado no dia', async () => {
    mockRegistroFindFirst.mockResolvedValue({ id: 'reg-fechado' });

    await expect(aceitarJustificativa(tenantId, masterId, justId)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/ponto fechado/i),
    });
    expect(mockRegistroCreate).not.toHaveBeenCalled();
    expect(mockJustificativaUpdateMany).not.toHaveBeenCalled();
  });

  it('cancela ponto aberto de outro dia civil na mesma escala', async () => {
    await aceitarJustificativa(tenantId, masterId, justId);

    const where = mockRegistroDeleteMany.mock.calls[0][0].where;
    expect(where).toEqual({
      tenantId,
      medicoId,
      escalaId,
      checkOutAt: null,
    });
    expect(where).not.toHaveProperty('checkInAt');
  });

  it('rejeita com 409 sob race (updateMany count 0) e limpa registro criado', async () => {
    mockJustificativaUpdateMany.mockResolvedValue({ count: 0 });
    mockRegistroDelete.mockResolvedValue({ id: 'reg-just' });

    await expect(aceitarJustificativa(tenantId, masterId, justId)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/pendente/i),
    });
    expect(mockRegistroDelete).toHaveBeenCalledWith({ where: { id: 'reg-just' } });
    expect(mockCriarNotif).not.toHaveBeenCalled();
  });

  it('rejeita com 400 quando não há valor de plantão', async () => {
    mockResolverValor.mockResolvedValue(null);

    await expect(aceitarJustificativa(tenantId, masterId, justId)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/valor/i),
    });
    expect(mockRegistroCreate).not.toHaveBeenCalled();
  });

  it('rejeita quando plantão.medicoId difere do médico da justificativa', async () => {
    mockJustificativaFindFirst.mockResolvedValue(
      justificativaPendente({
        escalaPlantao: {
          id: escalaPlantaoId,
          medicoId: 'outro-medico',
          data: dataPlantao,
          escalaId,
        },
      })
    );

    await expect(aceitarJustificativa(tenantId, masterId, justId)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mockRegistroCreate).not.toHaveBeenCalled();
  });

  it('não apaga ponto aberto de outra escala', async () => {
    await aceitarJustificativa(tenantId, masterId, justId);

    const where = mockRegistroDeleteMany.mock.calls[0][0].where;
    expect(where.escalaId).toBe(escalaId);
    expect(where.escalaId).not.toBe('escala-outra');
  });
});

describe('recusarJustificativa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCriarNotif.mockResolvedValue({ id: 'notif-2' });
    mockJustificativaFindFirst.mockResolvedValue(justificativaPendente());
    mockJustificativaUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...justificativaPendente(),
      ...data,
    }));
  });

  it('marca RECUSADA, notifica e não toca em ponto aberto', async () => {
    const updated = await recusarJustificativa(tenantId, masterId, justId, 'Motivo inválido');

    expect(updated.status).toBe('RECUSADA');
    expect(mockJustificativaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RECUSADA',
          comentarioMaster: 'Motivo inválido',
          decididoPorMasterId: masterId,
        }),
      })
    );
    expect(mockRegistroDeleteMany).not.toHaveBeenCalled();
    expect(mockCriarNotif).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: TIPO_NOTIFICACAO.JUSTIFICATIVA_PONTO_RECUSADA,
      })
    );
  });

  it('após recusa, plantão volta a ser elegível (sem bloqueio PENDENTE/ACEITA)', async () => {
    await recusarJustificativa(tenantId, masterId, justId);
    mockJustificativaFindFirst.mockResolvedValue(null);
    mockPlantaoFindFirst.mockResolvedValue(plantaoRow());
    mockResolveProducao.mockResolvedValue({ allowPonto: true, requireJanelaPlantao: true });
    mockRegistroFindFirst.mockResolvedValue(null);
    mockTipoFindMany.mockResolvedValue([]);
    mockJustificativaCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'just-2',
      ...data,
    }));

    const created = await criarJustificativaAusenciaPonto(tenantId, medicoId, inputBase());
    expect(created.status).toBe('PENDENTE');
  });

  it('rejeita com 409 se já foi ACEITA (não reabre)', async () => {
    mockJustificativaFindFirst.mockResolvedValue(justificativaPendente({ status: 'ACEITA' }));

    await expect(recusarJustificativa(tenantId, masterId, justId, 'tarde demais')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/pendente/i),
    });
    expect(mockJustificativaUpdate).not.toHaveBeenCalled();
  });

  it('permite recusa sem comentário (comentarioMaster null)', async () => {
    const updated = await recusarJustificativa(tenantId, masterId, justId);

    expect(updated.status).toBe('RECUSADA');
    expect(mockJustificativaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RECUSADA',
          comentarioMaster: null,
        }),
      })
    );
  });
});

/**
 * Cases do fluxo Master: deixar em aberto (PENDENTE), aceitar ou recusar.
 * Cobre decisões da fila administrativa sem fechar o pedido automaticamente.
 */
describe('fluxo Master — PENDENTE / ACEITA / RECUSADA', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolverValor.mockResolvedValue(900);
    mockCriarNotif.mockResolvedValue({ id: 'notif-x' });
    mockRegistroDeleteMany.mockResolvedValue({ count: 0 });
    mockRegistroCreate.mockResolvedValue({
      id: 'reg-just',
      origem: 'JUSTIFICADO_SEM_PONTO',
      repasseValorCongelado: 900,
    });
    mockJustificativaUpdateMany.mockResolvedValue({ count: 1 });
    mockJustificativaUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...justificativaPendente(),
      ...data,
    }));
    mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
    mockJustificativaFindFirst.mockResolvedValue(justificativaPendente());
    mockRegistroFindFirst.mockResolvedValue(null);
  });

  it('deixar em aberto: fila admin lista só PENDENTE quando filtrada', async () => {
    mockJustificativaFindMany.mockResolvedValue([justificativaPendente()]);

    const rows = await listJustificativasAdmin(tenantId, 'PENDENTE');

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('PENDENTE');
    expect(mockJustificativaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, status: 'PENDENTE' },
      })
    );
  });

  it('deixar em aberto: sem filtro lista todos os status (pendente permanece até decisão)', async () => {
    mockJustificativaFindMany.mockResolvedValue([
      justificativaPendente(),
      justificativaPendente({ id: 'j-aceita', status: 'ACEITA' }),
      justificativaPendente({ id: 'j-rec', status: 'RECUSADA' }),
    ]);

    const rows = await listJustificativasAdmin(tenantId);

    expect(rows.map((r) => r.status)).toEqual(['PENDENTE', 'ACEITA', 'RECUSADA']);
    expect(mockJustificativaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId },
      })
    );
  });

  it('aceitar: Master pode editar horários alegados antes do aceite (valor continua cheio)', async () => {
    const novaEntrada = new Date('2026-08-10T08:00:00');
    const novaSaida = new Date('2026-08-10T20:00:00');

    const updated = await aceitarJustificativa(tenantId, masterId, justId, {
      horarioAlegadoEntrada: novaEntrada,
      horarioAlegadoSaida: novaSaida,
    });

    expect(mockRegistroCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checkInAt: novaEntrada,
          checkOutAt: novaSaida,
          duracaoMinutos: 12 * 60,
          repasseValorCongelado: 900,
          origem: 'JUSTIFICADO_SEM_PONTO',
        }),
      })
    );
    expect(mockJustificativaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ACEITA',
          horarioAlegadoEntrada: novaEntrada,
          horarioAlegadoSaida: novaSaida,
        }),
      })
    );
    expect(updated.status).toBe('ACEITA');
  });

  it('aceitar: rejeita se pedido já não está PENDENTE (já ACEITA)', async () => {
    mockJustificativaFindFirst.mockResolvedValue(justificativaPendente({ status: 'ACEITA' }));

    await expect(aceitarJustificativa(tenantId, masterId, justId)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/pendente/i),
    });
    expect(mockRegistroCreate).not.toHaveBeenCalled();
  });

  it('aceitar: rejeita se pedido já foi RECUSADA', async () => {
    mockJustificativaFindFirst.mockResolvedValue(justificativaPendente({ status: 'RECUSADA' }));

    await expect(aceitarJustificativa(tenantId, masterId, justId)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/pendente/i),
    });
  });

  it('aceitar: rejeita horários inválidos editados pelo Master (saída <= entrada)', async () => {
    await expect(
      aceitarJustificativa(tenantId, masterId, justId, {
        horarioAlegadoEntrada: new Date('2026-08-10T19:00:00'),
        horarioAlegadoSaida: new Date('2026-08-10T07:00:00'),
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/saída|posterior/i),
    });
    expect(mockRegistroCreate).not.toHaveBeenCalled();
  });

  it('recusar: fecha o pedido em aberto sem criar JUSTIFICADO_SEM_PONTO', async () => {
    const updated = await recusarJustificativa(tenantId, masterId, justId, 'Documentação insuficiente');

    expect(updated.status).toBe('RECUSADA');
    expect(mockRegistroCreate).not.toHaveBeenCalled();
    expect(mockRegistroDeleteMany).not.toHaveBeenCalled();
    expect(mockCriarNotif).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: TIPO_NOTIFICACAO.JUSTIFICATIVA_PONTO_RECUSADA,
        corpo: expect.stringContaining('Documentação insuficiente'),
      })
    );
  });

  it('ciclo: PENDENTE → ACEITA notifica e não permite nova decisão', async () => {
    const aceita = await aceitarJustificativa(tenantId, masterId, justId);
    expect(aceita.status).toBe('ACEITA');

    mockJustificativaFindFirst.mockResolvedValue(justificativaPendente({ status: 'ACEITA' }));

    await expect(aceitarJustificativa(tenantId, masterId, justId)).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(recusarJustificativa(tenantId, masterId, justId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('ciclo: PENDENTE permanece listável até Master decidir (não auto-aceita)', async () => {
    mockJustificativaFindMany.mockResolvedValue([justificativaPendente()]);

    const pendentes = await listJustificativasAdmin(tenantId, 'PENDENTE');
    expect(pendentes.every((j) => j.status === 'PENDENTE')).toBe(true);

    // Sem chamar aceitar/recusar — pedido continua PENDENTE (sem update)
    expect(mockJustificativaUpdate).not.toHaveBeenCalled();
    expect(mockJustificativaUpdateMany).not.toHaveBeenCalled();
  });
});

describe('temJustificativaAceitaNoDiaEscala', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna true quando existe ACEITA no dia civil da escala', async () => {
    mockJustificativaFindFirst.mockResolvedValue({ id: justId });

    const ok = await temJustificativaAceitaNoDiaEscala(
      tenantId,
      medicoId,
      escalaId,
      new Date('2026-08-10T10:00:00')
    );

    expect(ok).toBe(true);
    expect(mockJustificativaFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          medicoId,
          escalaId,
          status: 'ACEITA',
        }),
      })
    );
  });

  it('retorna false quando não há ACEITA', async () => {
    mockJustificativaFindFirst.mockResolvedValue(null);

    const ok = await temJustificativaAceitaNoDiaEscala(
      tenantId,
      medicoId,
      escalaId,
      new Date('2026-08-10T10:00:00')
    );

    expect(ok).toBe(false);
  });
});
