import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { UserRole } from '@prisma/client';

// Estender tipo Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        tenantId: string;
      };
    }
  }
}

/**
 * Middleware de autenticação JWT
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticação não fornecido',
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.id, role: decoded.role, tenantId: decoded.tenantId };
    return next();
  } catch (error: any) {
    return res.status(403).json({
      success: false,
      error: error.message || 'Token inválido ou expirado',
    });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para acessar este recurso',
      });
    }

    return next();
  };
};
