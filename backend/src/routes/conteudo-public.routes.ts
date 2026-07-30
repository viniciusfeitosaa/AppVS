import { Router } from 'express';
import {
  downloadCapaPublicInscricaoController,
  getPublicInscricaoController,
  getPublicPalestranteController,
  submitPublicInscricaoController,
  submitPublicPalestranteController,
} from '../controllers/conteudo.controller';
import { publicFormLimiter } from '../middleware/rate-limit.middleware';
import {
  validateConteudoTokenParam,
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

export default router;
