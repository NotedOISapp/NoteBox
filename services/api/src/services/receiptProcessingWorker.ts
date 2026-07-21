import crypto from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { db, pool, rlsStorage } from '../db/index.js';
import * as schema from '../db/schema.js';
import {
  ocrTexts,
  privacyPreferences,
  receiptProcessingJobs,
  receipts,
} from '../db/schema.js';
import { getStorage, streamToBuffer } from '../compliance/storage.js';
import { encrypt } from '../utils/crypto.js';
import { logWarn } from '../utils/logger.js';
import { RECEIPT_PROCESSING_MAX_BYTES, RECEIPT_PROCESSING_TIMEOUT_MS } from '../config/env.js';
import {
  getReceiptProcessingProvider,
  isOcrSupportedContentType,
  ReceiptProviderError,
  type ReceiptProviderInput,
} from './receiptProcessingProvider.js';

const MAX_ATTEMPTS = 3;
const LEASE_MS = Math.max(120_000, RECEIPT_PROCESSING_TIMEOUT_MS + 30_000);

type ClaimedJob = typeof receiptProcessingJobs.$inferSelect;

class ReceiptProcessingError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) {
    super(code);
    this.name = 'ReceiptProcessingError';
  }
}

interface ProcessReceiptJobsOptions {
  maxJobs?: number;
  workerId?: string;
  receiptId?: string;
}

async function claimNextJob(workerId: string, receiptId?: string): Promise<ClaimedJob | null> {
  const now = new Date();
  const claimToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
  return db.transaction(async (tx) => {
    const claimable = sql`(
        (${receiptProcessingJobs.status} = 'pending' AND (${receiptProcessingJobs.nextAttemptAt} IS NULL OR ${receiptProcessingJobs.nextAttemptAt} <= ${now}))
        OR (${receiptProcessingJobs.status} = 'processing' AND ${receiptProcessingJobs.leaseExpiresAt} < ${now})
      )`;
    const [job] = await tx.select().from(receiptProcessingJobs)
      .where(receiptId ? and(eq(receiptProcessingJobs.receiptId, receiptId), claimable) : claimable)
      .orderBy(receiptProcessingJobs.createdAt)
      .limit(1)
      .for('update', { skipLocked: true });
    if (!job) return null;
    const [claimed] = await tx.update(receiptProcessingJobs).set({
      status: 'processing',
      claimedBy: workerId,
      claimToken,
      leaseExpiresAt,
      startedAt: job.startedAt ?? now,
      attemptCount: job.attemptCount + 1,
      nextAttemptAt: null,
      updatedAt: now,
    }).where(eq(receiptProcessingJobs.id, job.id)).returning();
    return claimed ?? null;
  });
}

function assertMetadataBinding(job: ClaimedJob, receipt: typeof receipts.$inferSelect, metadata: {
  sizeBytes: number;
  contentType: string;
  sha256: string | null;
  versionId: string | null;
}): void {
  const normalizedMetadataType = metadata.contentType.split(';', 1)[0].trim().toLowerCase();
  const normalizedExpectedType = job.expectedContentType.split(';', 1)[0].trim().toLowerCase();
  if (
    receipt.storageKey !== job.storageKey
    || receipt.userId !== job.userId
    || !receipt.providerObjectVersion
    || receipt.providerObjectVersion !== job.expectedObjectVersion
    || receipt.contentType.split(';', 1)[0].trim().toLowerCase() !== normalizedExpectedType
    || receipt.sizeBytes !== job.expectedSizeBytes
    || metadata.sizeBytes !== Number(job.expectedSizeBytes)
    || normalizedMetadataType !== normalizedExpectedType
    || (job.expectedObjectVersion && metadata.versionId !== job.expectedObjectVersion)
    || (job.expectedSha256 && metadata.sha256 && metadata.sha256 !== job.expectedSha256)
  ) {
    throw new ReceiptProcessingError('RECEIPT_OBJECT_BINDING_MISMATCH', false);
  }
}

async function readBoundObject(job: ClaimedJob): Promise<{
  receipt: typeof receipts.$inferSelect;
  input: ReceiptProviderInput;
}> {
  const [receipt] = await db.select().from(receipts).where(and(
    eq(receipts.id, job.receiptId),
    eq(receipts.userId, job.userId),
  )).limit(1);
  if (!receipt) throw new ReceiptProcessingError('RECEIPT_NOT_FOUND', false);
  if (job.expectedSizeBytes > BigInt(RECEIPT_PROCESSING_MAX_BYTES)) {
    throw new ReceiptProcessingError('RECEIPT_PROCESSING_SIZE_LIMIT', false);
  }
  if (!job.expectedObjectVersion) {
    throw new ReceiptProcessingError('RECEIPT_OBJECT_VERSION_UNAVAILABLE', false);
  }
  const storage = getStorage();
  const metadata = await storage.getObjectMetadata('receipts', job.storageKey, job.expectedObjectVersion);
  assertMetadataBinding(job, receipt, metadata);
  const stream = await storage.openObject('receipts', job.storageKey, job.expectedObjectVersion);
  const bytes = await streamToBuffer(stream);
  if (bytes.length !== Number(job.expectedSizeBytes)) {
    throw new ReceiptProcessingError('RECEIPT_OBJECT_SIZE_MISMATCH', false);
  }
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (job.expectedSha256 && sha256 !== job.expectedSha256) {
    throw new ReceiptProcessingError('RECEIPT_OBJECT_CHECKSUM_MISMATCH', false);
  }
  if (metadata.sha256 && sha256 !== metadata.sha256) {
    throw new ReceiptProcessingError('RECEIPT_STORAGE_CHECKSUM_MISMATCH', false);
  }
  return {
    receipt,
    input: {
      receiptId: receipt.id,
      bytes,
      contentType: job.expectedContentType,
      sizeBytes: bytes.length,
      sha256,
      objectVersion: job.expectedObjectVersion,
    },
  };
}

async function finishUnavailable(job: ClaimedJob, failureCode: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx.update(receiptProcessingJobs).set({
      status: 'unavailable',
      failureCode,
      completedAt: new Date(),
      claimedBy: null,
      claimToken: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(receiptProcessingJobs.id, job.id),
      eq(receiptProcessingJobs.claimToken, job.claimToken!),
      eq(receiptProcessingJobs.status, 'processing'),
    )).returning({ id: receiptProcessingJobs.id });
    if (updated && job.jobType === 'scan') {
      await tx.update(receipts).set({ scanStatus: 'unavailable' }).where(and(
        eq(receipts.id, job.receiptId),
        eq(receipts.userId, job.userId),
        eq(receipts.scanStatus, 'pending'),
      ));
    }
  });
}

async function retryOrFinish(job: ClaimedJob, error: unknown): Promise<void> {
  const known = error instanceof ReceiptProviderError || error instanceof ReceiptProcessingError;
  const code = known ? error.code : 'RECEIPT_PROCESSING_INTERNAL_ERROR';
  const retryable = known ? error.retryable : true;
  if (!retryable || job.attemptCount >= MAX_ATTEMPTS) {
    await finishUnavailable(job, code);
    return;
  }
  const nextAttemptAt = new Date(Date.now() + Math.min(60_000, 1000 * (2 ** job.attemptCount)));
  await db.update(receiptProcessingJobs).set({
    status: 'pending',
    failureCode: code,
    nextAttemptAt,
    claimedBy: null,
    claimToken: null,
    leaseExpiresAt: null,
    updatedAt: new Date(),
  }).where(and(
    eq(receiptProcessingJobs.id, job.id),
    eq(receiptProcessingJobs.claimToken, job.claimToken!),
    eq(receiptProcessingJobs.status, 'processing'),
  ));
  logWarn('Receipt processing retry scheduled', {
    jobId: job.id,
    receiptId: job.receiptId,
    jobType: job.jobType,
    failureCode: code,
    attemptCount: job.attemptCount,
  });
}

async function processClaimedJob(job: ClaimedJob): Promise<void> {
  const provider = getReceiptProcessingProvider();
  if (!provider) {
    await finishUnavailable(job, `${job.jobType.toUpperCase()}_PROVIDER_NOT_CONFIGURED`);
    return;
  }
  try {
    const { receipt, input } = await readBoundObject(job);
    if (job.jobType === 'scan') {
      const result = await provider.scan(input);
      await db.transaction(async (tx) => {
        const [updated] = await tx.update(receiptProcessingJobs).set({
          status: result.status === 'clean' ? 'succeeded' : 'rejected',
          provider: provider.name,
          providerReference: result.providerReference,
          failureCode: result.status === 'rejected' ? result.code : null,
          completedAt: new Date(),
          claimedBy: null,
          claimToken: null,
          leaseExpiresAt: null,
          updatedAt: new Date(),
        }).where(and(
          eq(receiptProcessingJobs.id, job.id),
          eq(receiptProcessingJobs.claimToken, job.claimToken!),
          eq(receiptProcessingJobs.status, 'processing'),
        )).returning({ id: receiptProcessingJobs.id });
        if (!updated) return;
        await tx.update(receipts).set({
          scanStatus: result.status,
          sha256: input.sha256,
        }).where(and(eq(receipts.id, receipt.id), eq(receipts.userId, job.userId)));
      });
      return;
    }

    if (receipt.scanStatus !== 'clean') {
      throw new ReceiptProcessingError('RECEIPT_NOT_CLEAN', false);
    }
    if (!isOcrSupportedContentType(receipt.contentType)) {
      throw new ReceiptProcessingError('OCR_CONTENT_TYPE_UNSUPPORTED', false);
    }
    const [preferences] = await db.select({
      aiProcessingAllowed: privacyPreferences.aiProcessingAllowed,
      thirdPartyAiAllowed: privacyPreferences.thirdPartyAiAllowed,
    })
      .from(privacyPreferences).where(eq(privacyPreferences.userId, job.userId)).limit(1);
    if (!preferences?.aiProcessingAllowed || !preferences.thirdPartyAiAllowed) {
      throw new ReceiptProcessingError('OCR_CONSENT_REVOKED', false);
    }
    const result = await provider.extractText(input);
    const ciphertext = encrypt(result.text);
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(receiptProcessingJobs).set({
        status: 'succeeded',
        provider: provider.name,
        providerReference: result.providerReference,
        failureCode: null,
        completedAt: new Date(),
        claimedBy: null,
        claimToken: null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(receiptProcessingJobs.id, job.id),
        eq(receiptProcessingJobs.claimToken, job.claimToken!),
        eq(receiptProcessingJobs.status, 'processing'),
      )).returning({ id: receiptProcessingJobs.id });
      if (!updated) return;
      await tx.insert(ocrTexts).values({
        receiptId: receipt.id,
        extractedText: ciphertext,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: ocrTexts.receiptId,
        set: { extractedText: ciphertext, updatedAt: new Date() },
      });
    });
  } catch (error) {
    await retryOrFinish(job, error);
  }
}

async function processPendingReceiptJobsInContext(options: ProcessReceiptJobsOptions): Promise<number> {
  const maxJobs = Math.max(1, Math.min(options.maxJobs ?? 20, 100));
  const workerId = options.workerId || process.env.WORKER_ID || `receipt-worker-${crypto.randomUUID()}`;
  let processed = 0;
  while (processed < maxJobs) {
    const job = await claimNextJob(workerId, options.receiptId);
    if (!job) break;
    await processClaimedJob(job);
    processed++;
  }
  return processed;
}

export async function processPendingReceiptJobs(options: ProcessReceiptJobsOptions = {}): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.receipt_worker', 'true', false)");
    const workerDb = drizzle(client, { schema });
    return await rlsStorage.run(workerDb, () => processPendingReceiptJobsInContext(options));
  } finally {
    try {
      await client.query('RESET app.receipt_worker');
    } finally {
      client.release();
    }
  }
}
