import { prisma } from '../config/database';
import { resolveProducaoMedicoNaEscala, batchResolveProducaoMedicoNasEscalas } from '../utils/producao-subgrupo.util';
import {
  criarJustificativaAusenciaPonto,
  listMinhasJustificativas,
  listPlantoesElegiveisJustificativa,
} from './justificativa-ausencia-ponto.service';

jest.mock('../config/database', () => ({
  prisma: {
    escalaPlantao: { findFirst: jest.fn(), findMany: jest.fn() },
    registroPonto: { findFirst: jest.fn(), findMany: jest.fn() },
    justificativaAusenciaPonto: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    tipoPlantao: { findMany: jest.fn() },
  },
}));

jest.mock('../utils/producao-subgrupo.util', () => ({
  resolveProducaoMedicoNaEscala: jest.fn(),
  batchResolveProducaoMedicoNasEscalas: jest.fn(),
}));

const mockPlantaoFindFirst = prisma.escalaPlantao.findFirst as jest.Mock;
const mockPlantaoFindMany = prisma.escalaPlantao.findMany as jest.Mock;
const mockRegistroFindFirst = prisma.registroPonto.findFirst as jest.Mock;
const mockJustificativaFindFirst = prisma.justificativaAusenciaPonto.findFirst as jest.Mock;
const mockJustificativaFindMany = prisma.justificativaAusenciaPonto.findMany as jest.Mock;
const mockJustificativaCreate = prisma.justificativaAusenciaPonto.create as jest.Mock;
const mockTipoFindMany = prisma.tipoPlantao.findMany as jest.Mock;
const mockResolveProducao = resolveProducaoMedicoNaEscala as jest.Mock;
const mockBatchProducao = batchResolveProducaoMedicoNasEscalas as jest.Mock;

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
    // findMany de registros fechados / justificativas bloqueantes via queries batch
    (prisma.registroPonto.findMany as jest.Mock).mockResolvedValue([]);
    mockJustificativaFindMany.mockResolvedValue([]);

    const list = await listPlantoesElegiveisJustificativa(tenantId, medicoId);

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(escalaPlantaoId);
    expect(list[0].horarioOficialInicio).toBeInstanceOf(Date);
    expect(list[0].horarioOficialFim).toBeInstanceOf(Date);
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
