import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { db } from './db/index.js';
import {
  users,
  retentionPolicies,
  aiProcessingJobs,
  receipts,
  notes,
  deletionRequests,
  privacyAuditLogs,
  boxes,
  idempotencyRecords,
} from './db/schema.js';
import { eq } from 'drizzle-orm';

// Mock node-cron
const cronCallbacks: Record<string, () => Promise<void>> = {};
vi.mock('node-cron', () => {
  return {
    default: {
      schedule: vi.fn((pattern: string, callback: () => Promise<void>) => {
        cronCallbacks[pattern] = callback;
        return {
          start: vi.fn(),
          stop: vi.fn(),
        };
      }),
    },
  };
});

import { startRetentionCron } from './cron.js';

describe('Retention and Purge Cron Jobs', () => {
  let cronUserA: string;
  let cronUserB: string;
  let cronUserC: string;
  let cronNoteId: string;

  beforeAll(async () => {
    // Start cron scheduler to trigger initial seeding and fill callback registry
    startRetentionCron();

    // Create users to test retention
    const [userA] = await db
      .insert(users)
      .values({
        status: 'active',
      })
      .returning();
    cronUserA = userA.id;

    // Create user B who is deletion_pending for more than 30 days
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    const [userB] = await db
      .insert(users)
      .values({
        status: 'deletion_pending',
        deletedAt: thirtyOneDaysAgo,
      })
      .returning();
    cronUserB = userB.id;

    // Create user C who is active but has no notes (to test inactive account scrub)
    const [userC] = await db
      .insert(users)
      .values({
        status: 'active',
      })
      .returning();
    cronUserC = userC.id;

    // Create Box and Note for AI job reference
    const [box] = await db
      .insert(boxes)
      .values({
        userId: cronUserA,
        name: 'Cron Test Box',
      })
      .returning();

    const [note] = await db
      .insert(notes)
      .values({
        userId: cronUserA,
        boxId: box.id,
        body: 'Cron test note body',
      })
      .returning();
    cronNoteId = note.id;
  });

  it('seeds default retention policies if missing', async () => {
    const policies = await db.select().from(retentionPolicies);
    expect(policies.length).toBeGreaterThan(0);
    // Running startRetentionCron again does not duplicate seeding
    startRetentionCron();
  });

  it('runs daily purge at midnight callback', async () => {
    const dailyCallback = cronCallbacks['0 0 * * *'];
    expect(dailyCallback).toBeDefined();

    // Insert an expired AI processing job
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);
    const [aiJob] = await db
      .insert(aiProcessingJobs)
      .values({
        userId: cronUserA,
        noteId: cronNoteId,
        status: 'completed',
        mode: 'server_side',
        modelProvider: 'openai',
        modelVersion: 'gpt-4o',
        lineageId: '00000000-0000-0000-0000-000000000000',
        purgeAt: expiredDate,
      })
      .returning();

    // Insert an expired receipt (731 days ago)
    const oldReceiptDate = new Date();
    oldReceiptDate.setDate(oldReceiptDate.getDate() - 731);
    const [oldReceipt] = await db
      .insert(receipts)
      .values({
        userId: cronUserA,
        noteId: cronNoteId,
        storageKey: 'receipts/cron-test.jpg',
        contentType: 'image/jpeg',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        sizeBytes: 1024n,
        createdAt: oldReceiptDate,
      })
      .returning();

    const [expiredIdempotencyRecord] = await db.insert(idempotencyRecords).values({
      userId: cronUserA,
      operation: 'POST:/v1/notes/',
      clientMutationId: 'expired-cron-test',
      statusCode: 201,
      responseBodyCiphertext: 'encrypted-test-value',
      expiresAt: expiredDate,
    }).returning();

    // Run the midnight cron callback
    await dailyCallback();

    // Verify expired AI processing job is deleted
    const checkAiJob = await db
      .select()
      .from(aiProcessingJobs)
      .where(eq(aiProcessingJobs.id, aiJob.id));
    expect(checkAiJob.length).toBe(0);

    // Verify expired user (User B) is deleted
    const checkUserB = await db
      .select()
      .from(users)
      .where(eq(users.id, cronUserB));
    expect(checkUserB.length).toBe(0);

    // Verify expired receipt is deleted
    const checkReceipt = await db
      .select()
      .from(receipts)
      .where(eq(receipts.id, oldReceipt.id));
    expect(checkReceipt.length).toBe(0);

    const checkIdempotencyRecord = await db.select().from(idempotencyRecords)
      .where(eq(idempotencyRecords.id, expiredIdempotencyRecord.id));
    expect(checkIdempotencyRecord).toHaveLength(0);
  });

  it('runs inactive account scrub callback', async () => {
    const scrubCallback = cronCallbacks['0 2 * * 0'];
    expect(scrubCallback).toBeDefined();

    // Make cronUserC look inactive (updated 24 months/731 days ago)
    const seventyThreeDaysAgo = new Date();
    seventyThreeDaysAgo.setDate(seventyThreeDaysAgo.getDate() - 731);
    await db
      .update(users)
      .set({
        updatedAt: seventyThreeDaysAgo,
      })
      .where(eq(users.id, cronUserC));

    // Run scrub callback
    await scrubCallback();

    // User C should now be in deletion_pending status
    const [checkUserC] = await db
      .select()
      .from(users)
      .where(eq(users.id, cronUserC));
    expect(checkUserC.status).toBe('deletion_pending');

    // Deletion request should be queued
    const requests = await db
      .select()
      .from(deletionRequests)
      .where(eq(deletionRequests.userId, cronUserC));
    expect(requests.length).toBeGreaterThan(0);

    // Privacy audit log should be written
    const logs = await db
      .select()
      .from(privacyAuditLogs)
      .where(eq(privacyAuditLogs.subjectUserId, cronUserC));
    expect(logs.length).toBeGreaterThan(0);
  });
});
