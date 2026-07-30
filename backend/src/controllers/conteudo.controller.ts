import { Request, Response } from 'express';
import path from 'path';
import { ConteudoEventoStatus } from '@prisma/client';
import {
  convidarPalestranteAdminService,
  createEventoAdminService,
  getCapaByEventoPublicadoService,
  getCapaByInscricaoTokenService,
  getEventoAdminService,
  getEventoCapaPathAdminService,
  getEventoMedicoService,
  getPublicInscricaoFormService,
  getPublicPalestranteFormService,
  inscreverMedicoService,
  listEventosAdminService,
  listEventosMedicoService,
  listPalestrantesAdminService,
  listParticipantesAdminService,
  listPrecadastrosAdminService,
  regenerarTokenAdminService,
  setCapaEventoAdminService,
  setEventoStatusAdminService,
  submitPublicInscricaoService,
  submitPublicPalestranteFormService,
  updateEventoAdminService,
} from '../services/conteudo.service';
import { fileExistsSafe, resolveStoredFileToAbsolute } from '../utils/upload-path.util';

const handleServiceError = (res: Response, error: unknown) => {
  const err = error as { statusCode?: number; message?: string };
  return res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Erro interno do servidor',
  });
};

function sendStoredImage(res: Response, storedPath: string) {
  const abs = resolveStoredFileToAbsolute(storedPath);
  if (!fileExistsSafe(abs)) {
    return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
  }
  const ext = path.extname(abs).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.sendFile(abs);
}

function storedCapaRelative(tenantId: string, filename: string) {
  return path.join('conteudos', tenantId, filename).replace(/\\/g, '/');
}

/* ——— Admin ——— */

export const listPalestrantesAdminController = async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const data = await listPalestrantesAdminService(req.user!.tenantId, q);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const listEventosAdminController = async (req: Request, res: Response) => {
  try {
    const data = await listEventosAdminService(req.user!.tenantId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getEventoAdminController = async (req: Request, res: Response) => {
  try {
    const data = await getEventoAdminService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const createEventoAdminController = async (req: Request, res: Response) => {
  try {
    const data = await createEventoAdminService(req.user!.tenantId, req.user!.id, req.body);
    return res.status(201).json({ success: true, data, message: 'Conteúdo criado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const updateEventoAdminController = async (req: Request, res: Response) => {
  try {
    const data = await updateEventoAdminService(req.user!.tenantId, req.params.id, req.body);
    return res.json({ success: true, data, message: 'Conteúdo atualizado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const publicarEventoAdminController = async (req: Request, res: Response) => {
  try {
    const data = await setEventoStatusAdminService(
      req.user!.tenantId,
      req.params.id,
      ConteudoEventoStatus.PUBLICADO
    );
    return res.json({ success: true, data, message: 'Conteúdo publicado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const encerrarEventoAdminController = async (req: Request, res: Response) => {
  try {
    const data = await setEventoStatusAdminService(
      req.user!.tenantId,
      req.params.id,
      ConteudoEventoStatus.ENCERRADO
    );
    return res.json({ success: true, data, message: 'Conteúdo encerrado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const rascunhoEventoAdminController = async (req: Request, res: Response) => {
  try {
    const data = await setEventoStatusAdminService(
      req.user!.tenantId,
      req.params.id,
      ConteudoEventoStatus.RASCUNHO
    );
    return res.json({ success: true, data, message: 'Conteúdo voltou para rascunho' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const regenerarTokenAdminController = async (req: Request, res: Response) => {
  try {
    const tipo = req.params.tipo === 'palestrante' ? 'palestrante' : 'inscricao';
    const data = await regenerarTokenAdminService(req.user!.tenantId, req.params.id, tipo);
    return res.json({ success: true, data, message: 'Link regenerado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const convidarPalestranteAdminController = async (req: Request, res: Response) => {
  try {
    const data = await convidarPalestranteAdminService(req.user!.tenantId, req.params.id, req.body);
    return res.json({ success: true, data, message: 'Palestrante vinculado' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const listParticipantesAdminController = async (req: Request, res: Response) => {
  try {
    const data = await listParticipantesAdminService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const listPrecadastrosAdminController = async (req: Request, res: Response) => {
  try {
    const data = await listPrecadastrosAdminService(req.user!.tenantId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const uploadCapaAdminController = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'Envie a imagem da capa.' });
    }
    const relative = storedCapaRelative(req.user!.tenantId, file.filename);
    const data = await setCapaEventoAdminService(req.user!.tenantId, req.params.id, relative);
    return res.json({ success: true, data, message: 'Capa atualizada' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const downloadCapaAdminController = async (req: Request, res: Response) => {
  try {
    const capaUrl = await getEventoCapaPathAdminService(req.user!.tenantId, req.params.id);
    if (/^https?:\/\//i.test(capaUrl)) {
      return res.redirect(capaUrl);
    }
    return sendStoredImage(res, capaUrl);
  } catch (error) {
    return handleServiceError(res, error);
  }
};

/* ——— Médico ——— */

export const listEventosMedicoController = async (req: Request, res: Response) => {
  try {
    const data = await listEventosMedicoService(req.user!.tenantId, req.user!.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getEventoMedicoController = async (req: Request, res: Response) => {
  try {
    const data = await getEventoMedicoService(req.user!.tenantId, req.user!.id, req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const inscreverMedicoController = async (req: Request, res: Response) => {
  try {
    const data = await inscreverMedicoService(req.user!.tenantId, req.user!.id, req.params.id);
    return res.status(201).json({ success: true, data, message: 'Inscrição confirmada' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const downloadCapaMedicoController = async (req: Request, res: Response) => {
  try {
    const capaUrl = await getCapaByEventoPublicadoService(req.user!.tenantId, req.params.id);
    if (/^https?:\/\//i.test(capaUrl)) {
      return res.redirect(capaUrl);
    }
    return sendStoredImage(res, capaUrl);
  } catch (error) {
    return handleServiceError(res, error);
  }
};

/* ——— Público ——— */

export const getPublicPalestranteController = async (req: Request, res: Response) => {
  try {
    const data = await getPublicPalestranteFormService(req.params.token);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const submitPublicPalestranteController = async (req: Request, res: Response) => {
  try {
    const data = await submitPublicPalestranteFormService(req.params.token, req.body);
    return res.json({ success: true, data, message: 'Dados do palestrante salvos. Obrigado!' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getPublicInscricaoController = async (req: Request, res: Response) => {
  try {
    const data = await getPublicInscricaoFormService(req.params.token);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const submitPublicInscricaoController = async (req: Request, res: Response) => {
  try {
    const data = await submitPublicInscricaoService(req.params.token, req.body);
    return res.status(201).json({ success: true, data, message: 'Inscrição realizada com sucesso' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const downloadCapaPublicInscricaoController = async (req: Request, res: Response) => {
  try {
    const capaUrl = await getCapaByInscricaoTokenService(req.params.token);
    if (/^https?:\/\//i.test(capaUrl)) {
      return res.redirect(capaUrl);
    }
    return sendStoredImage(res, capaUrl);
  } catch (error) {
    return handleServiceError(res, error);
  }
};
