import { Router } from 'express';
import {
  loginController,
  loginMasterController,
  loginMedicoController,
} from '../controllers/auth.controller';
import {
  validateLogin,
  validateMasterLogin,
  validateMedicoLogin,
} from '../middleware/validation.middleware';

const router = Router();

// Compatibilidade com endpoint antigo
router.post('/login', validateLogin, loginController);
router.post('/login-medico', validateMedicoLogin, loginMedicoController);
router.post('/login-master', validateMasterLogin, loginMasterController);

export default router;
