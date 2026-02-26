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

    const { escalaId, observacao, latitude, longitude } = req.body;
    const escalaIdOpt = escalaId != null && escalaId !== '' ? String(escalaId) : undefined;
    const lat = latitude != null && latitude !== '' ? Number(latitude) : null;
    const lon = longitude != null && longitude !== '' ? Number(longitude) : null;

    const data = await checkInService(req.user.tenantId, req.user.id, escalaIdOpt, observacao, lat, lon);
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

    const { observacao, latitude, longitude } = req.body;
    const lat = latitude != null && latitude !== '' ? Number(latitude) : null;
    const lon = longitude != null && longitude !== '' ? Number(longitude) : null;

    const data = await checkOutService(req.user.tenantId, req.user.id, observacao, lat, lon);
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
