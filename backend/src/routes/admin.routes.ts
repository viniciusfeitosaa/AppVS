import { Router } from 'express';
import {
  alocarMedicoEscalaController,
  createContratoAtivoController,
  createEscalaController,
  createEscalaPlantaoController,
  createMedicoController,
  deleteEscalaController,
  deleteContratoAtivoController,
  getConfigPontoController,
  getConfigPontoOpcoesController,
  getValoresPlantaoOpcoesController,
  getValoresPlantaoController,
  inviteMedicoController,
  listEscalaMedicosController,
  listEscalaPlantoesController,
  listEscalasController,
  listRegistrosPontoAdminController,
  getMatrizAcessosModulosController,
  salvarMatrizAcessosModulosController,
  listContratosAtivosController,
  listMedicosController,
  removerEscalaPlantaoController,
  removerMedicoEscalaController,
  setConfigPontoController,
  setValorPlantaoController,
  toggleMedicoAtivoController,
  updateEscalaController,
  updateContratoAtivoController,
  updateMedicoController,
} from '../controllers/admin.controller';
import {
  addEquipeToEscalaController,
  addMedicoToEquipeController,
  addMedicoToSubgrupoController,
  addSubgrupoToEscalaController,
  createEquipeController,
  createSubgrupoController,
  deleteEquipeController,
  deleteSubgrupoController,
  listEquipeMedicosController,
  listEquipesController,
  listEscalaEquipesController,
  listEscalaSubgruposController,
  listSubgrupoMedicosController,
  listSubgruposController,
  removeEquipeFromEscalaController,
  removeMedicoFromEquipeController,
  removeMedicoFromSubgrupoController,
  removeSubgrupoFromEscalaController,
  updateEquipeController,
  updateSubgrupoController,
} from '../controllers/grupo-equipe.controller';
import { authenticateToken, requireAnyModuleAccess, requireModuleAccess, requireRole } from '../middleware/auth.middleware';
import { ModuloSistema, UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateToken);
router.use(requireRole([UserRole.MASTER]));

router.get('/medicos', requireModuleAccess(ModuloSistema.MEDICOS), listMedicosController);
router.post('/medicos', requireModuleAccess(ModuloSistema.MEDICOS), createMedicoController);
router.put('/medicos/:id', requireModuleAccess(ModuloSistema.MEDICOS), updateMedicoController);
router.patch('/medicos/:id/ativo', requireModuleAccess(ModuloSistema.MEDICOS), toggleMedicoAtivoController);
router.post('/medicos/:id/invite', requireModuleAccess(ModuloSistema.CONVITES), inviteMedicoController);

router.get('/contratos-ativos', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), listContratosAtivosController);
router.post('/contratos-ativos', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), createContratoAtivoController);
router.put('/contratos-ativos/:id', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), updateContratoAtivoController);
router.delete('/contratos-ativos/:id', requireModuleAccess(ModuloSistema.CONTRATOS_ATIVOS), deleteContratoAtivoController);

router.get('/escalas', requireModuleAccess(ModuloSistema.ESCALAS), listEscalasController);
router.post('/escalas', requireModuleAccess(ModuloSistema.ESCALAS), createEscalaController);
router.put('/escalas/:id', requireModuleAccess(ModuloSistema.ESCALAS), updateEscalaController);
router.delete('/escalas/:id', requireModuleAccess(ModuloSistema.ESCALAS), deleteEscalaController);
router.get('/escalas/:id/medicos', requireModuleAccess(ModuloSistema.ESCALAS), listEscalaMedicosController);
router.post('/escalas/:id/medicos', requireModuleAccess(ModuloSistema.ESCALAS), alocarMedicoEscalaController);
router.delete('/escalas/:id/medicos/:medicoId', requireModuleAccess(ModuloSistema.ESCALAS), removerMedicoEscalaController);
router.get('/escalas/:id/plantoes', requireModuleAccess(ModuloSistema.ESCALAS), listEscalaPlantoesController);
router.post('/escalas/:id/plantoes', requireModuleAccess(ModuloSistema.ESCALAS), createEscalaPlantaoController);
router.delete('/escalas/:id/plantoes/:plantaoId', requireModuleAccess(ModuloSistema.ESCALAS), removerEscalaPlantaoController);

router.get('/valores-plantao/opcoes', requireModuleAccess(ModuloSistema.VALORES_PLANTAO), getValoresPlantaoOpcoesController);
router.get('/valores-plantao', requireAnyModuleAccess([ModuloSistema.VALORES_PLANTAO, ModuloSistema.ESCALAS]), getValoresPlantaoController);
router.put('/valores-plantao', requireModuleAccess(ModuloSistema.VALORES_PLANTAO), setValorPlantaoController);

router.get('/config-ponto/opcoes', requireModuleAccess(ModuloSistema.PONTO_ELETRONICO), getConfigPontoOpcoesController);
router.get('/config-ponto', requireModuleAccess(ModuloSistema.PONTO_ELETRONICO), getConfigPontoController);
router.put('/config-ponto', requireModuleAccess(ModuloSistema.PONTO_ELETRONICO), setConfigPontoController);

router.get('/registros-ponto', requireModuleAccess(ModuloSistema.RELATORIOS), listRegistrosPontoAdminController);
router.get('/acessos-modulos', requireModuleAccess(ModuloSistema.CONFIGURACOES), getMatrizAcessosModulosController);
router.put('/acessos-modulos', requireModuleAccess(ModuloSistema.CONFIGURACOES), salvarMatrizAcessosModulosController);
router.get('/subgrupos', requireModuleAccess(ModuloSistema.MEDICOS), listSubgruposController);
router.post('/subgrupos', requireModuleAccess(ModuloSistema.MEDICOS), createSubgrupoController);
router.put('/subgrupos/:id', requireModuleAccess(ModuloSistema.MEDICOS), updateSubgrupoController);
router.delete('/subgrupos/:id', requireModuleAccess(ModuloSistema.MEDICOS), deleteSubgrupoController);
router.get('/subgrupos/:id/medicos', requireModuleAccess(ModuloSistema.MEDICOS), listSubgrupoMedicosController);
router.post('/subgrupos/:id/medicos', requireModuleAccess(ModuloSistema.MEDICOS), addMedicoToSubgrupoController);
router.delete('/subgrupos/:id/medicos/:medicoId', requireModuleAccess(ModuloSistema.MEDICOS), removeMedicoFromSubgrupoController);
router.get('/equipes', requireModuleAccess(ModuloSistema.MEDICOS), listEquipesController);
router.post('/equipes', requireModuleAccess(ModuloSistema.MEDICOS), createEquipeController);
router.put('/equipes/:id', requireModuleAccess(ModuloSistema.MEDICOS), updateEquipeController);
router.delete('/equipes/:id', requireModuleAccess(ModuloSistema.MEDICOS), deleteEquipeController);
router.get('/equipes/:id/medicos', requireModuleAccess(ModuloSistema.MEDICOS), listEquipeMedicosController);
router.post('/equipes/:id/medicos', requireModuleAccess(ModuloSistema.MEDICOS), addMedicoToEquipeController);
router.delete('/equipes/:id/medicos/:medicoId', requireModuleAccess(ModuloSistema.MEDICOS), removeMedicoFromEquipeController);
router.get('/escalas/:id/subgrupos', requireModuleAccess(ModuloSistema.ESCALAS), listEscalaSubgruposController);
router.post('/escalas/:id/subgrupos', requireModuleAccess(ModuloSistema.ESCALAS), addSubgrupoToEscalaController);
router.delete('/escalas/:id/subgrupos/:subgrupoId', requireModuleAccess(ModuloSistema.ESCALAS), removeSubgrupoFromEscalaController);
router.get('/escalas/:id/equipes', requireModuleAccess(ModuloSistema.ESCALAS), listEscalaEquipesController);
router.post('/escalas/:id/equipes', requireModuleAccess(ModuloSistema.ESCALAS), addEquipeToEscalaController);
router.delete('/escalas/:id/equipes/:equipeId', requireModuleAccess(ModuloSistema.ESCALAS), removeEquipeFromEscalaController);

export default router;
