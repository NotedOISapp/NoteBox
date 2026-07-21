import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/index.js';
import {
  users,
  userProfiles,
  privacyPreferences,
  consentEvents,
  sessions,
  refreshTokens,
  reauthenticationChallenges
} from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { encrypt, decrypt, sha256Hash } from '../utils/crypto.js';
import { authRateLimiter } from '../middleware/rate-limit.js';
import { trackEvent } from '../utils/telemetry.js';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.js';
import { logError, logWarn } from '../utils/logger.js';
import { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } from '../config/env.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { verifyAppleIdentityToken } from '../utils/appleAuth.js';

const router = Router();

const appleSchema = z.object({
  identityToken: z.string().min(1),
  appleId: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  displayName: z.string().optional(),
  authorizationCode: z.string().optional()
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const challengeSchema = z.object({
  purpose: z.string().min(1)
});

const verifyChallengeSchema = z.object({
  challengeId: z.string().min(1),
  challenge: z.string().min(1),
  identityToken: z.string().min(1),
  purpose: z.string().optional()
});

// Helper to encrypt cached rotation response using AES-256-GCM
function encryptResponse(data: any, sessionId: string, tokenFamilyId: string, parentTokenId: string | null, idempotencyKeyHash: string | null): string {
  const payload = JSON.stringify({
    data,
    sessionId,
    tokenFamilyId,
    parentTokenId,
    idempotencyKeyHash
  });
  return encrypt(payload);
}

// Helper to decrypt cached rotation response and verify context bindings
function decryptResponse(ciphertext: string, sessionId: string, tokenFamilyId: string, parentTokenId: string | null, idempotencyKeyHash: string | null): any {
  const decrypted = decrypt(ciphertext);
  const parsed = JSON.parse(decrypted);
  if (
    parsed.sessionId !== sessionId ||
    parsed.tokenFamilyId !== tokenFamilyId ||
    parsed.parentTokenId !== parentTokenId ||
    parsed.idempotencyKeyHash !== idempotencyKeyHash
  ) {
    throw new Error('Cryptographic context mismatch on retry response');
  }
  return parsed.data;
}

/**
 * Helper to generate access and refresh tokens bound to database sessionId
 */
function generateTokens(userId: string, sessionId: string, tokenId: string, email?: string, role: string = 'user') {
  const accessToken = jwt.sign({ userId, email, role, sessionId }, JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign({ userId, sessionId, tokenId }, JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
}

/**
 * POST /v1/auth/age-gate
 */
router.post('/age-gate', authRateLimiter, async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    error: 'EndpointRetired',
    message: 'Date-of-birth collection is not supported. Sign in, then use /v1/auth/eligibility for adult self-attestation.',
  });
});

/**
 * POST /v1/auth/apple
 */
router.post('/apple', authRateLimiter, validateRequest({ body: appleSchema }), async (req: Request, res: Response): Promise<void> => {
  const { identityToken, email, displayName, authorizationCode } = req.body;

  try {
    const decoded = jwt.decode(identityToken) as any;
    if (!decoded || typeof decoded !== 'object' || !decoded.sub) {
      res.status(400).json({ error: 'ValidationError', message: 'Invalid identityToken' });
      return;
    }

    const nonce = decoded.nonce || '';
    const sub = decoded.sub;

    const { verifyAppleIdentityToken } = await import('../utils/appleAuth.js');
    await verifyAppleIdentityToken(identityToken, nonce, sub);

    const appleId = sub;
    let appleRefreshToken: string | null = null;
    let appleAccessToken: string | null = null;

    if (!authorizationCode && process.env.NODE_ENV !== 'test') {
      res.status(400).json({
        error: 'AppleAuthorizationCodeRequired',
        message: 'Apple did not provide an authorization code. Please try signing in again.',
      });
      return;
    }

    if (authorizationCode) {
      try {
        const { exchangeAppleCode } = await import('../utils/appleRevoke.js');
        const tokens = await exchangeAppleCode(authorizationCode);
        appleRefreshToken = encrypt(tokens.refreshToken);
        appleAccessToken = encrypt(tokens.accessToken);
      } catch (err) {
        logWarn('Failed to exchange Apple authorization code during login', err);
        if (process.env.NODE_ENV !== 'test') {
          res.status(401).json({
            error: 'AppleAuthorizationFailed',
            message: 'Apple authorization could not be verified. Please try signing in again.',
          });
          return;
        }
      }
    }

    let [user] = await db.select().from(users).where(eq(users.appleId, appleId)).limit(1);

    const emailEnc = email ? encrypt(email) : null;
    const emailHash = email ? sha256Hash(email) : null;

    if (!user) {
      const [newUser] = await db.insert(users).values({
        email: emailEnc,
        emailHash: emailHash,
        appleId,
        appleRefreshToken,
        appleAccessToken,
        status: 'active',
        ageAttested: false,
      }).returning();
      user = newUser;

      await db.insert(userProfiles).values({
        userId: user.id,
        displayName: displayName || email?.split('@')[0] || 'NoteBox User',
        username: `user_${user.id.substring(0, 8)}`,
      });

      await db.insert(privacyPreferences).values({
        userId: user.id,
        targetedAdsAllowed: false,
        saleOrShareAllowed: false,
        aiProcessingAllowed: false,
        thirdPartyAiAllowed: false,
      });

      await db.insert(consentEvents).values({
        userId: user.id,
        purpose: 'third_party_ai',
        granted: false,
        method: 'in_app_onboarding',
        ip: req.ip || '0.0.0.0',
        device: req.headers['user-agent'] || 'unknown',
        policyVersion: '1.0',
      });
    } else {
      if (appleRefreshToken || appleAccessToken) {
        await db.update(users).set({
          appleRefreshToken,
          appleAccessToken,
          updatedAt: new Date()
        }).where(eq(users.id, user.id));
      }
    }

    if (user.status === 'suspended') {
      res.status(403).json({ error: 'Forbidden', message: 'Account is suspended' });
      return;
    }
    if (user.status === 'deleted') {
      res.status(403).json({ error: 'Forbidden', message: 'Account has been deleted' });
      return;
    }
    if (user.status === 'deletion_pending') {
      res.status(403).json({ error: 'Forbidden', message: 'Account deletion is pending.' });
      return;
    }

    // Create session & first refresh token in transaction
    const { accessToken, refreshToken, session, tokenRecord } = await db.transaction(async (tx) => {
      const [sess] = await tx.insert(sessions).values({
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }).returning();

      const tokenId = crypto.randomUUID();
      const tokens = generateTokens(user.id, sess.id, tokenId, email || undefined);
      const tokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');

      const [tr] = await tx.insert(refreshTokens).values({
        id: tokenId,
        sessionId: sess.id,
        tokenFamilyId: crypto.randomUUID(),
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).returning();

      return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, session: sess, tokenRecord: tr };
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: email || null,
        status: user.status,
        ageAttested: user.ageAttested,
      },
    });
  } catch (error) {
    logError('Apple Sign-In Error', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to authenticate user' });
  }
});

/**
 * GET /v1/auth/eligibility
 */
router.get('/eligibility', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: 'NotFoundError', message: 'User not found' });
      return;
    }
    res.json({
      ageAttested: user.ageAttested,
      ageAttestedAt: user.ageAttestedAt,
      ageAttestationVersion: user.ageAttestationVersion,
    });
  } catch (error) {
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to fetch eligibility' });
  }
});

/**
 * POST /v1/auth/eligibility
 */
router.post('/eligibility', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: 'NotFoundError', message: 'User not found' });
      return;
    }

    await db.update(users).set({
      ageAttested: true,
      ageAttestedAt: new Date(),
      ageAttestationVersion: '1.0',
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    await trackEvent(userId, 'age_eligibility_confirmed');
    res.json({ success: true, ageAttested: true });
  } catch (error) {
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to record eligibility' });
  }
});

/**
 * POST /v1/auth/eligibility/decline
 */
router.post('/eligibility/decline', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: 'NotFoundError', message: 'User not found' });
      return;
    }

    await trackEvent(userId, 'age_eligibility_declined');
    await db.delete(users).where(eq(users.id, userId));
    res.json({ success: true, message: 'Eligibility declined. Minimal auth stub deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to decline eligibility' });
  }
});

/**
 * POST /v1/auth/refresh
 * Strategy 1 Hashed RTR & Idempotency Key Retry Caching
 */
router.post('/refresh', validateRequest({ body: refreshSchema }), async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  const idempotencyKey = req.headers['idempotency-key'] as string;
  const keyHash = idempotencyKey ? crypto.createHash('sha256').update(idempotencyKey).digest('hex') : null;

  try {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const result = await db.transaction(async (tx) => {
      // 1. Lock current refresh token row to prevent concurrent races
      const [rt] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1).for('update');
      if (!rt) {
        throw new Error('UNAUTHORIZED');
      }

      // 2. Fetch parent session and user state
      const [sess] = await tx.select().from(sessions).where(eq(sessions.id, rt.sessionId)).limit(1);
      if (!sess) {
        throw new Error('UNAUTHORIZED');
      }

      const [user] = await tx.select().from(users).where(eq(users.id, sess.userId)).limit(1);
      if (!user) {
        throw new Error('UNAUTHORIZED');
      }

      // 3. Replay / Retry Assessment
      if (rt.consumedAt) {
        // If already consumed, check Strategy 1 Idempotency retry
        if (keyHash && rt.idempotencyKeyHash === keyHash && rt.retryResponseExpiresAt && new Date(rt.retryResponseExpiresAt) > new Date()) {
          // Validate server state before returning cached response
          if (
            sess.revokedAt ||
            new Date(sess.expiresAt) <= new Date() ||
            user.status !== 'active' ||
            rt.revokedAt
          ) {
            throw new Error('UNAUTHORIZED');
          }
          // Verify that replacement token still exists and is not revoked/expired
          if (rt.replacedByTokenId) {
            const [child] = await tx.select().from(refreshTokens).where(eq(refreshTokens.id, rt.replacedByTokenId)).limit(1);
            if (!child || child.revokedAt || new Date(child.expiresAt) <= new Date()) {
              throw new Error('UNAUTHORIZED');
            }
          }

          // Decrypt and return cached credentials safely
          const decrypted = decryptResponse(rt.retryResponseCiphertext!, rt.sessionId, rt.tokenFamilyId, rt.parentTokenId, keyHash);
          return { status: 200, data: decrypted };
        }

        // Mismatched idempotency key or expired retry response: Replay attack confirmed. Revoke family!
        await tx.update(refreshTokens)
          .set({ revokedAt: new Date(), reuseDetectedAt: new Date() })
          .where(eq(refreshTokens.tokenFamilyId, rt.tokenFamilyId));
        await tx.update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.id, rt.sessionId));

        throw new Error('UNAUTHORIZED');
      }

      // 4. Token validation (not yet consumed)
      if (rt.revokedAt || new Date(rt.expiresAt) <= new Date() || sess.revokedAt || new Date(sess.expiresAt) <= new Date() || user.status !== 'active') {
        throw new Error('UNAUTHORIZED');
      }

      // 5. Rotate and create exactly one replacement token
      const newTokenId = crypto.randomUUID();
      const tokens = generateTokens(user.id, sess.id, newTokenId, undefined);
      const newTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');

      const responsePayload = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };

      const encryptedCipher = encryptResponse(responsePayload, sess.id, rt.tokenFamilyId, rt.id, keyHash);

      // Insert child token
      await tx.insert(refreshTokens).values({
        id: newTokenId,
        sessionId: sess.id,
        tokenFamilyId: rt.tokenFamilyId,
        parentTokenId: rt.id,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Update parent token to link replacement and store GCM retry payload
      await tx.update(refreshTokens).set({
        consumedAt: new Date(),
        replacedByTokenId: newTokenId,
        idempotencyKeyHash: keyHash,
        retryResponseCiphertext: encryptedCipher,
        retryResponseExpiresAt: new Date(Date.now() + 30 * 1000), // 30 seconds retry window
      }).where(eq(refreshTokens.id, rt.id));

      return { status: 200, data: responsePayload };
    });

    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
  }
});

/**
 * POST /v1/auth/logout
 */
router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const sessionId = req.user?.sessionId;
  if (sessionId) {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.sessionId, sessionId));
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * POST /v1/auth/reauthenticate/challenge
 */
router.post('/reauthenticate/challenge', authMiddleware, validateRequest({ body: challengeSchema }), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { purpose } = req.body;
  const userId = req.user!.userId;
  const sessionId = req.user!.sessionId!;

  try {
    const rawChallenge = crypto.randomBytes(32).toString('hex');
    const challengeHash = crypto.createHash('sha256').update(rawChallenge).digest('hex');

    const [challenge] = await db.insert(reauthenticationChallenges).values({
      sessionId,
      userId,
      purpose,
      challengeHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    }).returning();

    res.json({
      challengeId: challenge.id,
      challenge: rawChallenge,
    });
  } catch (error) {
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to generate re-authentication challenge' });
  }
});

/**
 * POST /v1/auth/reauthenticate
 * Atomic Apple Challenge Consumption and Session Update
 */
router.post('/reauthenticate', authMiddleware, validateRequest({ body: verifyChallengeSchema }), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { challengeId, challenge, identityToken, purpose } = req.body;
  const userId = req.user!.userId;
  const sessionId = req.user!.sessionId!;

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.appleId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User or Apple ID not found' });
      return;
    }

    // Verify Apple identity JWT signature and nonce
    await verifyAppleIdentityToken(identityToken, challenge, user.appleId);

    const verifiedHash = crypto.createHash('sha256').update(challenge).digest('hex');

    await db.transaction(async (tx) => {
      // Fetch user state inside the transaction to check deletion_pending
      const [u] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!u || u.status === 'deletion_pending') {
        throw new Error('BLOCKED');
      }

      // Fetch the challenge record and perform strict validation
      const [challengeRecord] = await tx
        .select()
        .from(reauthenticationChallenges)
        .where(eq(reauthenticationChallenges.id, challengeId))
        .limit(1);

      if (
        !challengeRecord ||
        challengeRecord.consumedAt ||
        new Date(challengeRecord.expiresAt) <= new Date() ||
        challengeRecord.userId !== userId ||
        challengeRecord.sessionId !== sessionId ||
        challengeRecord.challengeHash !== verifiedHash
      ) {
        throw new Error('BLOCKED');
      }

      if (purpose && challengeRecord.purpose !== purpose) {
        throw new Error('BLOCKED');
      }

      // 1. Consume challenge atomically
      const challengeUpdate = await tx.update(reauthenticationChallenges)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(reauthenticationChallenges.id, challengeId),
            isNull(reauthenticationChallenges.consumedAt)
          )
        );

      if (challengeUpdate.rowCount !== 1) {
        throw new Error('BLOCKED');
      }

      // 2. Promote session reauthentication status
      const sessionUpdate = await tx.update(sessions)
        .set({ reauthenticatedAt: new Date() })
        .where(
          and(
            eq(sessions.id, sessionId),
            eq(sessions.userId, userId),
            isNull(sessions.revokedAt)
          )
        );

      if (sessionUpdate.rowCount !== 1) {
        throw new Error('BLOCKED');
      }
    });

    res.json({ success: true, message: 'Reauthenticated successfully' });
  } catch (error: any) {
    res.status(401).json({ error: 'Unauthorized', message: 'Re-authentication failed' });
  }
});

export default router;
