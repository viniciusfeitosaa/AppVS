import { Router } from 'express';
import { getPerfilController } from '../controllers/medico.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// GET /api/medico/perfil
router.get('/perfil', getPerfilController);

export default router;
