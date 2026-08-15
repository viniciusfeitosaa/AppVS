import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { comparePassword, hashPassword } from '../utils/password.util';
import {
  createUsuarioStaffService,
  listUsuariosStaffService,
  updateUsuarioStaffService,
} from './usuario-staff.service';
import { loginMasterService } from './auth.service';

jest.mock('../config/database', () => ({
  prisma: {
    usuarioMaster: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    perfilAcesso: {
      findFirst: jest.fn(),
    },
    tenant: {
      findFirst: jest.fn(),
    },
    sessaoMaster: {
      create: jest.fn(),
    },
  },
}));

jest.mock('./auditoria.service', () => ({
  createAuditLog: jest.fn(),
}));

jest.mock('../utils/password.util', () => ({
  hashPassword: jest.fn(async (p: string) => `hashed:${p}`),
  comparePassword: jest.fn(),
}));

jest.mock('../utils/jwt.util', () => ({
  generateTokens: jest.fn(async () => ({
    accessToken: 'access',
    refreshToken: 'refresh',
  })),
}));

jest.mock('../config/env', () => ({
  __esModule: true,
  default: {
    TENANT_DEFAULT_SLUG: 'default',
    BCRYPT_ROUNDS: '12',
  },
}));

const mockFindMany = prisma.usuarioMaster.findMany as jest.Mock;
const mockFindFirst = prisma.usuarioMaster.findFirst as jest.Mock;
const mockCreate = prisma.usuarioMaster.create as jest.Mock;
const mockUpdate = prisma.usuarioMaster.update as jest.Mock;
const mockCount = prisma.usuarioMaster.count as jest.Mock;
const mockPerfilFindFirst = prisma.perfilAcesso.findFirst as jest.Mock;
const mockTenantFindFirst = prisma.tenant.findFirst as jest.Mock;
const mockHash = hashPassword as jest.Mock;
const mockCompare = comparePassword as jest.Mock;

const tenantId = 'tenant-1';
const masterId = 'master-pleno-1';

describe('usuario-staff.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create staff com perfilAcessoId e senha hasheada', async () => {
    mockPerfilFindFirst.mockResolvedValue({
      id: 'perfil-1',
      tenantId,
      ativo: true,
      nome: 'Escalista',
    });
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockImplementation(async ({ data }: { data: any }) => ({
      id: 'staff-1',
      tenantId: data.tenantId,
      nome: data.nome,
      email: data.email,
      ativo: data.ativo ?? true,
      perfilAcessoId: data.perfilAcessoId,
      createdAt: new Date(),
      updatedAt: new Date(),
      perfilAcesso: { id: 'perfil-1', nome: 'Escalista', ativo: true },
    }));

    const created = await createUsuarioStaffService(tenantId, masterId, {
      nome: 'Ana Staff',
      email: 'ana@example.com',
      senha: 'SenhaForte123!',
      perfilAcessoId: 'perfil-1',
    });

    expect(mockHash).toHaveBeenCalledWith('SenhaForte123!');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId,
          nome: 'Ana Staff',
          email: 'ana@example.com',
          senhaHash: 'hashed:SenhaForte123!',
          perfilAcessoId: 'perfil-1',
          role: UserRole.MASTER,
          ativo: true,
        }),
      })
    );
    expect(created.id).toBe('staff-1');
    expect(created).not.toHaveProperty('senhaHash');

    mockFindMany.mockResolvedValue([
      {
        id: 'staff-1',
        nome: 'Ana Staff',
        email: 'ana@example.com',
        ativo: true,
        perfilAcessoId: 'perfil-1',
        perfilAcesso: { id: 'perfil-1', nome: 'Escalista', ativo: true },
      },
    ]);
    const list = await listUsuariosStaffService(tenantId);
    expect(list).toHaveLength(1);
    expect(list[0].email).toBe('ana@example.com');
  });

  it('não demota o último admin pleno do tenant', async () => {
    mockFindFirst.mockResolvedValue({
      id: masterId,
      tenantId,
      nome: 'Admin',
      email: 'admin@example.com',
      ativo: true,
      perfilAcessoId: null,
    });
    mockCount.mockResolvedValue(1);

    await expect(
      updateUsuarioStaffService(tenantId, masterId, masterId, {
        perfilAcessoId: 'perfil-1',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/último|ultimo|pleno/i),
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('loginMasterService bloqueios perfil/usuário', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTenantFindFirst.mockResolvedValue({ id: tenantId, slug: 'default', ativo: true });
  });

  it('login falha com 401 se perfil de acesso estiver inativo', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'staff-1',
      tenantId,
      email: 'staff@example.com',
      nome: 'Staff',
      senhaHash: 'hashed',
      ativo: true,
      role: UserRole.MASTER,
      perfilAcessoId: 'perfil-1',
      perfilAcesso: { id: 'perfil-1', ativo: false, nome: 'Escalista' },
    });
    mockCompare.mockResolvedValue(true);

    await expect(loginMasterService('staff@example.com', 'SenhaForte123!')).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringMatching(/perfil|inativo/i),
    });
  });

  it('login falha com 401 se usuário estiver inativo', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'staff-1',
      tenantId,
      email: 'staff@example.com',
      nome: 'Staff',
      senhaHash: 'hashed',
      ativo: false,
      role: UserRole.MASTER,
      perfilAcessoId: 'perfil-1',
      perfilAcesso: { id: 'perfil-1', ativo: true, nome: 'Escalista' },
    });
    mockCompare.mockResolvedValue(true);

    await expect(loginMasterService('staff@example.com', 'SenhaForte123!')).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringMatching(/inativo|usuário|usuario/i),
    });
  });
});
