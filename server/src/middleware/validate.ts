import { body, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export function validate(chains: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(chains.map((chain) => chain.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    next();
  };
}

export const calculateValidation: ValidationChain[] = [
  body('assessmentYear').isIn(['2026-27', '2025-26']).withMessage('Invalid assessment year'),
  body('userType')
    .isIn(['salaried', 'business', 'freelancer', 'retired', 'homemaker', 'self_employed', 'huf', 'aop', 'boi'])
    .withMessage('Invalid user type'),
  body('age').isInt({ min: 0, max: 120 }).withMessage('Age must be between 0 and 120'),
  body('residentialStatus')
    .isIn(['resident', 'nri', 'rnor'])
    .withMessage('Invalid residential status'),
];
