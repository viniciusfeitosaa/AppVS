import { Request, Response } from 'express';
import {
  checkInService,
  checkOutService,
  getMeuDiaPontoService,
  listMinhasEscalasService,
} from '../services/ponto.service';

export const checkInController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { escalaId, observacao } = req.body;
    if (!escalaId) {
      return res.status(400).json({ success: false, error: 'escalaId é obrigatório' });
    }

    const data = await checkInService(req.user.tenantId, req.user.id, String(escalaId), observacao);
    return res.status(201).json({ success: true, data, message: 'Check-in realizado com sucesso' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao realizar check-in',
    });
  }
};

export const checkOutController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { observacao } = req.body;
    const data = await checkOutService(req.user.tenantId, req.user.id, observacao);
    return res.status(200).json({ success: true, data, message: 'Checkout realizado com sucesso' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao realizar checkout',
    });
  }
};

export const getMeuDiaPontoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const data = await getMeuDiaPontoService(req.user.tenantId, req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao obter ponto do dia',
    });
  }
};

export const listMinhasEscalasController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const data = await listMinhasEscalasService(req.user.tenantId, req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar escalas do médico',
    });
  }
};
