import { Router } from 'express';
import { loginController } from '../controllers/auth.controller';
import { validateLogin } from '../middleware/validation.middleware';

const router = Router();

// POST /api/auth/login
router.post('/login', validateLogin, loginController);

export default router;
