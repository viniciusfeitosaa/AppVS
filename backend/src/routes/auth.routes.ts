import { Router } from 'express';
import {
  acceptInviteController,
  getMeModulosAcessoController,
  loginController,
  loginMasterController,
  loginMedicoController,
  registerPublicController,
} from '../controllers/auth.controller';
import {
  validateAcceptInvite,
  validateEmailLogin,
  validateLogin,
  validateMasterLogin,
  validateMedicoLogin,
  validateRegisterMedico,
} from '../middleware/validation.middleware';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', validateEmailLogin, loginController);
router.post('/login-medico', validateMedicoLogin, loginMedicoController);
router.post('/login-master', validateMasterLogin, loginMasterController);
router.post('/accept-invite', validateAcceptInvite, acceptInviteController);
router.post('/register', validateRegisterMedico, registerPublicController);
router.get('/modulos-acesso', authenticateToken, getMeModulosAcessoController);

// Compatibilidade explícita para clientes legados CPF/CRM
router.post('/login-legacy', validateLogin, loginMedicoController);

export default router;
