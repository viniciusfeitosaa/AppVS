import { prisma } from '../config/database';
import { intervaloDiaCivil } from './justificativa-ausencia-ponto.dia';
import { resolverValorCheioPlantao } from './justificativa-ausencia-ponto.valor';

jest.mock('../config/database', () => ({
  prisma: {
    escalaPlantao: { findFirst: jest.fn() },
    escala: { findFirst: jest.fn() },
    valorPlantao: { findMany: jest.fn() },
    escalaMedico: { findFirst: jest.fn() },
    tipoPlantao: { findMany: jest.fn() },
  },
}));

const mockFindFirstPlantao = prisma.escalaPlantao.findFirst as jest.Mock;
const mockFindFirstEscala = prisma.escala.findFirst as jest.Mock;
const mockFindManyValorPlantao = prisma.valorPlantao.findMany as jest.Mock;
const mockFindFirstEscalaMedico = prisma.escalaMedico.findFirst as jest.Mock;
const mockFindManyTipoPlantao = prisma.tipoPlantao.findMany as jest.Mock;

const tenantId = 'tenant-1';
const escalaPlantaoId = 'plantao-1';
const escalaId = 'escala-1';
const medicoId = 'medico-1';
const contratoId = 'contrato-1';

function mockPlantaoBase(overrides: Record<string, unknown> = {}) {
  mockFindFirstPlantao.mockResolvedValue({
    id: escalaPlantaoId,
    escalaId,
    medicoId,
    gradeId: 'mt',
    valorHora: null,
    horasTurnoSnapshot: null,
    data: new Date('2026-08-13T00:00:00.000Z'),
    ...overrides,
  } as never);
  mockFindFirstEscala.mockResolvedValue({
    contratoAtivo: { id: contratoId },
  } as never);
  mockFindManyTipoPlantao.mockResolvedValue([]);
}

describe('intervaloDiaCivil', () => {
  it('retorna início e fim do dia civil local', () => {
    const data = new Date('2026-08-13T15:30:00');
    const { gte, lte } = intervaloDiaCivil(data);
    expect(gte.getHours()).toBe(0);
    expect(gte.getMinutes()).toBe(0);
    expect(gte.getSeconds()).toBe(0);
    expect(lte.getHours()).toBe(23);
    expect(lte.getMinutes()).toBe(59);
    expect(lte.getSeconds()).toBe(59);
    expect(gte.getDate()).toBe(data.getDate());
    expect(lte.getDate()).toBe(data.getDate());
  });
});

describe('resolverValorCheioPlantao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usa EscalaPlantao.valorHora como total quando > 0', async () => {
    mockPlantaoBase({ valorHora: 1200 });

    expect(await resolverValorCheioPlantao(tenantId, escalaPlantaoId)).toBe(1200);
    expect(mockFindManyValorPlantao).not.toHaveBeenCalled();
    expect(mockFindFirstEscalaMedico).not.toHaveBeenCalled();
  });

  it('usa max ValorPlantao do grade/contrato quando plantão sem valor', async () => {
    mockPlantaoBase({ gradeId: 'tipo-uuid' });
    mockFindManyValorPlantao.mockResolvedValue([
      { valorHora: 800 },
      { valorHora: 950 },
    ]);

    expect(await resolverValorCheioPlantao(tenantId, escalaPlantaoId)).toBe(950);
    expect(mockFindFirstEscalaMedico).not.toHaveBeenCalled();
  });

  it('usa EscalaMedico.valorHora × horasTurno quando plantão sem valor', async () => {
    mockPlantaoBase({ horasTurnoSnapshot: 12 });
    mockFindManyValorPlantao.mockResolvedValue([]);
    mockFindFirstEscalaMedico.mockResolvedValue({ valorHora: 100 });

    expect(await resolverValorCheioPlantao(tenantId, escalaPlantaoId)).toBe(1200);
  });

  it('retorna null quando não há fonte de valor', async () => {
    mockPlantaoBase();
    mockFindManyValorPlantao.mockResolvedValue([]);
    mockFindFirstEscalaMedico.mockResolvedValue({ valorHora: null });

    expect(await resolverValorCheioPlantao(tenantId, escalaPlantaoId)).toBeNull();
  });

  it('retorna null quando plantão não existe', async () => {
    mockFindFirstPlantao.mockResolvedValue(null);

    expect(await resolverValorCheioPlantao(tenantId, escalaPlantaoId)).toBeNull();
  });
});
