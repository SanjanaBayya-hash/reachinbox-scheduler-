import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('Google profile did not include an email address'));
        }

        const user = await prisma.user.upsert({
          where: { googleId: profile.id },
          update: {
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value ?? null,
            email,
          },
          create: {
            googleId: profile.id,
            email,
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value ?? null,
          },
        });

        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    },
  ),
);

export { passport };
