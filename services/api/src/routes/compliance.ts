import { Router, Request, Response } from 'express';
import { AuthenticatedRequest, authMiddleware, recentAuthMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import {
  users,
  privacyPreferences,
  consentEvents,
  dataExports,
  dsarRequests,
  accountDeletionJobs,
  sessions
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logPrivacyAction } from '../middleware/audit.js';
import { trackEvent } from '../utils/telemetry.js';
import { logInfo, logWarn, logError } from '../utils/logger.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_ACCESS_SECRET } from '../config/env.js';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.js';
import { getStorage } from '../compliance/storage.js';

import { getEffectiveEntitlement } from '../services/entitlementResolver.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';

const router = Router();


// In-memory rate limiting map for deletion status token checks
// Map of rateLimitKey -> { count, lockedUntil }
const failedChecks = new Map<string, { count: number; lockedUntil: number }>();

const preferencesSchema = z.object({
  targetedAdsAllowed: z.boolean().optional(),
  saleOrShareAllowed: z.boolean().optional(),
  aiProcessingAllowed: z.boolean().optional(),
  thirdPartyAiAllowed: z.boolean().optional(),
});

const consentSchema = z.object({
  purpose: z.enum(['ai_processing', 'third_party_ai', 'targeted_ads', 'sale_share', 'analytics']),
  granted: z.boolean(),
});

const dsarSchema = z.object({
  requestType: z.enum(['access', 'delete', 'correct', 'portability', 'opt_out_sale', 'opt_out_share']),
});

const exportSchema = z.object({
  format: z.enum(['json', 'zip']).optional(),
});

/**
 * PATCH /v1/privacy/preferences
 * Update general privacy preferences
 */
router.patch(
  ['/privacy/preferences', '/preferences'],
  authMiddleware,
  validateRequest({ body: preferencesSchema }),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { targetedAdsAllowed, saleOrShareAllowed, aiProcessingAllowed, thirdPartyAiAllowed } = req.body;
    const userId = req.user!.userId;

    try {
      const [existing] = await db
        .select()
        .from(privacyPreferences)
        .where(eq(privacyPreferences.userId, userId))
        .limit(1);

      const updateFields = {
        ...(targetedAdsAllowed !== undefined && { targetedAdsAllowed }),
        ...(saleOrShareAllowed !== undefined && { saleOrShareAllowed }),
        ...(aiProcessingAllowed !== undefined && { aiProcessingAllowed }),
        ...(thirdPartyAiAllowed !== undefined && { thirdPartyAiAllowed }),
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(privacyPreferences).set(updateFields).where(eq(privacyPreferences.userId, userId));
      } else {
        await db.insert(privacyPreferences).values({
          userId,
          ...updateFields,
        });
      }

      await logPrivacyAction({
        actor: 'user',
        actorId: userId,
        action: 'update_privacy_preferences',
        targetType: 'privacy_preferences',
        targetId: userId,
        ip: req.ip || null,
        requestId: req.requestId || null,
      });

      res.json({ success: true, preferences: updateFields });
    } catch (error) {
      logError('Error updating privacy preferences', error);
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to update preferences' });
    }
  }
);

/**
 * PATCH /v1/privacy/consent
 * Track a consent event (e.g. enabling AI processing)
 */
router.patch(
  ['/privacy/consent', '/consent', '/permissions/consent'],
  authMiddleware,
  validateRequest({ body: consentSchema }),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { purpose, granted } = req.body;
    const userId = req.user!.userId;

    try {
      const [event] = await db
        .insert(consentEvents)
        .values({
          userId,
          purpose: purpose as any,
          granted,
          method: 'in_app_prompt',
          ip: req.ip || '0.0.0.0',
          device: req.headers['user-agent'] || 'unknown',
          policyVersion: '1.0',
          ...(granted ? {} : { withdrawnAt: new Date() }),
        })
        .returning();

      // Sync to preferences
      const prefFields: Record<string, boolean> = {};
      if (purpose === 'ai_processing') prefFields.aiProcessingAllowed = granted;
      if (purpose === 'third_party_ai') prefFields.thirdPartyAiAllowed = granted;
      if (purpose === 'targeted_ads') prefFields.targetedAdsAllowed = granted;
      if (purpose === 'sale_share') prefFields.saleOrShareAllowed = granted;

      if (Object.keys(prefFields).length > 0) {
        await db
          .update(privacyPreferences)
          .set({ ...prefFields, updatedAt: new Date() })
          .where(eq(privacyPreferences.userId, userId));
      }

      await logPrivacyAction({
        actor: 'user',
        actorId: userId,
        action: granted ? 'grant_consent' : 'revoke_consent',
        targetType: 'consent_event',
        targetId: event.id,
        ip: req.ip || null,
        requestId: req.requestId || null,
      });

      res.json({ success: true, consentEvent: event });
    } catch (error) {
      logError('Error updating consent', error);
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to update consent' });
    }
  }
);

/**
 * POST /v1/privacy/opt-out
 * CCPA Do Not Sell/Share Opt-Out
 */
router.post(
  ['/privacy/opt-out', '/opt-out'],
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;

    try {
      await db
        .update(privacyPreferences)
        .set({
          saleOrShareAllowed: false,
          targetedAdsAllowed: false,
          updatedAt: new Date(),
        })
        .where(eq(privacyPreferences.userId, userId));

      await db.insert(consentEvents).values({
        userId,
        purpose: 'sale_share',
        granted: false,
        method: 'do_not_sell_opt_out',
        ip: req.ip || '0.0.0.0',
        device: req.headers['user-agent'] || 'unknown',
        policyVersion: '1.0',
        withdrawnAt: new Date(),
      });

      await logPrivacyAction({
        actor: 'user',
        actorId: userId,
        action: 'opt_out_sale_share',
        targetType: 'privacy_preferences',
        targetId: userId,
        ip: req.ip || null,
        requestId: req.requestId || null,
      });

      res.json({ success: true, message: 'Opted out of sale/share and targeted advertising successfully.' });
    } catch (error) {
      logError('Error processing opt-out', error);
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to opt out' });
    }
  }
);

/**
 * POST /v1/privacy/request
 * File a DSAR Request
 */
router.post(
  ['/privacy/request', '/request'],
  authMiddleware,
  validateRequest({ body: dsarSchema }),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { requestType } = req.body;
    const userId = req.user!.userId;

    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 45); // 45-day SLA

      const [dsar] = await db
        .insert(dsarRequests)
        .values({
          userId,
          requestType: requestType as any,
          identityVerified: true,
          status: 'pending',
          dueDate,
        })
        .returning();

      await logPrivacyAction({
        actor: 'user',
        actorId: userId,
        action: `submit_dsar_${requestType}`,
        targetType: 'dsar_request',
        targetId: dsar.id,
        ip: req.ip || null,
        requestId: req.requestId || null,
      });

      await trackEvent(userId, 'privacy_access_request_submitted', { ticketId: dsar.id, type: requestType });

      res.status(201).json({
        success: true,
        message: 'Your privacy rights request has been received. NoteBox resolves all requests within 45 days.',
        dsar,
      });
    } catch (error) {
      logError('DSAR filing error', error);
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to file DSAR request' });
    }
  }
);

/**
 * POST /v1/privacy/export-request
 * Enqueues a data export job (requires recent reauthentication)
 */
router.post(
  ['/privacy/export-request', '/export-request'],
  authMiddleware,
  eligibilityMiddleware,
  recentAuthMiddleware,
  validateRequest({ body: exportSchema }),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const userId = req.user!.userId;
    const format = req.body.format || 'zip';

    try {
      const [exportTicket] = await db
        .insert(dataExports)
        .values({
          userId,
          format,
          status: 'pending',
          attemptCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      await logPrivacyAction({
        actor: 'user',
        actorId: userId,
        action: 'export_request',
        targetType: 'data_export',
        targetId: exportTicket.id,
        ip: req.ip || null,
        requestId: req.requestId || null,
      });

      await trackEvent(userId, 'privacy_access_request_submitted', { ticketId: exportTicket.id, type: 'export' });

      res.status(202).json({
        success: true,
        ticketId: exportTicket.id,
        status: 'pending',
      });
    } catch (error) {
      logError('Error requesting data export', error);
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to request export' });
    }
  }
);

/**
 * POST /v1/compliance/export
 * Product convenience export endpoint (Option A: Pro-only).
 * Enforces capabilities.export === true. Blocked with 402 for Free & Expired Promotional accounts.
 * Note: Legal DSAR export (/v1/privacy/export-request) remains available to all users regardless of plan.
 */
router.post(
  ['/compliance/export', '/export'],
  authMiddleware,
  eligibilityMiddleware,
  recentAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const userId = req.user!.userId;

    try {
      const entitlement = await getEffectiveEntitlement(userId);
      if (!entitlement.capabilities.export) {
        res.status(402).json({
          error: 'PAYMENT_REQUIRED',
          message: 'Product export requires an active NoteBox Pro subscription or promotional access.',
        });
        return;
      }

      const [exportTicket] = await db
        .insert(dataExports)
        .values({
          userId,
          format: 'zip',
          status: 'pending',
          attemptCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.status(202).json({
        success: true,
        ticketId: exportTicket.id,
        status: 'pending',
      });
    } catch (error) {
      logError('Error requesting product export', error);
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to request product export' });
    }
  }
);

/**
 * GET /v1/privacy/export-request/:id
 * Check status of a data export job
 */
router.get(
  '/privacy/export-request/:id',
  authMiddleware,
  eligibilityMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const userId = req.user!.userId;
    const id = req.params.id as string;

    try {
      const [ticket] = await db
        .select()
        .from(dataExports)
        .where(and(eq(dataExports.id, id), eq(dataExports.userId, userId)))
        .limit(1);

      if (!ticket) {
        res.status(404).json({ error: 'NotFoundError', message: 'Export ticket not found' });
        return;
      }

      if (ticket.status === 'ready') {
        res.json({
          success: true,
          status: 'ready',
          expiresAt: ticket.expiresAt,
          generatedAt: ticket.generatedAt,
          downloadUrl: `/v1/privacy/export-request/${ticket.id}/download`,
        });
      } else if (ticket.status === 'failed') {
        res.json({
          success: true,
          status: 'failed',
          failureCode: ticket.failureCode || 'UNKNOWN_ERROR',
        });
      } else {
        res.json({
          success: true,
          status: ticket.status,
        });
      }
    } catch (error) {
      logError('Error checking export status', error);
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to fetch export status' });
    }
  }
);

/**
 * GET /v1/privacy/export-request/:id/download
 * Streaming download of a completed export archive (requires recent reauthentication)
 */
router.get(
  '/privacy/export-request/:id/download',
  authMiddleware,
  eligibilityMiddleware,
  recentAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    const userId = req.user!.userId;
    const id = req.params.id as string;

    try {
      const [ticket] = await db
        .select()
        .from(dataExports)
        .where(and(eq(dataExports.id, id), eq(dataExports.userId, userId)))
        .limit(1);

      if (!ticket) {
        res.status(404).json({ error: 'NotFoundError', message: 'Export file not found.' });
        return;
      }

      if (ticket.status !== 'ready') {
        res.status(400).json({ error: 'ValidationError', message: 'Export is not ready for download.' });
        return;
      }

      if (ticket.expiresAt && new Date() > new Date(ticket.expiresAt)) {
        res.status(410).json({ error: 'Gone', message: 'Export link has expired.' });
        return;
      }

      const storage = getStorage();
      const key = ticket.artifactStorageKey;
      if (!key) {
        res.status(500).json({ error: 'InternalServerError', message: 'Missing storage key.' });
        return;
      }

      // Update download counts in database
      await db
        .update(dataExports)
        .set({
          downloadCount: ticket.downloadCount + 1,
          lastDownloadedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(dataExports.id, ticket.id));

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="notebox-export-${ticket.id}.zip"`);

      const stream = await storage.openObject('exports', key);
      stream.pipe(res);
    } catch (error) {
      logError('Download error', error);
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to download export.' });
    }
  }
);

/**
 * POST /v1/privacy/delete
 * Requests account deletion (puts account in deletion_pending and schedules background hard purge)
 */
router.post(
  ['/privacy/delete', '/account/delete'],
  authMiddleware,
  recentAuthMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;

    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        res.status(404).json({ error: 'NotFoundError', message: 'User not found.' });
        return;
      }

      // 1. Generate secure opaque token
      const jobId = crypto.randomUUID();
      const randomBytes = crypto.randomBytes(16).toString('hex');
      const signatureData = `${jobId}_${randomBytes}`;
      const signature = crypto.createHmac('sha256', JWT_ACCESS_SECRET).update(signatureData).digest('hex');
      const opaqueToken = `del_${jobId}_${randomBytes}_${signature}`;
      const tokenHash = crypto.createHash('sha256').update(opaqueToken).digest('hex');

      // 2. Transact: update user to deletion_pending, revoke other sessions, write job record
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ status: 'deletion_pending', deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, userId));

        // Revoke all sessions for user immediately.
        await tx
          .update(sessions)
          .set({ revokedAt: new Date(), updatedAt: new Date() })
          .where(eq(sessions.userId, userId));

        const hasAppleId = !!user.appleId;
        await tx.insert(accountDeletionJobs).values({
          id: jobId,
          userId,
          statusTokenHash: tokenHash,
          status: 'pending',
          tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          rateLimitHits: 0,
          tokenFailedAttempts: 0,
          appleRevocationStatus: hasAppleId ? 'pending' : 'not_applicable',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      await logPrivacyAction({
        actor: 'user',
        actorId: userId,
        action: 'delete_account_pending',
        targetType: 'users',
        targetId: userId,
        ip: req.ip || null,
        requestId: req.requestId || null,
      });

      await trackEvent(userId, 'account_deletion_initiated');

      res.status(202).json({
        success: true,
        message: 'Account deletion initiated. All access sessions revoked. Data will be permanently purged.',
        statusToken: opaqueToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      logError('Account deletion initiation error', error);
      res.status(500).json({ error: 'InternalServerError', message: 'Failed to initiate account deletion' });
    }
  }
);

/**
 * GET /v1/privacy/delete/status
 * Public endpoint to check deletion progress using DeletionStatus token
 */
router.get(
  '/privacy/delete/status',
  async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('DeletionStatus ')) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid deletion status token.' });
      return;
    }
    const token = authHeader.substring('DeletionStatus '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing deletion status token.' });
      return;
    }

    // Cryptographic signature check
    const parts = token.split('_');
    if (parts.length !== 4 || parts[0] !== 'del') {
      res.status(400).json({ error: 'ValidationError', message: 'Malformed deletion status token.' });
      return;
    }

    const [_, jobId, random, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_ACCESS_SECRET)
      .update(`${jobId}_${random}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid token signature.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const clientIp = req.ip || '0.0.0.0';
    const rateLimitKey = `${clientIp}:${tokenHash}`;

    // Check IP rate limit lock
    const rateLimit = failedChecks.get(rateLimitKey);
    if (rateLimit && Date.now() < rateLimit.lockedUntil) {
      res.status(429).json({ error: 'TooManyRequests', message: 'Rate limit exceeded. Locked for 1 hour.' });
      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [job] = await tx
          .select()
          .from(accountDeletionJobs)
          .where(eq(accountDeletionJobs.statusTokenHash, tokenHash))
          .limit(1)
          .for('update');

        if (!job) {
          return { found: false };
        }

        if (job.tokenRevokedAt || new Date() > new Date(job.tokenExpiresAt)) {
          return { found: true, expired: true, job };
        }

        if (job.tokenFailedAttempts >= 5) {
          return { found: true, locked: true, job };
        }

        // Reset fail count on successful validation
        if (job.tokenFailedAttempts > 0) {
          await tx
            .update(accountDeletionJobs)
            .set({ tokenFailedAttempts: 0, updatedAt: new Date() })
            .where(eq(accountDeletionJobs.id, job.id));
        }

        return { found: true, expired: false, locked: false, job };
      });

      if (!result.found) {
        res.status(404).json({ error: 'NotFoundError', message: 'Deletion job not found.' });
        return;
      }

      const { expired, locked, job } = result;

      if (!job) {
        res.status(500).json({ error: 'InternalServerError', message: 'Deletion job details unavailable.' });
        return;
      }

      if (expired) {
        res.status(410).json({ error: 'Gone', message: 'Deletion status token has expired or been revoked.' });
        return;
      }

      if (locked) {
        res.status(429).json({ error: 'TooManyRequests', message: 'Deletion status token locked due to excessive failed attempts.' });
        return;
      }

      res.json({
        success: true,
        status: job.status, // 'pending' or 'processing'
        queuedAt: job.createdAt,
      });
    } catch (error) {
      logError('Error checking deletion status', error);

      const current = failedChecks.get(rateLimitKey) || { count: 0, lockedUntil: 0 };
      current.count++;
      if (current.count >= 5) {
        current.lockedUntil = Date.now() + 60 * 60 * 1000; // 1 hour lock
      }
      failedChecks.set(rateLimitKey, current);

      res.status(500).json({ error: 'InternalServerError', message: 'Failed to query deletion status.' });
    }
  }
);

/**
 * POST /v1/privacy/delete/cancel
 * Cancels a pending account deletion using DeletionStatus token, reverting status to active
 */
router.post(
  '/privacy/delete/cancel',
  async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('DeletionStatus ')) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid deletion status token.' });
      return;
    }
    const token = authHeader.substring('DeletionStatus '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing deletion status token.' });
      return;
    }

    // Cryptographic signature check
    const parts = token.split('_');
    if (parts.length !== 4 || parts[0] !== 'del') {
      res.status(400).json({ error: 'ValidationError', message: 'Malformed deletion status token.' });
      return;
    }

    const [_, jobId, random, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_ACCESS_SECRET)
      .update(`${jobId}_${random}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid token signature.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const clientIp = req.ip || '0.0.0.0';
    const rateLimitKey = `${clientIp}:${tokenHash}`;

    // Check IP rate limit lock
    const rateLimit = failedChecks.get(rateLimitKey);
    if (rateLimit && Date.now() < rateLimit.lockedUntil) {
      res.status(429).json({ error: 'TooManyRequests', message: 'Rate limit exceeded. Locked for 1 hour.' });
      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [job] = await tx
          .select()
          .from(accountDeletionJobs)
          .where(eq(accountDeletionJobs.statusTokenHash, tokenHash))
          .limit(1)
          .for('update');

        if (!job || !job.userId) {
          return { status: 'not_found' };
        }

        if (job.status !== 'pending') {
          return { status: 'already_processing' };
        }

        if (job.tokenRevokedAt || new Date() > new Date(job.tokenExpiresAt)) {
          return { status: 'expired' };
        }

        // Perform cancellation: update user back to active, delete job
        await tx
          .update(users)
          .set({ status: 'active', deletedAt: null, updatedAt: new Date() })
          .where(eq(users.id, job.userId!));

        const userId = job.userId!;

        await tx
          .delete(accountDeletionJobs)
          .where(eq(accountDeletionJobs.id, job.id));

        return { status: 'cancelled', userId };
      });

      if (result.status === 'not_found') {
        res.status(404).json({ error: 'NotFoundError', message: 'Deletion job not found.' });
        return;
      }

      if (result.status === 'already_processing') {
        res.status(400).json({ error: 'ValidationError', message: 'Cannot cancel deletion once processing has started.' });
        return;
      }

      if (result.status === 'expired') {
        res.status(410).json({ error: 'Gone', message: 'Deletion status token has expired.' });
        return;
      }

      await logPrivacyAction({
        actor: 'user',
        actorId: result.userId || '',
        action: 'cancel_account_deletion',
        targetType: 'users',
        targetId: result.userId || '',
        ip: req.ip || null,
        requestId: (req as any).requestId || null,
      });

      res.json({
        success: true,
        message: 'Account deletion cancelled successfully. Your account is active.',
      });
    } catch (error) {
      logError('Error cancelling deletion', error);

      const current = failedChecks.get(rateLimitKey) || { count: 0, lockedUntil: 0 };
      current.count++;
      if (current.count >= 5) {
        current.lockedUntil = Date.now() + 60 * 60 * 1000; // 1 hour lock
      }
      failedChecks.set(rateLimitKey, current);

      res.status(500).json({ error: 'InternalServerError', message: 'Failed to cancel deletion' });
    }
  }
);

export default router;
