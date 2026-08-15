import { ModuloSistema, UserRole } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import {
  requireAdminPleno,
  requireModuleAccess,
  requireModuleWrite,
} from './auth.middleware';
import {
  getNiveisModuloUsuarioService,
  possuiAcessoModuloUsuarioService,
  possuiEscritaModuloUsuarioService,
} from '../services/acesso-modulo.service';

jest.mock('../services/acesso-modulo.service', () => ({
  getNiveisModuloUsuarioService: jest.fn(),
  possuiAcessoModuloUsuarioService: jest.fn(),
  possuiEscritaModuloUsuarioService: jest.fn(),
}));

jest.mock('../utils/jwt.util', () => ({
  verifyAccessToken: jest.fn(),
}));

const mockGetNiveis = getNiveisModuloUsuarioService as jest.Mock;
const mockPossuiAcesso = possuiAcessoModuloUsuarioService as jest.Mock;
const mockPossuiEscrita = possuiEscritaModuloUsuarioService as jest.Mock;

const tenantId = 'tenant-1';
const userId = 'user-1';

function mockReq(user?: { id: string; role: UserRole; tenantId: string }): Request {
  return { user } as Request;
}

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
}

describe('auth middleware niveis', () => {
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
  });

  describe('requireModuleAccess', () => {
    it('retorna 401 sem user', async () => {
      const res = mockRes();
      await requireModuleAccess(ModuloSistema.ESCALAS)(mockReq(), res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('chama possuiAcessoModuloUsuarioService com userId e passa se true', async () => {
      mockPossuiAcesso.mockResolvedValue(true);
      const res = mockRes();
      const req = mockReq({ id: userId, role: UserRole.MASTER, tenantId });

      await requireModuleAccess(ModuloSistema.ESCALAS)(req, res, next);

      expect(mockPossuiAcesso).toHaveBeenCalledWith(tenantId, userId, UserRole.MASTER, ModuloSistema.ESCALAS);
      expect(next).toHaveBeenCalled();
    });

    it('retorna 403 se sem acesso', async () => {
      mockPossuiAcesso.mockResolvedValue(false);
      const res = mockRes();
      const req = mockReq({ id: userId, role: UserRole.MASTER, tenantId });

      await requireModuleAccess(ModuloSistema.ESCALAS)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Sem acesso ao módulo solicitado',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireModuleWrite', () => {
    it('retorna 403 quando staff só tem VER (sem escrita)', async () => {
      mockPossuiEscrita.mockResolvedValue(false);
      const res = mockRes();
      const req = mockReq({ id: userId, role: UserRole.MASTER, tenantId });

      await requireModuleWrite(ModuloSistema.ESCALAS)(req, res, next);

      expect(mockPossuiEscrita).toHaveBeenCalledWith(tenantId, userId, UserRole.MASTER, ModuloSistema.ESCALAS);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Sem permissão de edição neste módulo',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('passa quando tem EDITAR', async () => {
      mockPossuiEscrita.mockResolvedValue(true);
      const res = mockRes();
      const req = mockReq({ id: userId, role: UserRole.MASTER, tenantId });

      await requireModuleWrite(ModuloSistema.ESCALAS)(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireAdminPleno', () => {
    it('retorna 403 se não é admin pleno', async () => {
      mockGetNiveis.mockResolvedValue({ isAdminPleno: false, map: {} });
      const res = mockRes();
      const req = mockReq({ id: userId, role: UserRole.MASTER, tenantId });

      await requireAdminPleno()(req, res, next);

      expect(mockGetNiveis).toHaveBeenCalledWith(tenantId, userId, UserRole.MASTER);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Apenas administrador pleno pode gerenciar perfis e equipe',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('passa se isAdminPleno', async () => {
      mockGetNiveis.mockResolvedValue({ isAdminPleno: true, map: {} });
      const res = mockRes();
      const req = mockReq({ id: userId, role: UserRole.MASTER, tenantId });

      await requireAdminPleno()(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
