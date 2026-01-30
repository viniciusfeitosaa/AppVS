import { Request, Response } from 'express';
import { loginService } from '../services/auth.service';

export const loginController = async (req: Request, res: Response) => {
  try {
    const { cpf, crm } = req.body;

    const result = await loginService(cpf, crm);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao fazer login',
    });
  }
};
