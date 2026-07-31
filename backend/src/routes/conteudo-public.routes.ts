import { Router } from 'express';
import {
  downloadCapaPublicInscricaoController,
  getPublicFrequenciaController,
  getPublicInscricaoController,
  getPublicPalestranteController,
  submitPublicFrequenciaController,
  submitPublicInscricaoController,
  submitPublicPalestranteController,
} from '../controllers/conteudo.controller';
import { publicFormLimiter } from '../middleware/rate-limit.middleware';
import {
  validateConteudoTokenParam,
  validatePublicFrequenciaForm,
  validatePublicInscricaoForm,
  validatePublicPalestranteForm,
} from '../middleware/validation.middleware';

const router = Router();

router.get(
  '/palestrante/:token',
  validateConteudoTokenParam,
  getPublicPalestranteController
);
router.post(
  '/palestrante/:token',
  publicFormLimiter,
  validateConteudoTokenParam,
  validatePublicPalestranteForm,
  submitPublicPalestranteController
);

router.get(
  '/inscricao/:token',
  validateConteudoTokenParam,
  getPublicInscricaoController
);
router.post(
  '/inscricao/:token',
  publicFormLimiter,
  validateConteudoTokenParam,
  validatePublicInscricaoForm,
  submitPublicInscricaoController
);
router.get(
  '/inscricao/:token/capa',
  validateConteudoTokenParam,
  downloadCapaPublicInscricaoController
);

router.get(
  '/frequencia/:token',
  validateConteudoTokenParam,
  getPublicFrequenciaController
);
router.post(
  '/frequencia/:token',
  publicFormLimiter,
  validateConteudoTokenParam,
  validatePublicFrequenciaForm,
  submitPublicFrequenciaController
);

export default router;
