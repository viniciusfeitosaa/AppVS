import fs from 'fs';
import { Request, Response } from 'express';
import { assertFileIsAllowedImage } from '../utils/image-magic-bytes.util';
import {
  cadastrarBiometriaService,
  conferirRostoService,
  getFotoBiometriaService,
  getMinhaBiometriaService,
  listBiometriasService,
  revisarBiometriaService,
} from '../services/biometria-facial.service';
import {
  getFotoCheckoutRegistroForAdmin,
  listDivergenciasFaciaisService,
  revisarFacePontoService,
} from '../services/ponto-face-revisao.service';

const erro = (res: Response, error: any, padrao: string) =>
  res.status(error?.statusCode || 500).json({ success: false, error: error?.message || padrao, motivo: error?.motivo });

export const getMinhaBiometriaController = async (req: Request, res: Response) => {
  try {
    const data = await getMinhaBiometriaService(req.user!.tenantId, req.user!.id);
    return res.json({ success: true, data });
  } catch (e) {
    return erro(res, e, 'Erro ao consultar biometria');
  }
};

export const cadastrarMinhaBiometriaController = async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  try {
    if (!file?.path) {
      return res.status(400).json({ success: false, error: 'Envie a foto do rosto (JPEG, PNG ou WebP, máx. 5 MB).' });
    }
    if (String(req.body.consentimento) !== 'true') {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ success: false, error: 'É preciso aceitar o termo de consentimento.' });
    }
    try {
      await assertFileIsAllowedImage(file.path);
    } catch (e: any) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ success: false, error: e?.message || 'Arquivo de imagem inválido.' });
    }
    const data = await cadastrarBiometriaService({
      tenantId: req.user!.tenantId,
      medicoId: req.user!.id,
      fotoAbs: file.path,
      origem: req.body.origem === 'RECADASTRO' ? 'RECADASTRO' : 'PRIMEIRO_PONTO',
      consentimentoVersao: String(req.body.consentimentoVersao || ''),
    });
    return res.status(201).json({ success: true, data, message: 'Foto de referência enviada para aprovação.' });
  } catch (e) {
    return erro(res, e, 'Erro ao cadastrar biometria');
  }
};

export const conferirMeuRostoController = async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file?.path) {
    return res.status(400).json({ success: false, error: 'Envie a foto do rosto.' });
  }
  try {
    const data = await conferirRostoService(req.user!.tenantId, req.user!.id, file.path);
    return res.json({ success: true, data });
  } catch (e) {
    return erro(res, e, 'Erro ao conferir rosto');
  }
};

export const listBiometriasAdminController = async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const permitido = ['PENDENTE_APROVACAO', 'APROVADA', 'REJEITADA'];
    const data = await listBiometriasService(req.user!.tenantId, status && permitido.includes(status) ? status : undefined);
    return res.json({ success: true, data });
  } catch (e) {
    return erro(res, e, 'Erro ao listar biometrias');
  }
};

export const revisarBiometriaAdminController = async (req: Request, res: Response) => {
  try {
    const decisao = req.body.decisao === 'APROVADA' ? 'APROVADA' : req.body.decisao === 'REJEITADA' ? 'REJEITADA' : null;
    if (!decisao) return res.status(400).json({ success: false, error: 'decisao deve ser APROVADA ou REJEITADA' });
    const data = await revisarBiometriaService(
      req.user!.tenantId,
      req.user!.id,
      String(req.params.id),
      decisao,
      req.body.motivo ? String(req.body.motivo) : undefined
    );
    return res.json({ success: true, data });
  } catch (e) {
    return erro(res, e, 'Erro ao revisar biometria');
  }
};

export const fotoBiometriaAdminController = async (req: Request, res: Response) => {
  try {
    const abs = await getFotoBiometriaService(req.user!.tenantId, String(req.params.id));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(abs);
  } catch (e) {
    return erro(res, e, 'Erro ao obter foto');
  }
};

export const fotoMinhaBiometriaController = async (req: Request, res: Response) => {
  try {
    const abs = await getFotoBiometriaService(req.user!.tenantId, String(req.params.id), req.user!.id);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(abs);
  } catch (e) {
    return erro(res, e, 'Erro ao obter foto');
  }
};

export const listDivergenciasFaciaisController = async (req: Request, res: Response) => {
  try {
    const revisados = req.query.revisados === 'true';
    const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 180);
    const data = await listDivergenciasFaciaisService(req.user!.tenantId, { revisados, dias });
    return res.json({ success: true, data });
  } catch (e) {
    return erro(res, e, 'Erro ao listar divergências');
  }
};

export const revisarFacePontoController = async (req: Request, res: Response) => {
  try {
    const decisao =
      req.body.decisao === 'CONFIRMADO_MEDICO'
        ? 'CONFIRMADO_MEDICO'
        : req.body.decisao === 'FRAUDE_SUSPEITA'
          ? 'FRAUDE_SUSPEITA'
          : null;
    if (!decisao) {
      return res.status(400).json({ success: false, error: 'decisao deve ser CONFIRMADO_MEDICO ou FRAUDE_SUSPEITA' });
    }
    const data = await revisarFacePontoService(
      req.user!.tenantId,
      req.user!.id,
      String(req.params.id),
      decisao,
      req.body.observacao ? String(req.body.observacao) : undefined
    );
    return res.json({ success: true, data });
  } catch (e) {
    return erro(res, e, 'Erro ao revisar ponto');
  }
};

export const fotoCheckoutAdminController = async (req: Request, res: Response) => {
  try {
    const abs = await getFotoCheckoutRegistroForAdmin(req.user!.tenantId, String(req.params.id));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(abs);
  } catch (e) {
    return erro(res, e, 'Erro ao obter foto');
  }
};
