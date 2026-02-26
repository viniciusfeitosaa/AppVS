import { Request, Response } from 'express';
import { getPerfilService, updatePerfilService } from '../services/medico.service';

export const getPerfilController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!medicoId || !tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
    }

    const perfil = await getPerfilService(medicoId, tenantId);

    return res.status(200).json({
      success: true,
      data: perfil,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao buscar perfil',
    });
  }
};

export const updatePerfilController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!medicoId || !tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
    }

    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const perfil = await updatePerfilService(medicoId, tenantId, req.body, files);

    return res.status(200).json({
      success: true,
      data: perfil,
      message: 'Perfil atualizado com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar perfil',
    });
  }
};
