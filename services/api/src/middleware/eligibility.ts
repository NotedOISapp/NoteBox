import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';

export function eligibilityMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
    return;
  }

  if (!req.user.ageAttested) {
    res.status(403).json({
      error: 'EligibilityRequired',
      message: 'Adult eligibility attestation is required before accessing private content.',
    });
    return;
  }

  next();
}
