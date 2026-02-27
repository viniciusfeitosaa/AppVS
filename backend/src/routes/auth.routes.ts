import { Router } from 'express';
import {
  acceptInviteController,
  esqueciSenhaController,
  getMeModulosAcessoController,
  loginController,
  loginMasterController,
  loginMedicoController,
  redefinirSenhaController,
  registerPublicController,
} from '../controllers/auth.controller';
import {
  validateAcceptInvite,
  validateEmailLogin,
  validateEsqueciSenha,
  validateLogin,
  validateMasterLogin,
  validateMedicoLogin,
  validateRedefinirSenha,
  validateRegisterMedico,
} from '../middleware/validation.middleware';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', validateEmailLogin, loginController);
router.post('/login-medico', validateMedicoLogin, loginMedicoController);
router.post('/login-master', validateMasterLogin, loginMasterController);
router.post('/accept-invite', validateAcceptInvite, acceptInviteController);
router.post('/esqueci-senha', validateEsqueciSenha, esqueciSenhaController);
router.post('/redefinir-senha', validateRedefinirSenha, redefinirSenhaController);
router.post('/register', validateRegisterMedico, registerPublicController);
router.get('/modulos-acesso', authenticateToken, getMeModulosAcessoController);

// Compatibilidade explícita para clientes legados CPF/CRM
router.post('/login-legacy', validateLogin, loginMedicoController);

export default router;
