import { Request, Response } from 'express';
import {
  acceptInviteService,
  loginByEmailService,
  loginMasterService,
  loginMedicoService,
  registerPublicMedicoService,
} from '../services/auth.service';
import { getMinhaPermissaoModulosService } from '../services/acesso-modulo.service';

export const loginMedicoController = async (req: Request, res: Response) => {
  try {
    const { cpf, crm } = req.body;

    const result = await loginMedicoService(cpf, crm);

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

export const loginMasterController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const result = await loginMasterService(email, password);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao fazer login master',
    });
  }
};

export const loginEmailController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await loginByEmailService(email, password);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[auth/login]', error?.message ?? error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao fazer login',
    });
  }
};

export const acceptInviteController = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    const result = await acceptInviteService(token, password);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Convite aceito com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao aceitar convite',
    });
  }
};

export const registerPublicController = async (req: Request, res: Response) => {
  try {
    const result = await registerPublicMedicoService(req.body);
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao cadastrar usuário',
    });
  }
};

export const getMeModulosAcessoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await getMinhaPermissaoModulosService(req.user.tenantId, req.user.role);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao consultar módulos de acesso',
    });
  }
};

// /login agora é o login único por e-mail/senha
export const loginController = loginEmailController;
