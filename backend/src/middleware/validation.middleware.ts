import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { validateCPF, validateCRM } from '../utils/validation.util';

/**
 * Validação de login
 */
export const validateLogin = [
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

  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    return next();
  },
];
