import { Request, Response } from 'express';
import { getPerfilService } from '../services/medico.service';

export const getPerfilController = async (req: Request, res: Response) => {
  try {
    const medicoId = (req as any).user?.id;

    if (!medicoId) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
    }

    const perfil = await getPerfilService(medicoId);

    res.status(200).json({
      success: true,
      data: perfil,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao buscar perfil',
    });
  }
};
