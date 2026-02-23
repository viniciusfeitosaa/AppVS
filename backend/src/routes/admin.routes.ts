import { Router } from 'express';
import {
  createMedicoController,
  listMedicosController,
  toggleMedicoAtivoController,
  updateMedicoController,
} from '../controllers/admin.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateToken);
router.use(requireRole([UserRole.MASTER]));

router.get('/medicos', listMedicosController);
router.post('/medicos', createMedicoController);
router.put('/medicos/:id', updateMedicoController);
router.patch('/medicos/:id/ativo', toggleMedicoAtivoController);

export default router;
