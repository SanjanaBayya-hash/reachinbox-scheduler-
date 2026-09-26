import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import type { AuthUser } from '../../types/express';

const EXPIRES_IN = '7d';

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthUser {
  return jwt.verify(token, env.JWT_SECRET) as AuthUser;
}
