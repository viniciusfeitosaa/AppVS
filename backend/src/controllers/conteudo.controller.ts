import { Request, Response } from 'express';
import path from 'path';
import { ConteudoEventoStatus } from '@prisma/client';
import {
  aceitarPrecadastrosAdminService,
  abrirFrequenciaAdminService,
  confirmarPresencaMedicoService,
  convidarPalestranteAdminService,
  createEventoAdminService,
  deleteParticipanteAdminService,
  fecharFrequenciaAdminService,
  getCapaByEventoPublicadoService,
  getCapaByInscricaoTokenService,
  getEventoAdminService,
  getEventoCapaPathAdminService,
  getEventoMedicoService,
  getPublicCadastroCorpoFormService,
  getPublicFrequenciaService,
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
  submitPublicCadastroCorpoService,
  submitPublicFrequenciaService,
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

export const abrirFrequenciaAdminController = async (req: Request, res: Response) => {
  try {
    const data = await abrirFrequenciaAdminService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data, message: 'Frequência aberta' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const fecharFrequenciaAdminController = async (req: Request, res: Response) => {
  try {
    const data = await fecharFrequenciaAdminService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data, message: 'Frequência encerrada' });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const regenerarTokenAdminController = async (req: Request, res: Response) => {
  try {
    const raw = req.params.tipo;
    const tipo =
      raw === 'palestrante' ? 'palestrante' : raw === 'frequencia' ? 'frequencia' : 'inscricao';
    const data = await regenerarTokenAdminService(req.user!.tenantId, req.params.id, tipo);
    return res.json({ success: true, data, message: 'Token regenerado' });
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

export const deleteParticipanteAdminController = async (req: Request, res: Response) => {
  try {
    const data = await deleteParticipanteAdminService(
      req.user!.tenantId,
      req.params.id,
      req.params.participanteId
    );
    return res.json({ success: true, data, message: 'Participante excluído' });
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

export const aceitarPrecadastrosAdminController = async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const data = await aceitarPrecadastrosAdminService(req.user!.tenantId, req.user!.id, ids);
    return res.json({
      success: true,
      data,
      message: `${data.aceitos} de ${data.total} precadastro(s) aceito(s)`,
    });
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

export const confirmarPresencaMedicoController = async (req: Request, res: Response) => {
  try {
    const data = await confirmarPresencaMedicoService(req.user!.tenantId, req.user!.id, req.params.id);
    return res.json({
      success: true,
      data,
      message: data.jaRegistrado ? 'Presença já registrada' : 'Presença confirmada',
    });
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

export const getPublicFrequenciaController = async (req: Request, res: Response) => {
  try {
    const data = await getPublicFrequenciaService(req.params.token);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const submitPublicFrequenciaController = async (req: Request, res: Response) => {
  try {
    const data = await submitPublicFrequenciaService(req.params.token, req.body.email);
    return res.json({
      success: true,
      data,
      message:
        'Se o e-mail estiver na lista de inscritos, a presença foi registrada.',
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const getPublicCadastroCorpoController = async (req: Request, res: Response) => {
  try {
    const data = await getPublicCadastroCorpoFormService(req.params.token);
    return res.json({ success: true, data });
  } catch (error) {
    return handleServiceError(res, error);
  }
};

export const submitPublicCadastroCorpoController = async (req: Request, res: Response) => {
  try {
    const data = await submitPublicCadastroCorpoService(req.params.token, req.body);
    return res.status(201).json({
      success: true,
      data,
      message: data.message,
    });
  } catch (error) {
    return handleServiceError(res, error);
  }
};
