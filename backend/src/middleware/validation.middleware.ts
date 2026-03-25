import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { validateCPF, validateCRM } from '../utils/validation.util';

const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  return next();
};

/**
 * Validação de login médico (CPF + CRM)
 */
export const validateMedicoLogin = [
  body('cpf')
    .notEmpty()
    .withMessage('CPF é obrigatório')
    .custom((value) => {
      if (!validateCPF(value)) {
        throw new Error('CPF inválido');
      }
      return true;
    }),
  body('crm')
    .notEmpty()
    .withMessage('CRM é obrigatório')
    .custom((value) => {
      if (!validateCRM(value)) {
        throw new Error('CRM inválido');
      }
      return true;
    }),
  handleValidationErrors,
];

/**
 * Mantém compatibilidade do endpoint antigo /login
 */
export const validateLogin = validateMedicoLogin;

/**
 * Validação de login por e-mail/senha (master e médico)
 */
export const validateEmailLogin = [
  body('email').isEmail().withMessage('E-mail inválido'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres'),
  handleValidationErrors,
];

/**
 * Validação de login master (email + senha)
 */
export const validateMasterLogin = [
  body('email').isEmail().withMessage('E-mail inválido'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres'),
  handleValidationErrors,
];

/**
 * Aceite de convite (definição de senha)
 */
export const validateAcceptInvite = [
  body('token').isString().isLength({ min: 20 }).withMessage('Token inválido'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres'),
  body('confirmPassword')
    .isString()
    .custom((value, { req }) => value === req.body.password)
    .withMessage('As senhas não coincidem'),
  handleValidationErrors,
];

/**
 * Esqueci minha senha - solicitar link
 */
export const validateEsqueciSenha = [
  body('email').isEmail().withMessage('E-mail inválido').normalizeEmail(),
  handleValidationErrors,
];

/**
 * Redefinir senha com token
 */
export const validateRedefinirSenha = [
  body('token').isString().isLength({ min: 32 }).withMessage('Token inválido'),
  body('novaSenha')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Nova senha deve ter no mínimo 8 caracteres'),
  body('confirmarSenha')
    .isString()
    .custom((value, { req }) => value === req.body.novaSenha)
    .withMessage('As senhas não coincidem'),
  handleValidationErrors,
];

/**
 * Cadastro público de médico/associado
 */
export const validateRegisterMedico = [
  body('nomeCompleto')
    .isString()
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Nome completo é obrigatório'),
  body('email')
    .isEmail()
    .withMessage('E-mail inválido')
    .normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres'),
  body('confirmPassword')
    .isString()
    .custom((value, { req }) => value === req.body.password)
    .withMessage('As senhas não coincidem'),
  body('cpf')
    .isString()
    .custom((value) => {
      if (!validateCPF(value)) {
        throw new Error('CPF inválido');
      }
      return true;
    }),
  body('profissao')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Profissão é obrigatória')
    .isLength({ max: 80 })
    .withMessage('Profissão inválida'),
  body('crm')
    .optional({ values: 'null', checkFalsy: true })
    .isString()
    .custom((value, { req }) => {
      const profissao = (req.body?.profissao || '').trim();
      if (profissao === 'Médico') {
        if (!value || !validateCRM(value)) {
          throw new Error('CRM inválido');
        }
      }
      return true;
    }),
  body('especialidades')
    .optional({ values: 'null', checkFalsy: true })
    .isArray()
    .withMessage('Especialidades deve ser uma lista'),
  body('especialidades.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Cada especialidade deve ter no máximo 100 caracteres'),
  body('telefone')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Telefone é obrigatório')
    .isLength({ max: 20 })
    .withMessage('Telefone inválido'),
  handleValidationErrors,
];

export const validateUpdatePerfil = [
  body('estadoCivil')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Estado civil inválido'),
  body('enderecoResidencial')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Endereço residencial inválido'),
  body('dadosBancarios')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 3000 })
    .withMessage('Dados bancários inválidos'),
  body('chavePix')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Chave PIX inválida'),
  body('telefone')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Telefone inválido'),
  body('especialidades')
    .optional({ values: 'falsy' })
    .isArray()
    .withMessage('Especialidades deve ser uma lista'),
  body('especialidades.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Cada especialidade deve ter no máximo 100 caracteres'),
  handleValidationErrors,
];

/**
 * Valida parâmetros UUID (ex.: :id em rotas /:id)
 */
export const validateUUIDParam = (paramName: string) => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} inválido`),
  handleValidationErrors,
];

/**
 * Valida query string UUID (ex.: ?escalaId=...)
 */
export const validateUUIDQuery = (queryName: string) => [
  query(queryName)
    .isUUID()
    .withMessage(`${queryName} inválido`),
  handleValidationErrors,
];

/** POST /ponto/solicitar-troca-plantao */
export const validateSolicitarTrocaPlantao = [
  body('plantaoId').notEmpty().isUUID().withMessage('plantaoId inválido'),
  body('medicoDestinoId').notEmpty().isUUID().withMessage('medicoDestinoId inválido'),
  handleValidationErrors,
];

/**
 * Check-in: validar tipos e limites básicos.
 * A regra de negócio (geolocalização obrigatória quando há config) está no service.
 */
export const validateCheckin = [
  body('escalaId')
    .notEmpty()
    .isUUID()
    .withMessage('escalaId inválido'),
  body('observacao')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('observacao inválida'),
  body('latitude')
    .optional({ values: 'null' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude inválida'),
  body('longitude')
    .optional({ values: 'null' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude inválida'),
  handleValidationErrors,
];

/**
 * Check-in sem foto (câmera indisponível): mesmo corpo que validateCheckin + motivo obrigatório.
 */
export const validateCheckinSemFoto = [
  body('escalaId')
    .notEmpty()
    .isUUID()
    .withMessage('escalaId inválido'),
  body('observacao')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('observacao inválida'),
  body('latitude')
    .optional({ values: 'null' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude inválida'),
  body('longitude')
    .optional({ values: 'null' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude inválida'),
  body('motivoSemFoto')
    .notEmpty()
    .isString()
    .trim()
    .isLength({ min: 15, max: 500 })
    .withMessage('motivoSemFoto deve ter entre 15 e 500 caracteres'),
  handleValidationErrors,
];

/** Foto obrigatória após multer (check-in). */
export const requireCheckinFoto = (req: Request, res: Response, next: NextFunction) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'Foto obrigatória para check-in. Envie uma imagem JPEG, PNG ou WebP (máx. 5 MB).',
    });
  }
  return next();
};

/** Check-in multipart: mesmo corpo que validateCheckin; remove arquivo enviado se validação falhar. */
const handleCheckinMultipartValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  return next();
};

export const validateCheckinMultipart = [
  body('escalaId')
    .notEmpty()
    .isUUID()
    .withMessage('escalaId inválido'),
  body('observacao')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('observacao inválida'),
  body('latitude')
    .optional({ values: 'null' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude inválida'),
  body('longitude')
    .optional({ values: 'null' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude inválida'),
  handleCheckinMultipartValidationErrors,
];

/**
 * Checkout: valida tipos e limites básicos.
 * A regra de negócio (geolocalização obrigatória quando há config) está no service.
 */
export const validateCheckout = [
  body('observacao')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('observacao inválida'),
  body('latitude')
    .optional({ values: 'null' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude inválida'),
  body('longitude')
    .optional({ values: 'null' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude inválida'),
  handleValidationErrors,
];

/**
 * Escala: valida criação e update.
 */
export const validateCreateEscala = [
  body('nome')
    .notEmpty()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('nome inválido'),
  body('contratoAtivoId')
    .notEmpty()
    .isUUID()
    .withMessage('contratoAtivoId inválido'),
  body('descricao')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 4000 })
    .withMessage('descricao inválida'),
  body('dataInicio')
    .notEmpty()
    .isISO8601()
    .withMessage('dataInicio inválida'),
  body('dataFim')
    .notEmpty()
    .isISO8601()
    .withMessage('dataFim inválida'),
  body('ativo')
    .optional({ values: 'falsy' })
    .isBoolean()
    .withMessage('ativo deve ser booleano'),
  handleValidationErrors,
];

export const validateUpdateEscala = [
  body('contratoAtivoId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('contratoAtivoId inválido'),
  body('nome')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('nome inválido'),
  body('descricao')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 4000 })
    .withMessage('descricao inválida'),
  body('dataInicio')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('dataInicio inválida'),
  body('dataFim')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('dataFim inválida'),
  body('ativo')
    .optional({ values: 'null' })
    .isBoolean()
    .withMessage('ativo deve ser booleano'),
  handleValidationErrors,
];

/**
 * Escala Plantão (POST /escalas/:id/plantoes)
 */
export const validateCreateEscalaPlantao = [
  body('data')
    .notEmpty()
    .isISO8601()
    .withMessage('data inválida'),
  body('gradeId')
    .notEmpty()
    .isString()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('gradeId inválido'),
  body('medicoId')
    .notEmpty()
    .isUUID()
    .withMessage('medicoId inválido'),
  body('valorHora')
    .optional({ values: 'null' })
    .isFloat()
    .withMessage('valorHora inválido'),
  handleValidationErrors,
];

/**
 * Escala: alocar médico na escala (POST /escalas/:id/medicos)
 */
export const validateAlocarMedicoEscala = [
  body('medicoId')
    .notEmpty()
    .isUUID()
    .withMessage('medicoId inválido'),
  body('cargo')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('cargo inválido'),
  body('valorHora')
    .optional({ values: 'null' })
    .isFloat()
    .withMessage('valorHora inválido'),
  handleValidationErrors,
];
