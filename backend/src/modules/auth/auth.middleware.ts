import type { NextFunction, Request, Response } from 'express';
import { JWT_COOKIE_NAME } from '../../config/constants';
import { verifyAuthToken } from './jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[JWT_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    req.authUser = verifyAuthToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}
