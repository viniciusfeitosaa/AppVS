import { Router } from 'express';
import {
  createMedicoController,
  inviteMedicoController,
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
router.post('/medicos/:id/invite', inviteMedicoController);

export default router;
