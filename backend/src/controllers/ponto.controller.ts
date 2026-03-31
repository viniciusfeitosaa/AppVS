import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { assertFileIsAllowedImage } from '../utils/image-magic-bytes.util';
import {
  checkInService,
  checkOutService,
  getMeuDiaPontoService,
  getFotoCheckinRegistroForMedico,
  listMinhasEscalasService,
  listEquipeColegasService,
  listProximosPlantoesService,
  listMeusPlantoesMesCalendarioService,
  listMinhasEquipesCalendarioService,
  solicitarTrocaPlantaoService,
  listTrocasPlantaoPendentesService,
  aceitarTrocaPlantaoService,
  recusarTrocaPlantaoService,
  canCheckInService,
} from '../services/ponto.service';

export const checkInController = async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  try {
    if (!req.user) {
      if (file?.path) fs.unlink(file.path, () => {});
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { escalaId, observacao, latitude, longitude } = req.body;
    // Validado por middleware (validateCheckinMultipart)
    const escalaIdReq = String(escalaId);
    const lat = latitude != null && latitude !== '' ? Number(latitude) : null;
    const lon = longitude != null && longitude !== '' ? Number(longitude) : null;

    if (!file?.path) {
      return res.status(400).json({
        success: false,
        error: 'Foto obrigatória para check-in. Envie uma imagem JPEG, PNG ou WebP (máx. 5 MB).',
      });
    }

    try {
      await assertFileIsAllowedImage(file.path);
    } catch (e: any) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({
        success: false,
        error: e?.message || 'Arquivo de imagem inválido.',
      });
    }

    const fotoRel = path.relative(process.cwd(), file.path).split(path.sep).join('/');

    const data = await checkInService(
      req.user.tenantId,
      req.user.id,
      escalaIdReq,
      observacao,
      lat,
      lon,
      fotoRel,
      null
    );
    return res.status(201).json({ success: true, data, message: 'Check-in realizado com sucesso' });
  } catch (error: any) {
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao realizar check-in',
    });
  }
};

export const checkInSemFotoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { escalaId, observacao, latitude, longitude, motivoSemFoto } = req.body;
    const escalaIdReq = String(escalaId);
    const lat = latitude != null && latitude !== '' ? Number(latitude) : null;
    const lon = longitude != null && longitude !== '' ? Number(longitude) : null;

    const data = await checkInService(
      req.user.tenantId,
      req.user.id,
      escalaIdReq,
      observacao,
      lat,
      lon,
      null,
      String(motivoSemFoto).trim()
    );
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
    console.error('[ponto/meu-dia] Erro:', error?.message ?? error);
    if (error?.stack) console.error(error.stack);
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

export const listEquipeColegasController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    // Validado por middleware (validateUUIDQuery('escalaId'))
    const escalaId = String(req.query.escalaId);

    const data = await listEquipeColegasService(req.user.tenantId, req.user.id, escalaId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar colegas da equipe',
    });
  }
};

export const listProximosPlantoesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const data = await listProximosPlantoesService(req.user.tenantId, req.user.id, 2);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar próximos plantões',
    });
  }
};

export const listMeusPlantoesCalendarioController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const now = new Date();
    const ano = req.query.ano != null && req.query.ano !== '' ? Number(req.query.ano) : now.getFullYear();
    const mes = req.query.mes != null && req.query.mes !== '' ? Number(req.query.mes) : now.getMonth() + 1;
    const equipeIds =
      typeof req.query.equipeIds === 'string' && req.query.equipeIds.trim()
        ? req.query.equipeIds
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
        : undefined;

    const data = await listMeusPlantoesMesCalendarioService(req.user.tenantId, req.user.id, ano, mes, equipeIds);
    return res.status(200).json({ success: true, data, meta: { ano, mes } });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar plantões do mês',
    });
  }
};

export const listMinhasEquipesCalendarioController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await listMinhasEquipesCalendarioService(req.user.tenantId, req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar equipes para o calendário',
    });
  }
};

export const canCheckInController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    // Validado por middleware (validateUUIDQuery('escalaId'))
    const escalaId = String(req.query.escalaId);
    const data = await canCheckInService(req.user.tenantId, req.user.id, escalaId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao validar check-in',
    });
  }
};

export const downloadFotoCheckinMedicoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const registroId = String(req.params.id);
    const { path: filePath, mimeType } = await getFotoCheckinRegistroForMedico(
      req.user.tenantId,
      req.user.id,
      registroId
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    return res.sendFile(filePath);
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao obter foto do check-in',
    });
  }
};

export const solicitarTrocaPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const plantaoId = String(req.body.plantaoId);
    const medicoDestinoId = String(req.body.medicoDestinoId);
    const data = await solicitarTrocaPlantaoService(req.user.tenantId, req.user.id, plantaoId, medicoDestinoId);
    return res.status(201).json({
      success: true,
      data,
      message: 'Solicitação de troca registrada. Você e o profissional foram notificados.',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao solicitar troca de plantão',
    });
  }
};

export const listTrocasPlantaoPendentesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await listTrocasPlantaoPendentesService(req.user.tenantId, req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar trocas pendentes',
    });
  }
};

export const aceitarTrocaPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const solicitacaoId = String(req.params.id);
    const data = await aceitarTrocaPlantaoService(req.user.tenantId, req.user.id, solicitacaoId);
    return res.status(200).json({ success: true, data, message: 'Troca aceita com sucesso' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao aceitar troca de plantão',
    });
  }
};

export const recusarTrocaPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const solicitacaoId = String(req.params.id);
    const data = await recusarTrocaPlantaoService(req.user.tenantId, req.user.id, solicitacaoId);
    return res.status(200).json({ success: true, data, message: 'Troca recusada' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao recusar troca de plantão',
    });
  }
};
