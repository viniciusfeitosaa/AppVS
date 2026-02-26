import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
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
  body('crm')
    .isString()
    .custom((value) => {
      if (!validateCRM(value)) {
        throw new Error('CRM inválido');
      }
      return true;
    }),
  body('especialidade')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Especialidade é obrigatória')
    .isLength({ max: 100 })
    .withMessage('Especialidade inválida'),
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
  body('especialidade')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Especialidade inválida'),
  handleValidationErrors,
];
