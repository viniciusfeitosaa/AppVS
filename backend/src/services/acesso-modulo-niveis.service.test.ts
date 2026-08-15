import { ModuloSistema, NivelAcessoModulo, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { MODULOS_SISTEMA } from '../constants/modulos.const';
import {
  getNiveisModuloUsuarioService,
  possuiAcessoModuloUsuarioService,
  possuiEscritaModuloUsuarioService,
} from './acesso-modulo.service';

jest.mock('../config/database', () => ({
  prisma: {
    usuarioMaster: { findFirst: jest.fn() },
    acessoModuloPerfil: { findMany: jest.fn() },
  },
}));

jest.mock('./auditoria.service', () => ({
  createAuditLog: jest.fn(),
}));

const mockUsuarioFindFirst = prisma.usuarioMaster.findFirst as jest.Mock;
const mockAcessoFindMany = prisma.acessoModuloPerfil.findMany as jest.Mock;

const tenantId = 'tenant-1';
const masterId = 'master-pleno-1';
const staffId = 'staff-1';
const medicoId = 'medico-1';

describe('niveis modulo usuario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('admin pleno (perfilAcessoId null) tem EDITAR em todos os módulos listados', async () => {
    mockUsuarioFindFirst.mockResolvedValue({
      id: masterId,
      tenantId,
      ativo: true,
      perfilAcessoId: null,
      perfilAcesso: null,
    });

    const r = await getNiveisModuloUsuarioService(tenantId, masterId, UserRole.MASTER);

    expect(r.isAdminPleno).toBe(true);
    expect(r.map.ESCALAS).toBe(NivelAcessoModulo.EDITAR);
    expect(r.map.CONFIGURACOES).toBe(NivelAcessoModulo.EDITAR);
    for (const modulo of MODULOS_SISTEMA) {
      expect(r.map[modulo]).toBe(NivelAcessoModulo.EDITAR);
    }
  });

  it('staff com ESCALAS=VER e resto OFF: acesso leitura sim, escrita não', async () => {
    mockUsuarioFindFirst.mockResolvedValue({
      id: staffId,
      tenantId,
      ativo: true,
      perfilAcessoId: 'perfil-1',
      perfilAcesso: {
        id: 'perfil-1',
        tenantId,
        ativo: true,
        modulos: [
          { modulo: ModuloSistema.ESCALAS, nivel: NivelAcessoModulo.VER },
          { modulo: ModuloSistema.PERFIL, nivel: NivelAcessoModulo.VER },
        ],
      },
    });

    const r = await getNiveisModuloUsuarioService(tenantId, staffId, UserRole.MASTER);

    expect(r.isAdminPleno).toBe(false);
    expect(r.map.ESCALAS).toBe(NivelAcessoModulo.VER);
    expect(r.map.CONFIGURACOES).toBe(NivelAcessoModulo.OFF);
    expect(r.map.PERFIL).toBe(NivelAcessoModulo.VER);
    expect(await possuiAcessoModuloUsuarioService(tenantId, staffId, UserRole.MASTER, ModuloSistema.ESCALAS)).toBe(
      true
    );
    expect(await possuiEscritaModuloUsuarioService(tenantId, staffId, UserRole.MASTER, ModuloSistema.ESCALAS)).toBe(
      false
    );
  });

  it('staff com perfil inativo ou usuário inativo: sem acesso', async () => {
    mockUsuarioFindFirst.mockResolvedValue({
      id: staffId,
      tenantId,
      ativo: false,
      perfilAcessoId: 'perfil-1',
      perfilAcesso: {
        id: 'perfil-1',
        tenantId,
        ativo: true,
        modulos: [{ modulo: ModuloSistema.ESCALAS, nivel: NivelAcessoModulo.EDITAR }],
      },
    });

    let r = await getNiveisModuloUsuarioService(tenantId, staffId, UserRole.MASTER);
    expect(r.isAdminPleno).toBe(false);
    expect(r.map.ESCALAS).toBe(NivelAcessoModulo.OFF);
    expect(await possuiAcessoModuloUsuarioService(tenantId, staffId, UserRole.MASTER, ModuloSistema.ESCALAS)).toBe(
      false
    );

    mockUsuarioFindFirst.mockResolvedValue({
      id: staffId,
      tenantId,
      ativo: true,
      perfilAcessoId: 'perfil-1',
      perfilAcesso: {
        id: 'perfil-1',
        tenantId,
        ativo: false,
        modulos: [{ modulo: ModuloSistema.ESCALAS, nivel: NivelAcessoModulo.EDITAR }],
      },
    });

    r = await getNiveisModuloUsuarioService(tenantId, staffId, UserRole.MASTER);
    expect(r.isAdminPleno).toBe(false);
    expect(r.map.ESCALAS).toBe(NivelAcessoModulo.OFF);
    expect(await possuiEscritaModuloUsuarioService(tenantId, staffId, UserRole.MASTER, ModuloSistema.ESCALAS)).toBe(
      false
    );
  });

  it('força PERFIL >= VER e rebaixa CONFIGURACOES EDITAR para VER', async () => {
    mockUsuarioFindFirst.mockResolvedValue({
      id: staffId,
      tenantId,
      ativo: true,
      perfilAcessoId: 'perfil-1',
      perfilAcesso: {
        id: 'perfil-1',
        tenantId,
        ativo: true,
        modulos: [
          { modulo: ModuloSistema.CONFIGURACOES, nivel: NivelAcessoModulo.EDITAR },
          { modulo: ModuloSistema.ESCALAS, nivel: NivelAcessoModulo.EDITAR },
        ],
      },
    });

    const r = await getNiveisModuloUsuarioService(tenantId, staffId, UserRole.MASTER);

    expect(r.map.CONFIGURACOES).toBe(NivelAcessoModulo.VER);
    expect(r.map.PERFIL).toBe(NivelAcessoModulo.VER);
    expect(r.map.ESCALAS).toBe(NivelAcessoModulo.EDITAR);
    expect(await possuiEscritaModuloUsuarioService(tenantId, staffId, UserRole.MASTER, ModuloSistema.CONFIGURACOES)).toBe(
      false
    );
    expect(await possuiEscritaModuloUsuarioService(tenantId, staffId, UserRole.MASTER, ModuloSistema.ESCALAS)).toBe(
      true
    );
  });

  it('perfil de outro tenant é rejeitado (sem acesso)', async () => {
    mockUsuarioFindFirst.mockResolvedValue({
      id: staffId,
      tenantId,
      ativo: true,
      perfilAcessoId: 'perfil-outro',
      perfilAcesso: {
        id: 'perfil-outro',
        tenantId: 'tenant-outro',
        ativo: true,
        modulos: [{ modulo: ModuloSistema.ESCALAS, nivel: NivelAcessoModulo.EDITAR }],
      },
    });

    const r = await getNiveisModuloUsuarioService(tenantId, staffId, UserRole.MASTER);

    expect(r.isAdminPleno).toBe(false);
    expect(r.map.ESCALAS).toBe(NivelAcessoModulo.OFF);
  });

  it('MEDICO mapeia matriz boolean para VER/OFF e nunca é admin pleno', async () => {
    mockAcessoFindMany.mockResolvedValue([
      { modulo: ModuloSistema.PONTO_ELETRONICO, permitido: true },
      { modulo: ModuloSistema.ESCALAS, permitido: false },
    ]);

    const r = await getNiveisModuloUsuarioService(tenantId, medicoId, UserRole.MEDICO);

    expect(r.isAdminPleno).toBe(false);
    expect(r.map.PONTO_ELETRONICO).toBe(NivelAcessoModulo.VER);
    expect(r.map.ESCALAS).toBe(NivelAcessoModulo.OFF);
    expect(r.map.PERFIL).toBe(NivelAcessoModulo.VER);
    expect(await possuiAcessoModuloUsuarioService(tenantId, medicoId, UserRole.MEDICO, ModuloSistema.PONTO_ELETRONICO)).toBe(
      true
    );
    expect(await possuiEscritaModuloUsuarioService(tenantId, medicoId, UserRole.MEDICO, ModuloSistema.PONTO_ELETRONICO)).toBe(
      false
    );
    expect(mockUsuarioFindFirst).not.toHaveBeenCalled();
  });
});
