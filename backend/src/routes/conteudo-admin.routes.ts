import { Router } from 'express';
import {
  aceitarPrecadastrosAdminController,
  abrirFrequenciaAdminController,
  convidarPalestranteAdminController,
  createEventoAdminController,
  deleteParticipanteAdminController,
  downloadCapaAdminController,
  encerrarEventoAdminController,
  fecharFrequenciaAdminController,
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
  validateAceitarPrecadastros,
  validateConvidarPalestrante,
  validateCreateConteudoEvento,
  validateUpdateConteudoEvento,
  validateUUIDParam,
} from '../middleware/validation.middleware';
import { uploadConteudoCapa } from '../middleware/upload.middleware';

const router = Router();

router.get('/palestrantes', listPalestrantesAdminController);
router.get('/precadastros', listPrecadastrosAdminController);
router.post('/precadastros/aceitar', validateAceitarPrecadastros, aceitarPrecadastrosAdminController);
router.get('/eventos', listEventosAdminController);
router.get('/eventos/:id', validateUUIDParam('id'), getEventoAdminController);
router.post('/eventos', validateCreateConteudoEvento, createEventoAdminController);
router.patch('/eventos/:id', validateUUIDParam('id'), validateUpdateConteudoEvento, updateEventoAdminController);
router.patch('/eventos/:id/publicar', validateUUIDParam('id'), publicarEventoAdminController);
router.patch('/eventos/:id/encerrar', validateUUIDParam('id'), encerrarEventoAdminController);
router.patch('/eventos/:id/rascunho', validateUUIDParam('id'), rascunhoEventoAdminController);
router.post('/eventos/:id/frequencia/abrir', validateUUIDParam('id'), abrirFrequenciaAdminController);
router.post('/eventos/:id/frequencia/fechar', validateUUIDParam('id'), fecharFrequenciaAdminController);
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
router.delete(
  '/eventos/:id/participantes/:participanteId',
  validateUUIDParam('id'),
  validateUUIDParam('participanteId'),
  deleteParticipanteAdminController
);
router.post(
  '/eventos/:id/capa',
  validateUUIDParam('id'),
  uploadConteudoCapa.single('capa'),
  uploadCapaAdminController
);
router.get('/eventos/:id/capa', validateUUIDParam('id'), downloadCapaAdminController);

export default router;
