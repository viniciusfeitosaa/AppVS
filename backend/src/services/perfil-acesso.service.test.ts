import { ModuloSistema, NivelAcessoModulo } from '@prisma/client';
import { prisma } from '../config/database';
import { MODULOS_SISTEMA } from '../constants/modulos.const';
import {
  createPerfilAcessoService,
  getPerfilAcessoService,
  listPerfisAcessoService,
  updatePerfilAcessoService,
} from './perfil-acesso.service';

jest.mock('../config/database', () => ({
  prisma: {
    perfilAcesso: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    perfilAcessoModulo: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
  },
}));

jest.mock('./auditoria.service', () => ({
  createAuditLog: jest.fn(),
}));

const mockFindMany = prisma.perfilAcesso.findMany as jest.Mock;
const mockFindFirst = prisma.perfilAcesso.findFirst as jest.Mock;
const mockCreate = prisma.perfilAcesso.create as jest.Mock;
const mockUpdate = prisma.perfilAcesso.update as jest.Mock;

const tenantId = 'tenant-1';
const masterId = 'master-1';

describe('perfil-acesso.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejeita CONFIGURACOES = EDITAR com 400', async () => {
    await expect(
      createPerfilAcessoService(tenantId, masterId, {
        nome: 'Escalista',
        modulos: [
          { modulo: ModuloSistema.ESCALAS, nivel: NivelAcessoModulo.EDITAR },
          { modulo: ModuloSistema.CONFIGURACOES, nivel: NivelAcessoModulo.EDITAR },
        ],
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/CONFIGURAÇÕES|CONFIGURACOES|configurações/i),
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('força PERFIL >= VER mesmo quando omitido ou OFF', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockImplementation(async ({ data }: { data: any }) => ({
      id: 'perfil-1',
      tenantId,
      nome: data.nome,
      descricao: data.descricao ?? null,
      ativo: data.ativo ?? true,
      modulos: data.modulos.create,
      _count: { usuarios: 0 },
    }));

    const created = await createPerfilAcessoService(tenantId, masterId, {
      nome: 'Escalista',
      modulos: [{ modulo: ModuloSistema.ESCALAS, nivel: NivelAcessoModulo.VER }],
    });

    const modulos = (created as any).modulos as { modulo: ModuloSistema; nivel: NivelAcessoModulo }[];
    expect(modulos).toHaveLength(MODULOS_SISTEMA.length);
    const perfil = modulos.find((m) => m.modulo === ModuloSistema.PERFIL);
    expect(perfil?.nivel).toBe(NivelAcessoModulo.VER);
    const escalas = modulos.find((m) => m.modulo === ModuloSistema.ESCALAS);
    expect(escalas?.nivel).toBe(NivelAcessoModulo.VER);
    const off = modulos.find((m) => m.modulo === ModuloSistema.MEDICOS);
    expect(off?.nivel).toBe(NivelAcessoModulo.OFF);
  });

  it('create + list retorna perfil com grade completa', async () => {
    mockFindFirst.mockResolvedValue(null);
    const createdRow = {
      id: 'perfil-1',
      tenantId,
      nome: 'Escalista',
      descricao: null,
      ativo: true,
      modulos: MODULOS_SISTEMA.map((modulo) => ({
        modulo,
        nivel:
          modulo === ModuloSistema.ESCALAS
            ? NivelAcessoModulo.EDITAR
            : modulo === ModuloSistema.PERFIL
              ? NivelAcessoModulo.VER
              : NivelAcessoModulo.OFF,
      })),
      _count: { usuarios: 0 },
    };
    mockCreate.mockResolvedValue(createdRow);
    mockFindMany.mockResolvedValue([createdRow]);

    const created = await createPerfilAcessoService(tenantId, masterId, {
      nome: 'Escalista',
      modulos: [{ modulo: ModuloSistema.ESCALAS, nivel: NivelAcessoModulo.EDITAR }],
    });
    expect(created.id).toBe('perfil-1');
    expect((created as any).modulos).toHaveLength(MODULOS_SISTEMA.length);

    const list = await listPerfisAcessoService(tenantId);
    expect(list).toHaveLength(1);
    expect(list[0].nome).toBe('Escalista');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId },
        orderBy: { nome: 'asc' },
      })
    );
  });

  it('get retorna 404 se não encontrado no tenant', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(getPerfilAcessoService(tenantId, 'missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('update rejeita CONFIGURACOES EDITAR', async () => {
    mockFindFirst.mockResolvedValue({ id: 'perfil-1', tenantId, nome: 'Escalista' });
    await expect(
      updatePerfilAcessoService(tenantId, masterId, 'perfil-1', {
        modulos: [{ modulo: ModuloSistema.CONFIGURACOES, nivel: NivelAcessoModulo.EDITAR }],
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
