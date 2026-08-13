import { prisma } from '../config/database';
import { resolveProducaoMedicoNaEscala } from '../utils/producao-subgrupo.util';
import { temJustificativaAceitaNoDiaEscala } from './justificativa-ausencia-ponto.service';
import { checkInService } from './ponto.service';

jest.mock('./admin.service', () => ({
  getValoresPlantaoService: jest.fn(),
  listRegistrosPontoAdminService: jest.fn(),
}));

jest.mock('./repasse-registro-ponto.service', () => ({
  calcularRepasseCongeladoCheckout: jest.fn(),
}));

jest.mock('./tipo-plantao.service', () => ({
  enrichPlantaoComTipo: jest.fn(),
  faixaHorarioLabelExibicao: jest.fn(),
  loadTiposMapPorContratoLeitura: jest.fn(),
  scheduleForGradeId: jest.fn(),
}));

jest.mock('../config/database', () => ({
  prisma: {
    registroPonto: { findFirst: jest.fn(), create: jest.fn() },
    escala: { findFirst: jest.fn() },
    escalaPlantao: { findMany: jest.fn() },
    equipeMedico: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../utils/producao-subgrupo.util', () => ({
  resolveProducaoMedicoNaEscala: jest.fn(),
  batchResolveProducaoMedicoNasEscalas: jest.fn(),
}));

jest.mock('./justificativa-ausencia-ponto.service', () => ({
  temJustificativaAceitaNoDiaEscala: jest.fn(),
}));

jest.mock('./auditoria.service', () => ({
  createAuditLog: jest.fn(),
}));

const mockRegistroFindFirst = prisma.registroPonto.findFirst as jest.Mock;
const mockEscalaFindFirst = prisma.escala.findFirst as jest.Mock;
const mockPlantaoFindMany = prisma.escalaPlantao.findMany as jest.Mock;
const mockEquipeMedicoFindMany = prisma.equipeMedico.findMany as jest.Mock;
const mockResolveProducao = resolveProducaoMedicoNaEscala as jest.Mock;
const mockTemJustificativa = temJustificativaAceitaNoDiaEscala as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;

const tenantId = 'tenant-1';
const medicoId = 'medico-1';
const escalaId = 'escala-1';
const motivoSemFoto = 'Câmera indisponível no navegador do celular';

describe('checkInService — bloqueio após justificativa aceita', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistroFindFirst.mockResolvedValue(null);
    mockEscalaFindFirst.mockResolvedValue({ id: escalaId, nome: 'Escala A' });
    mockResolveProducao.mockResolvedValue({ allowPonto: true, requireJanelaPlantao: false });
    mockPlantaoFindMany.mockResolvedValue([]);
    mockEquipeMedicoFindMany.mockResolvedValue([]);
    mockTemJustificativa.mockResolvedValue(true);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  });

  it('retorna 409 quando já existe justificativa aceita no dia da escala', async () => {
    await expect(
      checkInService(tenantId, medicoId, escalaId, undefined, null, null, null, motivoSemFoto)
    ).rejects.toEqual({
      statusCode: 409,
      message: 'Este plantão já foi justificado e aprovado. Não é possível bater ponto novamente.',
    });

    expect(mockTemJustificativa).toHaveBeenCalledWith(
      tenantId,
      medicoId,
      escalaId,
      expect.any(Date)
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
