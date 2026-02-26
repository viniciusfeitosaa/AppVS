import { Router } from 'express';
import { getPerfilController, updatePerfilController } from '../controllers/medico.controller';
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
router.put(
  '/perfil',
  uploadPerfilDocumentos.fields(DOCUMENTOS_PERFIL_FIELDS.map((name) => ({ name, maxCount: 1 }))),
  validateUpdatePerfil,
  requireModuleAccess(ModuloSistema.PERFIL),
  updatePerfilController
);

export default router;
