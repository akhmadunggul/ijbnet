import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { Profile, VerifyCallback } from 'passport-google-oauth20';
import { config } from '../config';
import { User, Candidate } from '../db/models/index';

if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: config.GOOGLE_CALLBACK_URL,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
      ) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email returned from Google.'));
          }

          const normalizedEmail = email.toLowerCase();

          // Prefer lookup by googleId (fastest, most stable)
          let user = await User.findOne({ where: { googleId: profile.id } });

          if (!user) {
            // Check for an existing account with the same email
            user = await User.findOne({ where: { email: normalizedEmail } });

            if (user) {
              // Existing account — link Google ID
              if (!user.isActive) {
                return done(null, false);
              }
              await user.update({
                googleId: profile.id,
                avatarUrl: profile.photos?.[0]?.value ?? user.avatarUrl,
                lastLoginAt: new Date(),
              });
            } else {
              // No account found — create a new candidate user + profile
              user = await User.create({
                email: normalizedEmail,
                name: profile.displayName ?? null,
                googleId: profile.id,
                role: 'candidate',
                avatarUrl: profile.photos?.[0]?.value ?? null,
                lastLoginAt: new Date(),
              });

              const count = await Candidate.count();
              const candidateCode = `CDT-${String(count + 1).padStart(4, '0')}`;
              await Candidate.create({
                userId: user.id,
                candidateCode,
                fullName: profile.displayName ?? '',
                profileStatus: 'incomplete',
                consentGiven: false,
              });
            }
          } else {
            if (!user.isActive) {
              return done(null, false);
            }
            await user.update({ lastLoginAt: new Date() });
          }

          return done(null, user.toJSON() as unknown as Express.User);
        } catch (err) {
          console.error('[Google OAuth Error]', err);
          return done(err as Error);
        }
      },
    ),
  );
}

export default passport;
