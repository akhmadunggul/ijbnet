import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { User, UserMfaBackupCode } from '../db/models/index';
import { signAccessToken, signRefreshToken, verifyRefreshToken, decodeToken, ttlSeconds } from '../utils/jwt';
import { blacklistToken, isTokenBlacklisted } from '../utils/redis';
import { serializeUser } from '../serializers/candidate';
import { authenticate, requireRole } from '../middleware/auth';
import passport from '../config/passport';
import { config } from '../config';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Please try again later.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password, totpCode } = req.body as {
    email?: string;
    password?: string;
    totpCode?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Email and password are required.' });
    return;
  }

  const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

  // Always do bcrypt comparison to prevent timing attacks
  const dummyHash = '$2b$12$invalidhashpaddingtomatchlength000000000000000000000000';
  const passwordMatch = user?.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, dummyHash).then(() => false);

  if (!user || !passwordMatch || !user.isActive) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    return;
  }

  // MFA check for super_admin with mfaSecret configured
  if (user.mfaSecret) {
    if (!totpCode) {
      res.status(200).json({ requiresMfa: true });
      return;
    }
    const valid = authenticator.verify({ token: totpCode, secret: user.mfaSecret });
    if (!valid) {
      // Fall back to backup codes
      const backupCodes = await UserMfaBackupCode.findAll({ where: { userId: user.id } });
      let usedCode: typeof backupCodes[number] | null = null;
      for (const bc of backupCodes) {
        if (await bcrypt.compare(totpCode, bc.codeHash)) {
          usedCode = bc;
          break;
        }
      }
      if (!usedCode) {
        res.status(401).json({ error: 'INVALID_CREDENTIALS' });
        return;
      }
      await usedCode.destroy();
    }
  }

  const tokenPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    ...(user.mfaSecret ? { mfaVerified: true } : {}),
  };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await user.update({ lastLoginAt: new Date() });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  });

  res.json({ accessToken, user: serializeUser(user.toJSON() as unknown as Record<string, unknown>) });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token = (req.cookies as Record<string, string>)['refreshToken'];
  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'No refresh token.' });
    return;
  }

  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Refresh token has been revoked.' });
      return;
    }

    const payload = verifyRefreshToken(token);
    const user = await User.findByPk(payload.sub);
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    // Rotate: blacklist the used refresh token and issue a new one
    await blacklistToken(token, ttlSeconds(payload));
    const newRefreshToken = signRefreshToken({ sub: user.id, role: user.role, email: user.email });
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired refresh token.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (token) {
    const decoded = decodeToken(token);
    if (decoded) {
      await blacklistToken(token, ttlSeconds(decoded));
    }
  }

  // Also blacklist the refresh token so it cannot be replayed
  const refreshToken = (req.cookies as Record<string, string>)['refreshToken'];
  if (refreshToken) {
    try {
      const refreshPayload = verifyRefreshToken(refreshToken);
      await blacklistToken(refreshToken, ttlSeconds(refreshPayload));
    } catch {
      // Already expired or invalid — nothing to blacklist
    }
  }

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.json({ message: 'Logged out.' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.user!.sub);
  if (!user) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  res.json({ user: serializeUser(user.toJSON() as unknown as Record<string, unknown>) });
});

// GET /api/auth/google — redirect to Google OAuth consent screen
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// GET /api/auth/google/callback — OAuth callback from Google
router.get(
  '/google/callback',
  (req: Request, res: Response, next) => {
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${config.FRONTEND_URL}/auth/login?error=oauth_failed`,
    }, (err: Error | null, user: Express.User | false, info: unknown) => {
      if (err) {
        console.error('[Google Callback Error]', err);
        return res.redirect(`${config.FRONTEND_URL}/auth/login?error=oauth_failed`);
      }
      if (!user) {
        console.error('[Google Callback No User]', info);
        return res.redirect(`${config.FRONTEND_URL}/auth/login?error=oauth_failed`);
      }
      const oauthUser = user as unknown as { id: string; role: string; email: string };
      const payload = { sub: oauthUser.id, role: oauthUser.role, email: oauthUser.email };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.redirect(`${config.FRONTEND_URL}/auth/callback?token=${accessToken}`);
    })(req, res, next);
  }
);

// ── MFA Setup/Verify/Disable (super_admin only) ───────────────────────────────

// GET /api/auth/mfa/setup — generate secret + QR code (do not save yet)
router.get('/mfa/setup', authenticate, requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.user!.sub, { attributes: ['id', 'email'] });
  if (!user) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(user.email, 'IJBNet', secret);
  const qrCodeBase64 = await QRCode.toDataURL(otpAuthUrl);
  res.json({ secret, otpAuthUrl, qrCodeBase64 });
});

// POST /api/auth/mfa/verify — verify TOTP, save secret, generate backup codes
router.post('/mfa/verify', authenticate, requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.user!.sub, { attributes: ['id', 'email', 'mfaSecret'] });
  if (!user) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }

  const { secret, totp } = req.body as { secret?: string; totp?: string };
  if (!secret || !totp) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'secret and totp are required.' });
    return;
  }

  const isValid = authenticator.verify({ token: totp, secret });
  if (!isValid) {
    res.status(400).json({ error: 'INVALID_TOTP' });
    return;
  }

  await user.update({ mfaSecret: secret });

  // Generate 10 backup codes
  const rawCodes = Array.from({ length: 10 }, () => uuidv4().replace(/-/g, '').slice(0, 10));
  // Clear old backup codes
  await UserMfaBackupCode.destroy({ where: { userId: user.id } });
  // Save hashed backup codes
  await Promise.all(rawCodes.map(async (code) => {
    const codeHash = await bcrypt.hash(code, 10);
    return UserMfaBackupCode.create({ userId: user.id, codeHash });
  }));

  res.json({ backupCodes: rawCodes });
});

// DELETE /api/auth/mfa — disable MFA after verifying TOTP
router.delete('/mfa', authenticate, requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.user!.sub, { attributes: ['id', 'mfaSecret'] });
  if (!user) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  if (!user.mfaSecret) {
    res.status(400).json({ error: 'MFA_NOT_ENABLED', message: 'MFA is not enabled.' });
    return;
  }

  const { totp } = req.body as { totp?: string };
  if (!totp) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'totp is required.' });
    return;
  }

  const isValid = authenticator.verify({ token: totp, secret: user.mfaSecret });
  if (!isValid) {
    res.status(400).json({ error: 'INVALID_TOTP' });
    return;
  }

  await user.update({ mfaSecret: null });
  await UserMfaBackupCode.destroy({ where: { userId: user.id } });

  res.json({ message: 'MFA disabled.' });
});

export default router;
