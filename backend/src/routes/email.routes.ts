import { Router } from 'express';
import { ModuloSistema } from '@prisma/client';
import { authenticateToken, requireModuleAccess } from '../middleware/auth.middleware';
import {
  createEmailMensagemController,
  deleteEmailMensagemController,
  enviarAgoraEmailMensagemController,
  enviarEmailMensagemController,
  getEmailMensagemController,
  getEmailPainelResumoController,
  listEmailMensagensController,
  testarConexaoSmtpController,
} from '../modules/email/email.controller';

const router = Router();

router.use(authenticateToken);
router.use(requireModuleAccess(ModuloSistema.ENVIO_EMAIL));

router.get('/resumo', getEmailPainelResumoController);
router.post('/smtp/testar', testarConexaoSmtpController);
router.get('/mensagens', listEmailMensagensController);
router.post('/mensagens/enviar-agora', enviarAgoraEmailMensagemController);
router.get('/mensagens/:id', getEmailMensagemController);
router.post('/mensagens', createEmailMensagemController);
router.post('/mensagens/:id/enviar', enviarEmailMensagemController);
router.delete('/mensagens/:id', deleteEmailMensagemController);

export default router;
