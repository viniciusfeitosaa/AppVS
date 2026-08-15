import { ModuloSistema, NivelAcessoModulo, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { MODULOS_SISTEMA } from '../constants/modulos.const';
import { comparePassword, hashPassword } from '../utils/password.util';
import { loginMasterService } from './auth.service';
import {
  getNiveisModuloUsuarioService,
  possuiAcessoModuloUsuarioService,
  possuiEscritaModuloUsuarioService,
} from './acesso-modulo.service';
import { createPerfilAcessoService } from './perfil-acesso.service';
import { createUsuarioStaffService } from './usuario-staff.service';

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
    usuarioMaster: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    tenant: {
      findFirst: jest.fn(),
    },
    sessaoMaster: {
      create: jest.fn(),
    },
    acessoModuloPerfil: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
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
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  })),
}));

jest.mock('../config/env', () => ({
  __esModule: true,
  default: {
    TENANT_DEFAULT_SLUG: 'default',
    BCRYPT_ROUNDS: '12',
  },
}));

const mockPerfilFindFirst = prisma.perfilAcesso.findFirst as jest.Mock;
const mockPerfilCreate = prisma.perfilAcesso.create as jest.Mock;
const mockUsuarioFindFirst = prisma.usuarioMaster.findFirst as jest.Mock;
const mockUsuarioCreate = prisma.usuarioMaster.create as jest.Mock;
const mockTenantFindFirst = prisma.tenant.findFirst as jest.Mock;
const mockSessaoCreate = prisma.sessaoMaster.create as jest.Mock;
const mockHash = hashPassword as jest.Mock;
const mockCompare = comparePassword as jest.Mock;

const tenantId = 'tenant-1';
const masterId = 'master-pleno-1';
const staffId = 'staff-1';
const perfilId = 'perfil-escalista-1';
const staffEmail = 'escalista@example.com';
const staffSenha = 'SenhaForte123!';

function gradeEscalista(nivelEscalas: NivelAcessoModulo) {
  return MODULOS_SISTEMA.map((modulo) => ({
    modulo,
    nivel:
      modulo === ModuloSistema.ESCALAS
        ? nivelEscalas
        : modulo === ModuloSistema.PERFIL
          ? NivelAcessoModulo.VER
          : NivelAcessoModulo.OFF,
  }));
}

describe('gate Task10 — cenário 1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTenantFindFirst.mockResolvedValue({ id: tenantId, slug: 'default', ativo: true });
    mockSessaoCreate.mockResolvedValue({ id: 'sessao-1' });
  });

  it('admin cria perfil Escalista ESCALAS=EDITAR e usuário staff; login staff OK', async () => {
    mockPerfilFindFirst.mockResolvedValueOnce(null);
    mockPerfilCreate.mockImplementation(async ({ data }: { data: any }) => ({
      id: perfilId,
      tenantId,
      nome: data.nome,
      descricao: data.descricao ?? null,
      ativo: data.ativo ?? true,
      modulos: data.modulos.create,
      _count: { usuarios: 0 },
    }));

    const perfil = await createPerfilAcessoService(tenantId, masterId, {
      nome: 'Escalista',
      modulos: [{ modulo: ModuloSistema.ESCALAS, nivel: NivelAcessoModulo.EDITAR }],
    });

    expect(perfil.id).toBe(perfilId);
    const escalas = (perfil as any).modulos.find(
      (m: { modulo: ModuloSistema }) => m.modulo === ModuloSistema.ESCALAS
    );
    expect(escalas?.nivel).toBe(NivelAcessoModulo.EDITAR);

    mockPerfilFindFirst.mockResolvedValueOnce({
      id: perfilId,
      tenantId,
      ativo: true,
      nome: 'Escalista',
    });
    mockUsuarioFindFirst.mockResolvedValueOnce(null);
    mockUsuarioCreate.mockImplementation(async ({ data }: { data: any }) => ({
      id: staffId,
      tenantId: data.tenantId,
      nome: data.nome,
      email: data.email,
      ativo: data.ativo ?? true,
      perfilAcessoId: data.perfilAcessoId,
      createdAt: new Date(),
      updatedAt: new Date(),
      perfilAcesso: { id: perfilId, nome: 'Escalista', ativo: true },
    }));

    const staff = await createUsuarioStaffService(tenantId, masterId, {
      nome: 'Ana Escalista',
      email: staffEmail,
      senha: staffSenha,
      perfilAcessoId: perfil.id,
    });

    expect(mockHash).toHaveBeenCalledWith(staffSenha);
    expect(staff.perfilAcessoId).toBe(perfilId);

    mockUsuarioFindFirst.mockResolvedValueOnce({
      id: staffId,
      tenantId,
      email: staffEmail,
      nome: 'Ana Escalista',
      senhaHash: `hashed:${staffSenha}`,
      ativo: true,
      role: UserRole.MASTER,
      perfilAcessoId: perfilId,
      perfilAcesso: { id: perfilId, ativo: true, nome: 'Escalista' },
    });
    mockCompare.mockResolvedValue(true);

    const login = await loginMasterService(staffEmail, staffSenha);

    expect(login.accessToken).toBe('access-token');
    expect(login.refreshToken).toBe('refresh-token');
    expect(login.user.id).toBe(staffId);
    expect(login.user.email).toBe(staffEmail);
    expect(mockSessaoCreate).toHaveBeenCalled();
  });
});

describe('gate Task10 — cenário 2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTenantFindFirst.mockResolvedValue({ id: tenantId, slug: 'default', ativo: true });
    mockSessaoCreate.mockResolvedValue({ id: 'sessao-1' });
  });

  it('login staff com perfil ativo retorna tokens', async () => {
    mockUsuarioFindFirst.mockResolvedValue({
      id: staffId,
      tenantId,
      email: staffEmail,
      nome: 'Ana Escalista',
      senhaHash: `hashed:${staffSenha}`,
      ativo: true,
      role: UserRole.MASTER,
      perfilAcessoId: perfilId,
      perfilAcesso: { id: perfilId, ativo: true, nome: 'Escalista' },
    });
    mockCompare.mockResolvedValue(true);

    const login = await loginMasterService(staffEmail, staffSenha);

    expect(login.accessToken).toBeTruthy();
    expect(login.refreshToken).toBeTruthy();
    expect(login.user.role).toBe(UserRole.MASTER);
  });

  it('staff Escalista: map só ESCALAS+PERFIL ≥ VER; resto OFF; isAdminPleno=false', async () => {
    mockUsuarioFindFirst.mockResolvedValue({
      id: staffId,
      tenantId,
      ativo: true,
      perfilAcessoId: perfilId,
      perfilAcesso: {
        id: perfilId,
        tenantId,
        ativo: true,
        modulos: gradeEscalista(NivelAcessoModulo.EDITAR),
      },
    });

    const r = await getNiveisModuloUsuarioService(tenantId, staffId, UserRole.MASTER);

    expect(r.isAdminPleno).toBe(false);
    expect(r.map.ESCALAS).toBe(NivelAcessoModulo.EDITAR);
    expect(r.map.PERFIL).toBe(NivelAcessoModulo.VER);
    expect(r.map.MEDICOS).toBe(NivelAcessoModulo.OFF);
    expect(r.map.CONFIGURACOES).toBe(NivelAcessoModulo.OFF);
    expect(r.map.DASHBOARD).toBe(NivelAcessoModulo.OFF);
    for (const modulo of MODULOS_SISTEMA) {
      if (modulo === ModuloSistema.ESCALAS || modulo === ModuloSistema.PERFIL) continue;
      expect(r.map[modulo]).toBe(NivelAcessoModulo.OFF);
    }
  });
});

describe('gate Task10 — cenário 4 (níveis EDITAR)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('staff com ESCALAS=EDITAR: leitura e escrita true', async () => {
    mockUsuarioFindFirst.mockResolvedValue({
      id: staffId,
      tenantId,
      ativo: true,
      perfilAcessoId: perfilId,
      perfilAcesso: {
        id: perfilId,
        tenantId,
        ativo: true,
        modulos: [
          { modulo: ModuloSistema.ESCALAS, nivel: NivelAcessoModulo.EDITAR },
          { modulo: ModuloSistema.PERFIL, nivel: NivelAcessoModulo.VER },
        ],
      },
    });

    expect(
      await possuiAcessoModuloUsuarioService(tenantId, staffId, UserRole.MASTER, ModuloSistema.ESCALAS)
    ).toBe(true);
    expect(
      await possuiEscritaModuloUsuarioService(tenantId, staffId, UserRole.MASTER, ModuloSistema.ESCALAS)
    ).toBe(true);
  });
});
