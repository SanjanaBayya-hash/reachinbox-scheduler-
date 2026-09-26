import { Router } from 'express';
import type { User } from '@prisma/client';
import { env } from '../../config/env';
import { JWT_COOKIE_NAME } from '../../config/constants';
import { passport } from './passport';
import { signAuthToken } from './jwt';
import { requireAuth } from './auth.middleware';

export const authRouter = Router();

authRouter.get(
  '/google',
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] }),
);

authRouter.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=1` }),
  (req, res) => {
    const user = req.user as User;
    const token = signAuthToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });

    res.cookie(JWT_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  },
);

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.authUser });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(JWT_COOKIE_NAME);
  res.status(204).end();
});
