import { Router, Response, raw } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import {
  receipts,
  ocrTexts,
  notes,
  privacyPreferences,
  receiptProcessingJobs,
  users,
  uploadReservations,
} from '../db/schema.js';
import { and, eq, ne, sql } from 'drizzle-orm';
import { decrypt } from '../utils/crypto.js';
import { auditRoute } from '../middleware/audit.js';
import { trackEvent } from '../utils/telemetry.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';
import { getEffectiveEntitlement } from '../services/entitlementResolver.js';
import { getStorage, StorageObjectAlreadyExistsError } from '../compliance/storage.js';
import { logError } from '../utils/logger.js';
import { RECEIPT_PROCESSING_MAX_BYTES } from '../config/env.js';

const router = Router();
const FREE_QUOTA_BYTES = 250n * 1024n * 1024n;
const PRO_QUOTA_BYTES = 5n * 1024n * 1024n * 1024n;
const RESERVATION_SECONDS = 15 * 60;

const idParamSchema = z.object({ id: z.string().uuid() });
const reservationParamSchema = z.object({ reservationId: z.string().uuid() });
const uploadUrlSchema = z.object({
  contentType: z.string().trim().min(1).max(255),
  sizeBytes: z.coerce.number().int().positive(),
  noteId: z.string().uuid(),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
});
const confirmReceiptSchema = z.object({ reservationId: z.string().uuid() });
const listReceiptsQuerySchema = z.object({ noteId: z.string().uuid().optional() });

router.use(authMiddleware);
router.use(eligibilityMiddleware);

function normalizeContentType(value: string): string {
  return value.split(';', 1)[0].trim().toLowerCase();
}

async function ensureReceiptJob(
  tx: any,
  receipt: typeof receipts.$inferSelect,
  jobType: 'scan' | 'ocr',
): Promise<void> {
  await tx.insert(receiptProcessingJobs).values({
    receiptId: receipt.id,
    userId: receipt.userId,
    jobType,
    storageKey: receipt.storageKey,
    expectedObjectVersion: receipt.providerObjectVersion,
    expectedSha256: receipt.sha256 || null,
    expectedContentType: normalizeContentType(receipt.contentType),
    expectedSizeBytes: receipt.sizeBytes,
  }).onConflictDoNothing({
    target: [receiptProcessingJobs.receiptId, receiptProcessingJobs.jobType],
  });
}

router.get('/', validateRequest({ query: listReceiptsQuerySchema }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const noteId = req.query.noteId as string | undefined;
    if (noteId) {
      const [note] = await db.select({ id: notes.id }).from(notes).where(and(
        eq(notes.id, noteId),
        eq(notes.userId, req.user!.userId),
        sql`${notes.deletedAt} IS NULL`,
      )).limit(1);
      if (!note) {
        res.status(404).json({ error: 'NOTE_NOT_FOUND', message: 'Note not found.' });
        return;
      }
    }
    const rows = await db.select().from(receipts).where(and(
      eq(receipts.userId, req.user!.userId),
      ...(noteId ? [eq(receipts.noteId, noteId)] : []),
    ));
    res.json(rows.map((receipt) => ({ ...receipt, sizeBytes: receipt.sizeBytes.toString() })));
  } catch (error) {
    logError('Error fetching receipts', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve Receipts.' });
  }
});

router.post('/upload-url', validateRequest({ body: uploadUrlSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { noteId, contentType, sizeBytes, sha256 } = req.body;
  if (sizeBytes > RECEIPT_PROCESSING_MAX_BYTES) {
    res.status(413).json({
      error: 'RECEIPT_PROCESSING_SIZE_LIMIT',
      maxSizeBytes: RECEIPT_PROCESSING_MAX_BYTES,
    });
    return;
  }
  try {
    let response: Record<string, unknown> | null = null;
    let domainError: { status: number; error: string; message: string } | null = null;

    await db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      if (!user) { domainError = { status: 404, error: 'USER_NOT_FOUND', message: 'User not found.' }; return; }
      const [note] = await tx.select().from(notes).where(and(
        eq(notes.id, noteId), eq(notes.userId, userId), sql`${notes.deletedAt} IS NULL`,
      )).for('update');
      if (!note) { domainError = { status: 404, error: 'NOTE_NOT_FOUND', message: 'Note not found.' }; return; }

      const entitlement = await getEffectiveEntitlement(userId, new Date(), tx);
      const maxPerNote = entitlement.hasProAccess ? 10 : 3;
      const quota = entitlement.hasProAccess ? PRO_QUOTA_BYTES : FREE_QUOTA_BYTES;
      const now = new Date();

      const existing = await tx.select({ sizeBytes: receipts.sizeBytes }).from(receipts)
        .where(eq(receipts.userId, userId));
      const activeReservations = await tx.select().from(uploadReservations).where(and(
        eq(uploadReservations.userId, userId),
        sql`${uploadReservations.consumedAt} IS NULL`,
        sql`${uploadReservations.expiresAt} > ${now}`,
      ));
      const noteReceiptCount = existing.length === 0 ? 0 : (await tx.select({ id: receipts.id }).from(receipts)
        .where(and(eq(receipts.userId, userId), eq(receipts.noteId, noteId)))).length;
      const noteReservationCount = activeReservations.filter((reservation) => reservation.noteId === noteId).length;
      if (noteReceiptCount + noteReservationCount >= maxPerNote) {
        domainError = { status: 402, error: 'RECEIPT_LIMIT_REACHED', message: 'Receipt limit reached for this Note.' };
        return;
      }

      const storedBytes = existing.reduce((sum, row) => sum + row.sizeBytes, 0n);
      const reservedBytes = activeReservations.reduce((sum, row) => sum + row.maxSizeBytes, 0n);
      if (storedBytes + reservedBytes + BigInt(sizeBytes) > quota) {
        domainError = { status: 402, error: 'STORAGE_LIMIT_REACHED', message: 'Receipt storage quota reached.' };
        return;
      }

      const storageKey = `${userId}/${noteId}/${crypto.randomUUID()}`;
      const expiresAt = new Date(Date.now() + RESERVATION_SECONDS * 1000);
      const [reservation] = await tx.insert(uploadReservations).values({
        userId,
        noteId,
        storageKey,
        maxSizeBytes: BigInt(sizeBytes),
        expectedContentType: normalizeContentType(contentType),
        expectedSha256: sha256?.toLowerCase() ?? null,
        expiresAt,
      }).returning();

      const authorization = await getStorage().createUploadAuthorization({
        namespace: 'receipts',
        key: storageKey,
        contentType: normalizeContentType(contentType),
        maxSizeBytes: sizeBytes,
        sha256: sha256?.toLowerCase() ?? null,
        expiresInSeconds: RESERVATION_SECONDS,
      });

      response = {
        reservationId: reservation.id,
        storageKey,
        uploadUrl: authorization.url.startsWith('memory://') || authorization.url.startsWith('local://')
          ? `/v1/receipts/upload/${reservation.id}`
          : authorization.url,
        method: authorization.method,
        headers: authorization.headers,
        expiresAt: authorization.expiresAt.toISOString(),
      };
    });

    const authorizationError = domainError as { status: number; error: string; message?: string } | null;
    if (authorizationError) { res.status(authorizationError.status).json(authorizationError); return; }
    res.status(201).json(response);
  } catch (error) {
    logError('Receipt upload authorization failed', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to authorize Receipt upload.' });
  }
});

// Development/test upload path. Production clients receive a provider-signed URL instead.
router.put('/upload/:reservationId', raw({ type: '*/*', limit: RECEIPT_PROCESSING_MAX_BYTES }), validateRequest({ params: reservationParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [reservation] = await db.select().from(uploadReservations).where(and(
      eq(uploadReservations.id, req.params.reservationId as string),
      eq(uploadReservations.userId, req.user!.userId),
    )).limit(1);
    if (!reservation || reservation.consumedAt || reservation.expiresAt < new Date()) {
      res.status(400).json({ error: 'RESERVATION_INVALID' });
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');
    if (BigInt(body.length) !== reservation.maxSizeBytes) {
      res.status(400).json({ error: 'SIZE_DOES_NOT_MATCH_RESERVATION' });
      return;
    }
    const contentType = normalizeContentType(req.headers['content-type'] || 'application/octet-stream');
    if (contentType !== reservation.expectedContentType) {
      res.status(400).json({ error: 'CONTENT_TYPE_MISMATCH' });
      return;
    }
    const stored = await getStorage().putObject({
      namespace: 'receipts',
      key: reservation.storageKey,
      stream: body,
      contentType,
      ifNoneMatch: '*',
    });
    await db.update(uploadReservations).set({ providerObjectVersion: stored.versionId ?? null })
      .where(eq(uploadReservations.id, reservation.id));
    res.status(201).json({ uploaded: true, sizeBytes: stored.sizeBytes, sha256: stored.sha256 });
  } catch (error) {
    if (error instanceof StorageObjectAlreadyExistsError || (error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      res.status(409).json({ error: 'STORAGE_OBJECT_ALREADY_EXISTS' });
      return;
    }
    logError('Development Receipt upload failed', error);
    res.status(500).json({ error: 'UPLOAD_FAILED' });
  }
});

router.post('/confirm', auditRoute('upload_receipt', 'receipt'), validateRequest({ body: confirmReceiptSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const reservationId = req.body.reservationId as string;
  try {
    let confirmed: any = null;
    let domainError: { status: number; error: string; message?: string } | null = null;

    await db.transaction(async (tx) => {
      await tx.select().from(users).where(eq(users.id, userId)).for('update');
      const [reservation] = await tx.select().from(uploadReservations)
        .where(eq(uploadReservations.id, reservationId)).for('update');
      if (!reservation || reservation.userId !== userId) {
        domainError = { status: 400, error: 'RESERVATION_INVALID' }; return;
      }
      if (reservation.consumedAt) {
        if (reservation.confirmedReceiptId) {
          [confirmed] = await tx.select().from(receipts)
            .where(eq(receipts.id, reservation.confirmedReceiptId)).limit(1);
          if (confirmed?.scanStatus === 'pending') {
            await ensureReceiptJob(tx, confirmed, 'scan');
          }
          return;
        }
        domainError = { status: 409, error: 'RESERVATION_CONSUMED' }; return;
      }
      if (reservation.expiresAt < new Date()) {
        domainError = { status: 400, error: 'RESERVATION_EXPIRED' }; return;
      }

      const [note] = await tx.select().from(notes).where(and(
        eq(notes.id, reservation.noteId),
        eq(notes.userId, userId),
        sql`${notes.deletedAt} IS NULL`,
      )).for('update');
      if (!note) { domainError = { status: 404, error: 'NOTE_NOT_FOUND' }; return; }

      let metadata;
      try {
        metadata = await getStorage().getObjectMetadata(
          'receipts',
          reservation.storageKey,
          reservation.providerObjectVersion,
        );
      } catch {
        domainError = { status: 400, error: 'STORAGE_OBJECT_NOT_FOUND' }; return;
      }
      if (!metadata.versionId) {
        domainError = { status: 503, error: 'STORAGE_OBJECT_VERSION_UNAVAILABLE' }; return;
      }
      if (BigInt(metadata.sizeBytes) !== reservation.maxSizeBytes) {
        domainError = { status: 400, error: 'SIZE_DOES_NOT_MATCH_RESERVATION' }; return;
      }
      if (normalizeContentType(metadata.contentType) !== reservation.expectedContentType) {
        domainError = { status: 400, error: 'CONTENT_TYPE_MISMATCH' }; return;
      }
      if (reservation.expectedSha256 && metadata.sha256 !== reservation.expectedSha256) {
        domainError = { status: 400, error: 'CHECKSUM_MISMATCH' }; return;
      }
      if (reservation.providerObjectVersion && reservation.providerObjectVersion !== metadata.versionId) {
        domainError = { status: 409, error: 'STORAGE_OBJECT_VERSION_MISMATCH' }; return;
      }

      const entitlement = await getEffectiveEntitlement(userId, new Date(), tx);
      const maxPerNote = entitlement.hasProAccess ? 10 : 3;
      const quota = entitlement.hasProAccess ? PRO_QUOTA_BYTES : FREE_QUOTA_BYTES;
      const noteCount = (await tx.select({ id: receipts.id }).from(receipts).where(and(
        eq(receipts.userId, userId), eq(receipts.noteId, note.id),
      ))).length;
      if (noteCount >= maxPerNote) { domainError = { status: 402, error: 'RECEIPT_LIMIT_REACHED' }; return; }

      const storedRows = await tx.select({ sizeBytes: receipts.sizeBytes }).from(receipts)
        .where(eq(receipts.userId, userId));
      const otherReservations = await tx.select({ maxSizeBytes: uploadReservations.maxSizeBytes })
        .from(uploadReservations).where(and(
          eq(uploadReservations.userId, userId),
          ne(uploadReservations.id, reservation.id),
          sql`${uploadReservations.consumedAt} IS NULL`,
          sql`${uploadReservations.expiresAt} > ${new Date()}`,
        ));
      const used = storedRows.reduce((sum, row) => sum + row.sizeBytes, 0n);
      const reserved = otherReservations.reduce((sum, row) => sum + row.maxSizeBytes, 0n);
      if (used + reserved + BigInt(metadata.sizeBytes) > quota) {
        domainError = { status: 402, error: 'STORAGE_LIMIT_REACHED' }; return;
      }

      [confirmed] = await tx.insert(receipts).values({
        noteId: note.id,
        userId,
        storageKey: reservation.storageKey,
        providerObjectVersion: metadata.versionId,
        contentType: metadata.contentType,
        sha256: metadata.sha256 ?? reservation.expectedSha256 ?? '',
        sizeBytes: BigInt(metadata.sizeBytes),
        scanStatus: 'pending',
      }).returning();
      await tx.update(uploadReservations).set({
        consumedAt: new Date(),
        confirmedReceiptId: confirmed.id,
        providerObjectVersion: metadata.versionId,
      }).where(eq(uploadReservations.id, reservation.id));
      await ensureReceiptJob(tx, confirmed, 'scan');
    });

    const confirmationError = domainError as { status: number; error: string; message?: string } | null;
    if (confirmationError) { res.status(confirmationError.status).json(confirmationError); return; }
    await trackEvent(userId, 'receipt_added', { receiptId: confirmed.id, noteId: confirmed.noteId });
    res.status(201).json({
      success: true,
      receipt: { ...confirmed, sizeBytes: confirmed.sizeBytes.toString() },
      ocrProcessed: false,
    });
  } catch (error: any) {
    if (error?.code === '23505' && error?.constraint === 'receipts_storage_key_unique') {
      const [existing] = await db.select().from(receipts).where(eq(receipts.storageKey,
        (await db.select().from(uploadReservations).where(eq(uploadReservations.id, reservationId)).limit(1))[0]?.storageKey ?? '')).limit(1);
      if (existing?.userId === userId) {
        res.status(200).json({ success: true, receipt: { ...existing, sizeBytes: existing.sizeBytes.toString() }, ocrProcessed: false });
        return;
      }
    }
    logError('Receipt confirmation failed', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to confirm Receipt.' });
  }
});

router.delete('/:id', auditRoute('delete_receipt', 'receipt'), validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [receipt] = await db.select().from(receipts).where(and(
      eq(receipts.id, req.params.id as string), eq(receipts.userId, req.user!.userId),
    )).limit(1);
    if (!receipt) { res.status(404).json({ error: 'NotFoundError' }); return; }
    await getStorage().deleteObject('receipts', receipt.storageKey);
    await db.delete(receipts).where(eq(receipts.id, receipt.id));
    res.json({ success: true });
  } catch (error) {
    logError('Receipt deletion failed', error);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

router.get('/:id/ocr', validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const [receipt] = await db.select().from(receipts).where(and(
      eq(receipts.id, req.params.id as string),
      eq(receipts.userId, req.user!.userId),
    )).limit(1);
    if (!receipt) { res.status(404).json({ error: 'NotFoundError' }); return; }

    const [ocr] = await db.select().from(ocrTexts)
      .where(eq(ocrTexts.receiptId, receipt.id))
      .limit(1);
    if (ocr) {
      res.json({
        receiptId: receipt.id,
        status: 'ready',
        text: decrypt(ocr.extractedText),
        extractedAt: ocr.createdAt,
      });
      return;
    }

    if (receipt.scanStatus === 'pending') {
      res.json({
        receiptId: receipt.id,
        status: 'processing',
        stage: 'security_scan',
        retryAfterSeconds: 5,
      });
      return;
    }
    if (receipt.scanStatus === 'rejected') {
      res.json({
        receiptId: receipt.id,
        status: 'blocked',
        reason: 'RECEIPT_REJECTED',
      });
      return;
    }
    if (receipt.scanStatus === 'unavailable') {
      res.json({
        receiptId: receipt.id,
        status: 'unavailable',
        reason: 'SECURITY_SCAN_UNAVAILABLE',
      });
      return;
    }
    const [ocrJob] = await db.select().from(receiptProcessingJobs).where(and(
      eq(receiptProcessingJobs.receiptId, receipt.id),
      eq(receiptProcessingJobs.jobType, 'ocr'),
    )).limit(1);
    if (ocrJob?.status === 'pending' || ocrJob?.status === 'processing') {
      res.json({
        receiptId: receipt.id,
        status: 'processing',
        stage: 'text_extraction',
        retryAfterSeconds: 5,
      });
      return;
    }
    if (ocrJob?.status === 'unavailable') {
      res.json({
        receiptId: receipt.id,
        status: 'unavailable',
        reason: ocrJob.failureCode || 'OCR_UNAVAILABLE',
      });
      return;
    }
    res.json({
      receiptId: receipt.id,
      status: 'unavailable',
      reason: 'OCR_NOT_REQUESTED',
    });
  } catch (error) {
    logError('OCR status request failed', error);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

router.delete('/:id/ocr', auditRoute('delete_ocr_text', 'receipt'), validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  try {
    const [receipt] = await db.select().from(receipts).where(and(
      eq(receipts.id, req.params.id as string),
      eq(receipts.userId, userId),
    )).limit(1);
    if (!receipt) { res.status(404).json({ error: 'NotFoundError' }); return; }

    await db.delete(ocrTexts).where(eq(ocrTexts.receiptId, receipt.id));
    await trackEvent(userId, 'ocr_text_deleted', { receiptId: receipt.id });
    res.json({ success: true, status: 'not_requested' });
  } catch (error) {
    logError('OCR text deletion failed', error);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

router.post('/:id/ocr', auditRoute('extract_ocr_text', 'receipt'), validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  try {
    const [receipt] = await db.select().from(receipts).where(and(
      eq(receipts.id, req.params.id as string), eq(receipts.userId, userId),
    )).limit(1);
    if (!receipt) { res.status(404).json({ error: 'NotFoundError' }); return; }
    const [preferences] = await db.select().from(privacyPreferences)
      .where(eq(privacyPreferences.userId, userId)).limit(1);
    if (!preferences?.aiProcessingAllowed || !preferences.thirdPartyAiAllowed) {
      res.status(403).json({ error: 'ConsentRequired' }); return;
    }
    if (receipt.scanStatus === 'pending') {
      res.status(202).json({
        receiptId: receipt.id,
        status: 'processing',
        stage: 'security_scan',
        retryAfterSeconds: 5,
      });
      return;
    }
    if (receipt.scanStatus === 'rejected') {
      res.status(422).json({
        error: 'RECEIPT_REJECTED',
        status: 'blocked',
        message: 'This Receipt cannot be processed.',
      });
      return;
    }
    if (receipt.scanStatus === 'unavailable') {
      res.status(503).json({
        error: 'SECURITY_SCAN_UNAVAILABLE',
        status: 'unavailable',
        message: 'This Receipt could not be security scanned. No OCR text was created.',
      });
      return;
    }

    const [existing] = await db.select().from(ocrTexts)
      .where(eq(ocrTexts.receiptId, receipt.id))
      .limit(1);
    if (existing) {
      res.json({
        receiptId: receipt.id,
        status: 'ready',
        text: decrypt(existing.extractedText),
        extractedAt: existing.createdAt,
      });
      return;
    }
    await db.transaction(async (tx) => {
      const [existingJob] = await tx.select().from(receiptProcessingJobs).where(and(
        eq(receiptProcessingJobs.receiptId, receipt.id),
        eq(receiptProcessingJobs.jobType, 'ocr'),
      )).limit(1).for('update');
      if (!existingJob) {
        await ensureReceiptJob(tx, receipt, 'ocr');
        return;
      }
      if (existingJob.status === 'unavailable' || existingJob.status === 'succeeded' || existingJob.status === 'rejected') {
        await tx.update(receiptProcessingJobs).set({
          status: 'pending',
          storageKey: receipt.storageKey,
          expectedObjectVersion: receipt.providerObjectVersion,
          expectedSha256: receipt.sha256 || null,
          expectedContentType: normalizeContentType(receipt.contentType),
          expectedSizeBytes: receipt.sizeBytes,
          provider: null,
          providerReference: null,
          failureCode: null,
          attemptCount: 0,
          nextAttemptAt: null,
          claimedBy: null,
          claimToken: null,
          leaseExpiresAt: null,
          startedAt: null,
          completedAt: null,
          updatedAt: new Date(),
        }).where(eq(receiptProcessingJobs.id, existingJob.id));
      }
    });
    await trackEvent(userId, 'ocr_extract_requested', { receiptId: receipt.id });
    res.status(202).json({
      receiptId: receipt.id,
      status: 'processing',
      stage: 'text_extraction',
      retryAfterSeconds: 5,
    });
  } catch (error) {
    logError('OCR request failed', error);
    res.status(500).json({ error: 'InternalServerError' });
  }
});

export default router;
