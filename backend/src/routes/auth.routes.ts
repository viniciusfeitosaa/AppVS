import { Router } from 'express';
import {
  acceptInviteController,
  loginController,
  loginMasterController,
  loginMedicoController,
} from '../controllers/auth.controller';
import {
  validateAcceptInvite,
  validateEmailLogin,
  validateLogin,
  validateMasterLogin,
  validateMedicoLogin,
} from '../middleware/validation.middleware';

const router = Router();

router.post('/login', validateEmailLogin, loginController);
router.post('/login-medico', validateMedicoLogin, loginMedicoController);
router.post('/login-master', validateMasterLogin, loginMasterController);
router.post('/accept-invite', validateAcceptInvite, acceptInviteController);

// Compatibilidade explícita para clientes legados CPF/CRM
router.post('/login-legacy', validateLogin, loginMedicoController);

export default router;
