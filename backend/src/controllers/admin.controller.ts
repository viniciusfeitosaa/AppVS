import { Request, Response } from 'express';
import {
  createMedicoService,
  inviteMedicoService,
  listMedicosService,
  toggleMedicoAtivoService,
  updateMedicoService,
} from '../services/admin.service';

export const listMedicosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await listMedicosService({
      tenantId: req.user.tenantId,
      page,
      limit,
      search,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar médicos',
    });
  }
};

export const createMedicoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const medico = await createMedicoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      data: medico,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao criar médico',
    });
  }
};

export const updateMedicoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const medico = await updateMedicoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      medicoId: req.params.id,
      ...req.body,
    });

    return res.status(200).json({
      success: true,
      data: medico,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar médico',
    });
  }
};

export const toggleMedicoAtivoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { ativo } = req.body;
    if (typeof ativo !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Campo "ativo" deve ser boolean',
      });
    }

    const medico = await toggleMedicoAtivoService(
      req.user.tenantId,
      req.user.id,
      req.params.id,
      ativo
    );

    return res.status(200).json({
      success: true,
      data: medico,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao alterar status do médico',
    });
  }
};

export const inviteMedicoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const result = await inviteMedicoService(
      req.user.tenantId,
      req.user.id,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Convite gerado com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao gerar convite',
    });
  }
};
