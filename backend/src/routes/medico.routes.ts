import { Router } from 'express';
import {
  getPerfilController,
  updatePerfilController,
  listMeusDocumentosController,
  downloadDocumentoEnviadoController,
} from '../controllers/medico.controller';
import { authenticateToken, requireModuleAccess } from '../middleware/auth.middleware';
import { validateUpdatePerfil } from '../middleware/validation.middleware';
import { uploadPerfilDocumentos } from '../middleware/upload.middleware';
import { DOCUMENTOS_PERFIL_FIELDS } from '../constants/documentos.const';
import { ModuloSistema } from '@prisma/client';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// GET /api/medico/perfil
router.get('/perfil', requireModuleAccess(ModuloSistema.PERFIL), getPerfilController);
// Documentos enviados pelo Master para o profissional
router.get('/documentos-enviados', requireModuleAccess(ModuloSistema.PERFIL), listMeusDocumentosController);
router.get('/documentos-enviados/:id/download', requireModuleAccess(ModuloSistema.PERFIL), downloadDocumentoEnviadoController);
const parseEspecialidadesJson = (req: any, _res: any, next: () => void) => {
  if (typeof req.body?.especialidades === 'string') {
    try {
      req.body.especialidades = JSON.parse(req.body.especialidades);
    } catch {
      req.body.especialidades = [];
    }
  }
  next();
};

router.put(
  '/perfil',
  uploadPerfilDocumentos.fields(DOCUMENTOS_PERFIL_FIELDS.map((name) => ({ name, maxCount: 1 }))),
  parseEspecialidadesJson,
  validateUpdatePerfil,
  requireModuleAccess(ModuloSistema.PERFIL),
  updatePerfilController
);

export default router;
