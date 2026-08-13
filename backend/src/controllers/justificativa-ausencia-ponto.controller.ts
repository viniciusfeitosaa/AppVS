import { Request, Response } from 'express';
import {
  aceitarJustificativa,
  criarJustificativaAusenciaPonto,
  listJustificativasAdmin,
  listMinhasJustificativas,
  listPlantoesElegiveisJustificativa,
  recusarJustificativa,
} from '../services/justificativa-ausencia-ponto.service';

export const listPlantoesElegiveisJustificativaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await listPlantoesElegiveisJustificativa(req.user.tenantId, req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar plantões elegíveis',
    });
  }
};

export const criarJustificativaAusenciaPontoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await criarJustificativaAusenciaPonto(req.user.tenantId, req.user.id, {
      escalaPlantaoId: String(req.body.escalaPlantaoId),
      horarioAlegadoEntrada: new Date(req.body.horarioAlegadoEntrada),
      horarioAlegadoSaida: new Date(req.body.horarioAlegadoSaida),
      motivo: String(req.body.motivo),
    });
    return res.status(201).json({
      success: true,
      data,
      message: 'Justificativa enviada com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao criar justificativa',
    });
  }
};

export const listMinhasJustificativasController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await listMinhasJustificativas(req.user.tenantId, req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar justificativas',
    });
  }
};

export const listJustificativasAdminController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const statusRaw = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    const status =
      statusRaw === 'PENDENTE' || statusRaw === 'ACEITA' || statusRaw === 'RECUSADA'
        ? statusRaw
        : undefined;
    const data = await listJustificativasAdmin(req.user.tenantId, status);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar justificativas',
    });
  }
};

export const aceitarJustificativaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const id = String(req.params.id);
    const opts: {
      horarioAlegadoEntrada?: Date;
      horarioAlegadoSaida?: Date;
    } = {};
    if (req.body?.horarioAlegadoEntrada != null && String(req.body.horarioAlegadoEntrada).trim() !== '') {
      opts.horarioAlegadoEntrada = new Date(req.body.horarioAlegadoEntrada);
    }
    if (req.body?.horarioAlegadoSaida != null && String(req.body.horarioAlegadoSaida).trim() !== '') {
      opts.horarioAlegadoSaida = new Date(req.body.horarioAlegadoSaida);
    }
    const data = await aceitarJustificativa(req.user.tenantId, req.user.id, id, opts);
    return res.status(200).json({
      success: true,
      data,
      message: 'Justificativa aceita com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao aceitar justificativa',
    });
  }
};

export const recusarJustificativaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const id = String(req.params.id);
    const comentario =
      req.body?.comentario != null ? String(req.body.comentario) : undefined;
    const data = await recusarJustificativa(req.user.tenantId, req.user.id, id, comentario);
    return res.status(200).json({
      success: true,
      data,
      message: 'Justificativa recusada',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao recusar justificativa',
    });
  }
};
