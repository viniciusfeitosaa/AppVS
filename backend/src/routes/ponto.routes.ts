import { Router } from 'express';
import { ModuloSistema, UserRole } from '@prisma/client';
import { authenticateToken, requireModuleAccess, requireRole } from '../middleware/auth.middleware';
import {
  checkInController,
  checkOutController,
  getMeuDiaPontoController,
  listMinhasEscalasController,
} from '../controllers/ponto.controller';

const router = Router();

router.use(authenticateToken);
router.use(requireRole([UserRole.MEDICO]));
router.use(requireModuleAccess(ModuloSistema.PONTO_ELETRONICO));

router.post('/checkin', checkInController);
router.post('/checkout', checkOutController);
router.get('/meu-dia', getMeuDiaPontoController);
router.get('/minhas-escalas', listMinhasEscalasController);

export default router;
