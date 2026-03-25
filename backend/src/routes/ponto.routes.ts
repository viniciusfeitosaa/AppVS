import { Router } from 'express';
import { ModuloSistema, UserRole } from '@prisma/client';
import { authenticateToken, requireModuleAccess, requireRole } from '../middleware/auth.middleware';
import { validateCheckin, validateCheckout } from '../middleware/validation.middleware';
import {
  checkInController,
  checkOutController,
  getMeuDiaPontoController,
  listMinhasEscalasController,
  listEquipeColegasController,
  listProximosPlantoesController,
} from '../controllers/ponto.controller';

const router = Router();

router.use(authenticateToken);
router.use(requireRole([UserRole.MEDICO]));
router.use(requireModuleAccess(ModuloSistema.PONTO_ELETRONICO));

router.post('/checkin', validateCheckin, checkInController);
router.post('/checkout', validateCheckout, checkOutController);
router.get('/meu-dia', getMeuDiaPontoController);
router.get('/minhas-escalas', listMinhasEscalasController);
router.get('/equipe-colegas', listEquipeColegasController);
router.get('/proximos-plantoes', listProximosPlantoesController);

export default router;
