import { Router } from 'express';
import {
  convidarPalestranteAdminController,
  createEventoAdminController,
  downloadCapaAdminController,
  encerrarEventoAdminController,
  getEventoAdminController,
  listEventosAdminController,
  listPalestrantesAdminController,
  listParticipantesAdminController,
  listPrecadastrosAdminController,
  publicarEventoAdminController,
  rascunhoEventoAdminController,
  regenerarTokenAdminController,
  updateEventoAdminController,
  uploadCapaAdminController,
} from '../controllers/conteudo.controller';
import {
  validateConvidarPalestrante,
  validateCreateConteudoEvento,
  validateUpdateConteudoEvento,
  validateUUIDParam,
} from '../middleware/validation.middleware';
import { uploadConteudoCapa } from '../middleware/upload.middleware';

const router = Router();

router.get('/palestrantes', listPalestrantesAdminController);
router.get('/precadastros', listPrecadastrosAdminController);
router.get('/eventos', listEventosAdminController);
router.get('/eventos/:id', validateUUIDParam('id'), getEventoAdminController);
router.post('/eventos', validateCreateConteudoEvento, createEventoAdminController);
router.patch('/eventos/:id', validateUUIDParam('id'), validateUpdateConteudoEvento, updateEventoAdminController);
router.patch('/eventos/:id/publicar', validateUUIDParam('id'), publicarEventoAdminController);
router.patch('/eventos/:id/encerrar', validateUUIDParam('id'), encerrarEventoAdminController);
router.patch('/eventos/:id/rascunho', validateUUIDParam('id'), rascunhoEventoAdminController);
router.patch(
  '/eventos/:id/tokens/:tipo',
  validateUUIDParam('id'),
  regenerarTokenAdminController
);
router.post(
  '/eventos/:id/palestrante',
  validateUUIDParam('id'),
  validateConvidarPalestrante,
  convidarPalestranteAdminController
);
router.get('/eventos/:id/participantes', validateUUIDParam('id'), listParticipantesAdminController);
router.post(
  '/eventos/:id/capa',
  validateUUIDParam('id'),
  uploadConteudoCapa.single('capa'),
  uploadCapaAdminController
);
router.get('/eventos/:id/capa', validateUUIDParam('id'), downloadCapaAdminController);

export default router;
