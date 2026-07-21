import cron from 'node-cron';
import { db } from './db/index.js';
import {
  users,
  aiProcessingJobs,
  aiTrainingExclusions,
  dismissedPatterns,
  notes,
  receipts,
  retentionPolicies,
  deletionRequests,
  privacyAuditLogs,
  dataExports,
  accountDeletionJobs,
  userProfiles,
  categories,
  boxPeople,
  notePeople,
  people,
  ocrTexts,
  aiResponses,
  regenUsage,
  consentEvents,
  privacyPreferences,
  dsarRequests,
  dataProcessingLogs,
  retentionDeletionAudits,
  boxes,
  noteVersions,
  addMores,
  sessions,
  storekitTransactions,
  promotionalGrants,
  userCampaignStates,
  foundingFeedback,
  creatorRewardApprovals,
  reviewOutreachStates,
  uploadReservations,
  idempotencyRecords,
} from './db/schema.js';
import { and, or, eq, lt, gt, sql } from 'drizzle-orm';
import { getStorage } from './compliance/storage.js';
import { ZipArchive, TarArchive } from 'archiver';
import { PassThrough } from 'stream';
import { decrypt } from './utils/crypto.js';
import { logInfo, logWarn, logError } from './utils/logger.js';
import { processPendingReceiptJobs } from './services/receiptProcessingWorker.js';
import { assertReceiptObjectsExportable } from './services/receiptExportIntegrity.js';

/**
 * Seeds default retention policies into the database on startup if they don't exist
 */
async function seedDefaultRetentionPolicies() {
  try {
    const existing = await db.select().from(retentionPolicies).limit(1);
    if (existing.length === 0) {
      logInfo('[Cron] Seeding default compliance retention policies...');
      await db.insert(retentionPolicies).values([
        {
          name: 'User Account Policy',
          dataCategory: 'users',
          retentionDays: 730, // 24 months
          deletionMode: 'soft',
          legalBasis: 'Contractual Necessity'
        },
        {
          name: 'Notes & Content Policy',
          dataCategory: 'notes',
          retentionDays: 730, // 24 months
          deletionMode: 'soft',
          legalBasis: 'Contractual Necessity'
        },
        {
          name: 'AI Processing Cache Policy',
          dataCategory: 'ai_responses',
          retentionDays: 30, // 30 days cache
          deletionMode: 'hard',
          legalBasis: 'Consent'
        },
        {
          name: 'Media & Receipts Policy',
          dataCategory: 'receipts',
          retentionDays: 730, // 24 months
          deletionMode: 'hard',
          legalBasis: 'Contractual Necessity'
        }
      ]);
      logInfo('[Cron] Seeding completed.');
    }
  } catch (error) {
    logError('[Cron] Failed to seed default retention policies', error);
  }
}

/**
 * processPendingExports
 * Background worker to build data export ZIP archives
 */
export async function processPendingExports() {
  const workerId = process.env.WORKER_ID || `worker-${crypto.randomUUID()}`;

  while (true) {
    const claimToken = crypto.randomUUID();
    const leaseExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour lease
    const now = new Date();

    // 1. Atomically claim one job using FOR UPDATE SKIP LOCKED
    const claimedTicket = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(dataExports)
        .where(
          sql`${dataExports.status} = 'pending' OR (${dataExports.status} = 'generating' AND ${dataExports.leaseExpiresAt} < ${now})`
        )
        .limit(1)
        .for('update', { skipLocked: true });

      if (!ticket) {
        return null;
      }

      const [claimed] = await tx
        .update(dataExports)
        .set({
          status: 'generating',
          claimedBy: workerId,
          claimToken,
          leaseExpiresAt,
          startedAt: new Date(),
          updatedAt: new Date(),
          attemptCount: ticket.attemptCount + 1,
        })
        .where(eq(dataExports.id, ticket.id))
        .returning();

      return claimed;
    });

    if (!claimedTicket) {
      // No more pending or expired generating jobs
      break;
    }

    const userId = claimedTicket.userId;
    logInfo('Starting data export generation', { ticketId: claimedTicket.id, userId });

    try {
      // 2. Fetch all user-related data graphs
      const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
      const userBoxes = await db.select().from(boxes).where(eq(boxes.userId, userId));
      const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
      const userNotes = await db.select().from(notes).where(eq(notes.userId, userId));
      const userConsentEvents = await db.select().from(consentEvents).where(eq(consentEvents.userId, userId));
      const userPrefs = await db.select().from(privacyPreferences).where(eq(privacyPreferences.userId, userId)).limit(1);
      const userDsarRequests = await db.select().from(dsarRequests).where(eq(dsarRequests.userId, userId));

      const userLogs = await db.select().from(privacyAuditLogs).where(eq(privacyAuditLogs.actorId, userId));
      const userProcLogs = await db.select().from(dataProcessingLogs).where(eq(dataProcessingLogs.userId, userId));
      const userRetAudits = await db.select().from(retentionDeletionAudits).where(eq(retentionDeletionAudits.userId, userId));

      // Decrypt sensitive content
      const decryptedNotes = userNotes.map(n => ({ ...n, body: decrypt(n.body) }));

      const noteIds = userNotes.map(n => n.id);
      let userNoteVersions: any[] = [];
      let userAddMores: any[] = [];
      let userNotePeople: any[] = [];
      let userReceipts: any[] = [];
      let userOcrTexts: any[] = [];
      let userAiResponses: any[] = [];
      let userRegenUsage: any[] = [];

      if (noteIds.length > 0) {
        userNoteVersions = await db.select().from(noteVersions).where(sql`${noteVersions.noteId} IN ${noteIds}`);
        userAddMores = await db.select().from(addMores).where(sql`${addMores.noteId} IN ${noteIds}`);
        userNotePeople = await db.select().from(notePeople).where(sql`${notePeople.noteId} IN ${noteIds}`);
        userReceipts = await db.select().from(receipts).where(sql`${receipts.noteId} IN ${noteIds}`);
        userAiResponses = await db.select().from(aiResponses).where(sql`${aiResponses.noteId} IN ${noteIds}`);
        userRegenUsage = await db.select().from(regenUsage).where(sql`${regenUsage.noteId} IN ${noteIds}`);

        const decryptedNoteVersions = userNoteVersions.map(v => ({ ...v, body: decrypt(v.body) }));
        userNoteVersions = decryptedNoteVersions;

        const decryptedAddMores = userAddMores.map(a => ({ ...a, body: decrypt(a.body) }));
        userAddMores = decryptedAddMores;

        const decryptedAiResponses = userAiResponses.map(r => ({ ...r, responseText: decrypt(r.responseText) }));
        userAiResponses = decryptedAiResponses;

        const receiptIds = userReceipts.map(r => r.id);
        if (receiptIds.length > 0) {
          userOcrTexts = await db.select().from(ocrTexts).where(sql`${ocrTexts.receiptId} IN ${receiptIds}`);
          const decryptedOcrTexts = userOcrTexts.map(o => ({ ...o, extractedText: decrypt(o.extractedText) }));
          userOcrTexts = decryptedOcrTexts;
        }
      }

      const userPeople = await db.select().from(people).where(eq(people.userId, userId));
      const peopleIds = userPeople.map(p => p.id);
      let userBoxPeople: any[] = [];
      if (peopleIds.length > 0) {
        userBoxPeople = await db.select().from(boxPeople).where(sql`${boxPeople.personId} IN ${peopleIds}`);
      }

      // 3. Set up output streaming directly to Private Storage Adapter
      const storage = getStorage();
      await assertReceiptObjectsExportable(storage, userReceipts);
      const passThrough = new PassThrough();
      const archive = new ZipArchive({ zlib: { level: 9 } });
      archive.pipe(passThrough);

      const zipKey = `exports/${userId}/${claimedTicket.id}/${claimToken}.zip`;

      const uploadPromise = storage.putObject({
        namespace: 'exports',
        key: zipKey,
        stream: passThrough,
        contentType: 'application/zip',
      });

      // Prepare Manifest & JSONs
      const manifest = {
        userId,
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        files: [
          'manifest.json',
          'profile.json',
          'data/boxes.json',
          'data/categories.json',
          'data/notes.json',
          'data/note_versions.json',
          'data/add_mores.json',
          'data/people.json',
          'data/box_people.json',
          'data/note_people.json',
          'data/ai_responses.json',
          'data/regen_usage.json',
          'data/consent_events.json',
          'data/privacy_preferences.json',
          'data/dsar_requests.json',
          'data/receipts.json',
          'data/ocr_texts.json',
          'data/privacy_audit_logs.json',
          'data/data_processing_logs.json',
          'data/retention_deletion_audits.json'
        ]
      };

      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
      archive.append(JSON.stringify(profile[0] || {}, null, 2), { name: 'profile.json' });
      archive.append(JSON.stringify(userBoxes, null, 2), { name: 'data/boxes.json' });
      archive.append(JSON.stringify(userCategories, null, 2), { name: 'data/categories.json' });
      archive.append(JSON.stringify(decryptedNotes, null, 2), { name: 'data/notes.json' });
      archive.append(JSON.stringify(userNoteVersions, null, 2), { name: 'data/note_versions.json' });
      archive.append(JSON.stringify(userAddMores, null, 2), { name: 'data/add_mores.json' });
      archive.append(JSON.stringify(userPeople, null, 2), { name: 'data/people.json' });
      archive.append(JSON.stringify(userBoxPeople, null, 2), { name: 'data/box_people.json' });
      archive.append(JSON.stringify(userNotePeople, null, 2), { name: 'data/note_people.json' });
      archive.append(JSON.stringify(userAiResponses, null, 2), { name: 'data/ai_responses.json' });
      archive.append(JSON.stringify(userRegenUsage, null, 2), { name: 'data/regen_usage.json' });
      archive.append(JSON.stringify(userConsentEvents, null, 2), { name: 'data/consent_events.json' });
      archive.append(JSON.stringify(userPrefs[0] || {}, null, 2), { name: 'data/privacy_preferences.json' });
      archive.append(JSON.stringify(userDsarRequests, null, 2), { name: 'data/dsar_requests.json' });
      archive.append(JSON.stringify(userReceipts, null, 2), { name: 'data/receipts.json' });
      archive.append(JSON.stringify(userOcrTexts, null, 2), { name: 'data/ocr_texts.json' });
      archive.append(JSON.stringify(userLogs, null, 2), { name: 'data/privacy_audit_logs.json' });
      archive.append(JSON.stringify(userProcLogs, null, 2), { name: 'data/data_processing_logs.json' });
      archive.append(JSON.stringify(userRetAudits, null, 2), { name: 'data/retention_deletion_audits.json' });

      // Append Binary Assets (Receipt files, Box photos, avatar photos)
      for (const box of userBoxes) {
        if (box.displayPhotoKey) {
          try {
            if (await storage.objectExists('boxes', box.displayPhotoKey)) {
              const stream = await storage.openObject('boxes', box.displayPhotoKey);
              archive.append(stream as any, { name: `media/boxes/${box.displayPhotoKey}` });
            }
          } catch (err) {
            logWarn('Box display photo missing during export packaging', { boxId: box.id, key: box.displayPhotoKey });
          }
        }
      }

      for (const person of userPeople) {
        if (person.avatarKey) {
          try {
            if (await storage.objectExists('people', person.avatarKey)) {
              const stream = await storage.openObject('people', person.avatarKey);
              archive.append(stream as any, { name: `media/people/${person.avatarKey}` });
            }
          } catch (err) {
            logWarn('Person avatar missing during export packaging', { personId: person.id, key: person.avatarKey });
          }
        }
      }

      for (const receipt of userReceipts) {
        if (receipt.storageKey) {
          const stream = await storage.openObject('receipts', receipt.storageKey, receipt.providerObjectVersion);
          archive.append(stream as any, { name: `media/receipts/${receipt.storageKey}` });
        }
      }

      // Finalize ZIP
      await archive.finalize();

      // Wait for S3/local file write to finish
      const storedZip = await uploadPromise;

      // 4. Update status to ready: verify claimToken and lease parameters
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

      const [updated] = await db
        .update(dataExports)
        .set({
          status: 'ready',
          artifactStorageKey: storedZip.key,
          artifactSizeBytes: BigInt(storedZip.sizeBytes),
          artifactSha256: storedZip.sha256,
          generatedAt: new Date(),
          expiresAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(dataExports.id, claimedTicket.id),
            eq(dataExports.claimToken, claimToken),
            sql`${dataExports.leaseExpiresAt} >= ${new Date()}`
          )
        )
        .returning();

      if (!updated) {
        throw new Error('Lease expired or claimed by another worker during generation.');
      }

      logInfo('Data export completed successfully', { ticketId: claimedTicket.id, size: storedZip.sizeBytes });
    } catch (error) {
      logError('Data export generation failed', error);
      await db
        .update(dataExports)
        .set({
          status: 'failed',
          failureCode: error instanceof Error ? error.name || 'EXPORT_COMPILATION_ERROR' : 'UNKNOWN_ERROR',
          failedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(dataExports.id, claimedTicket.id),
            eq(dataExports.claimToken, claimToken)
          )
        );
    }
  }
}

/**
 * processDeletionJobs
 * Background worker to physically hard purge users scheduled for deletion
 */
export async function processDeletionJobs() {
  const pendingJobs = await db
    .select()
    .from(accountDeletionJobs)
    .where(
      or(
        eq(accountDeletionJobs.status, 'pending'),
        eq(accountDeletionJobs.status, 'processor_cleanup_pending')
      )
    );

  for (const job of pendingJobs) {
    try {
      // 1. CAS claim
      const [claimed] = await db
        .update(accountDeletionJobs)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(
          and(
            eq(accountDeletionJobs.id, job.id),
            or(
              eq(accountDeletionJobs.status, 'pending'),
              eq(accountDeletionJobs.status, 'processor_cleanup_pending')
            )
          )
        )
        .returning();

      if (!claimed) continue; // claimed by another worker

      const userId = job.userId;
      if (!userId) continue;
      logInfo('Starting physical account purge', { userId });

      // 2. Fetch and delete all media files in object storage first
      const userBoxes = await db.select().from(boxes).where(eq(boxes.userId, userId));
      const userPeople = await db.select().from(people).where(eq(people.userId, userId));
      const userNotes = await db.select().from(notes).where(eq(notes.userId, userId));
      const userExports = await db.select().from(dataExports).where(eq(dataExports.userId, userId));
      const userUploadReservations = await db.select().from(uploadReservations).where(eq(uploadReservations.userId, userId));

      let userReceipts: any[] = [];
      if (userNotes.length > 0) {
        const noteIds = userNotes.map(n => n.id);
        userReceipts = await db.select().from(receipts).where(sql`${receipts.noteId} IN ${noteIds}`);
      }

      const storage = getStorage();

      // Delete receipt files
      for (const r of userReceipts) {
        if (r.storageKey) {
          await storage.deleteObject('receipts', r.storageKey);
        }
      }

      // Delete box photos
      for (const b of userBoxes) {
        if (b.displayPhotoKey) {
          await storage.deleteObject('boxes', b.displayPhotoKey);
        }
      }

      // Delete avatar photos
      for (const p of userPeople) {
        if (p.avatarKey) {
          await storage.deleteObject('people', p.avatarKey);
        }
      }

      // Delete generated export ZIPs
      for (const e of userExports) {
        if (e.artifactStorageKey) {
          await storage.deleteObject('exports', e.artifactStorageKey);
        }
      }

      // Delete abandoned Receipt uploads reserved by this user.
      for (const reservation of userUploadReservations) {
        if (!reservation.consumedAt && reservation.storageKey) {
          await storage.deleteObject('receipts', reservation.storageKey);
        }
      }

      // 3. Database physical cascade purge of private data (leaving the user record if Apple revocation is still pending)
      await db.transaction(async (tx) => {
        // Explicitly anonymize StoreKit transactions for anti-replay retention (clear both userId and appAccountToken)
        await tx
          .update(storekitTransactions)
          .set({
            userId: null,
            appAccountToken: null,
            updatedAt: new Date(),
          })
          .where(eq(storekitTransactions.userId, userId));

        // Hard delete promotional and feedback records
        await tx.delete(promotionalGrants).where(eq(promotionalGrants.userId, userId));
        await tx.delete(userCampaignStates).where(eq(userCampaignStates.userId, userId));
        await tx.delete(foundingFeedback).where(eq(foundingFeedback.userId, userId));
        await tx.delete(creatorRewardApprovals).where(eq(creatorRewardApprovals.userId, userId));
        await tx.delete(reviewOutreachStates).where(eq(reviewOutreachStates.userId, userId));
        await tx.delete(uploadReservations).where(eq(uploadReservations.userId, userId));

        // Delete OCR texts first due to foreign keys
        await tx.delete(ocrTexts).where(
          sql`${ocrTexts.receiptId} IN (
            SELECT id FROM ${receipts} WHERE ${receipts.noteId} IN (
              SELECT id FROM ${notes} WHERE ${notes.userId} = ${userId}
            )
          )`
        );

        // Delete AI responses and processing/training exclusions
        await tx.delete(aiResponses).where(
          sql`${aiResponses.noteId} IN (SELECT id FROM ${notes} WHERE ${notes.userId} = ${userId})`
        );
        await tx.delete(aiTrainingExclusions).where(eq(aiTrainingExclusions.userId, userId));
        await tx.delete(aiProcessingJobs).where(eq(aiProcessingJobs.userId, userId));
        await tx.delete(dismissedPatterns).where(eq(dismissedPatterns.userId, userId));

        // Delete core private data tables
        await tx.delete(userProfiles).where(eq(userProfiles.userId, userId));
        await tx.delete(boxes).where(eq(boxes.userId, userId));
        await tx.delete(people).where(eq(people.userId, userId));
        await tx.delete(categories).where(eq(categories.userId, userId));
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        await tx.delete(dataExports).where(eq(dataExports.userId, userId));
      });

      // 4. Perform Apple token revocation if required
      let revocationSuccess = true;
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (user && user.appleId && job.appleRevocationStatus === 'pending') {
        try {
          const encryptedToken = user.appleRefreshToken || user.appleAccessToken;
          if (encryptedToken) {
            const { revokeAppleToken } = await import('./utils/appleRevoke.js');
            await revokeAppleToken(decrypt(encryptedToken));
          }

          await db
            .update(accountDeletionJobs)
            .set({ appleRevocationStatus: 'success', updatedAt: new Date() })
            .where(eq(accountDeletionJobs.id, job.id));
        } catch (err) {
          logWarn('Failed to revoke Apple token during physical purge', err);
          revocationSuccess = false;
          await db
            .update(accountDeletionJobs)
            .set({ appleRevocationStatus: 'failed', updatedAt: new Date() })
            .where(eq(accountDeletionJobs.id, job.id));
        }
      }

      // 5. Complete deletion or reschedule
      if (revocationSuccess) {
        await db.transaction(async (tx) => {
          await tx
            .update(accountDeletionJobs)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(eq(accountDeletionJobs.id, job.id));
          await tx.delete(users).where(eq(users.id, userId));
        });
        logInfo('Physical account purge completed successfully', { userId });
      } else {
        await db
          .update(accountDeletionJobs)
          .set({ status: 'processor_cleanup_pending', updatedAt: new Date() })
          .where(eq(accountDeletionJobs.id, job.id));
        logInfo('Physical account purge partially completed. Apple revocation pending retry.', { userId });
      }
    } catch (error) {
      logError('Failed to process account deletion job', error);
      await db
        .update(accountDeletionJobs)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(accountDeletionJobs.id, job.id));
    }
  }
}

/**
 * Runs daily at midnight to execute privacy-compliance retention actions
 */
export function startRetentionCron() {
  logInfo('Retention scheduler initialized.');

  // Run initial policy seeding
  seedDefaultRetentionPolicies();

  // Run durable background workers every minute.
  cron.schedule('*/1 * * * *', async () => {
    try {
      await processPendingReceiptJobs();
      await processPendingExports();
      await processDeletionJobs();
    } catch (error) {
      logError('Error running scheduled background workers', error);
    }
  });

  // 1. Daily Purge (Midnight 00:00)
  // Purge expired AI processing jobs, cascade soft deleted accounts, and delete expired receipts
  cron.schedule('0 0 * * *', async () => {
    logInfo('[Cron] Starting daily retention and deletion purge...');
    const now = new Date();

    try {
      // A. Purge expired AI processing jobs
      await db.delete(aiProcessingJobs).where(lt(aiProcessingJobs.purgeAt, now));
      logInfo('[Cron] Purged expired AI processing jobs.');

      const expiredIdempotencyRecords = await db
        .delete(idempotencyRecords)
        .where(lt(idempotencyRecords.expiresAt, new Date()))
        .returning({ id: idempotencyRecords.id });
      if (expiredIdempotencyRecords.length > 0) {
        logInfo(`[Cron] Purged ${expiredIdempotencyRecords.length} expired idempotency records.`);
      }

      // B. Permanently delete (cascade) users pending deletion for more than 30 days
      const userPurgeThreshold = new Date();
      userPurgeThreshold.setDate(userPurgeThreshold.getDate() - 30);

      const usersToDelete = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.status, 'deletion_pending'),
            lt(users.deletedAt, userPurgeThreshold)
          )
        );

      if (usersToDelete.length > 0) {
        logInfo(`[Cron] Permanent deletion candidate count: ${usersToDelete.length}`);
        const storage = getStorage();

        for (const targetUser of usersToDelete) {
          // Fetch and delete their S3 assets before cascade deleting DB record
          const targetBoxes = await db.select().from(boxes).where(eq(boxes.userId, targetUser.id));
          const targetPeople = await db.select().from(people).where(eq(people.userId, targetUser.id));
          const targetNotes = await db.select().from(notes).where(eq(notes.userId, targetUser.id));
          const targetExports = await db.select().from(dataExports).where(eq(dataExports.userId, targetUser.id));

          let targetReceipts: any[] = [];
          if (targetNotes.length > 0) {
            const noteIds = targetNotes.map(n => n.id);
            targetReceipts = await db.select().from(receipts).where(sql`${receipts.noteId} IN ${noteIds}`);
          }

          for (const r of targetReceipts) {
            if (r.storageKey) {
              try { await storage.deleteObject('receipts', r.storageKey); } catch (e) {}
            }
          }
          for (const b of targetBoxes) {
            if (b.displayPhotoKey) {
              try { await storage.deleteObject('boxes', b.displayPhotoKey); } catch (e) {}
            }
          }
          for (const p of targetPeople) {
            if (p.avatarKey) {
              try { await storage.deleteObject('people', p.avatarKey); } catch (e) {}
            }
          }
          for (const e of targetExports) {
            if (e.artifactStorageKey) {
              try { await storage.deleteObject('exports', e.artifactStorageKey); } catch (e) {}
            }
          }

          await db.delete(users).where(eq(users.id, targetUser.id));
        }
        logInfo(`[Cron] Hard deleted ${usersToDelete.length} user accounts (cascaded).`);
      }

      // C. Purge media / receipts past retention policy (24 months)
      const mediaThreshold = new Date();
      mediaThreshold.setDate(mediaThreshold.getDate() - 730); // 24 months

      const expiredReceipts = await db
        .select()
        .from(receipts)
        .where(lt(receipts.createdAt, mediaThreshold));

      if (expiredReceipts.length > 0) {
        logInfo(`[Cron] Found ${expiredReceipts.length} receipts past retention window.`);
        const storage = getStorage();
        for (const item of expiredReceipts) {
          // Physically delete the S3 asset file first
          if (item.storageKey) {
            try {
              await storage.deleteObject('receipts', item.storageKey);
            } catch (err) {
              logWarn('Failed to delete expired receipt file from storage during retention purge', { receiptId: item.id, key: item.storageKey });
            }
          }
          await db.delete(receipts).where(eq(receipts.id, item.id));
        }
        logInfo(`[Cron] Purged ${expiredReceipts.length} expired receipts.`);
      }

    } catch (error) {
      logError('[Cron] Error running daily retention jobs', error);
    }
  });

  // 2. Weekly Inactive Account Scrub (Sundays at 02:00)
  // Soft deletes active user accounts that have been inactive for more than 24 months (730 days)
  cron.schedule('0 2 * * 0', async () => {
    logInfo('[Cron] Starting weekly inactive account scrub...');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 730); // 24 months

    try {
      const activeUsers = await db
        .select({ id: users.id, updatedAt: users.updatedAt })
        .from(users)
        .where(eq(users.status, 'active'));

      let scrubbedCount = 0;

      for (const user of activeUsers) {
        if (user.updatedAt < cutoffDate) {
          const recentNotes = await db
            .select({ id: notes.id })
            .from(notes)
            .where(
              and(
                eq(notes.userId, user.id),
                gt(notes.createdAt, cutoffDate)
              )
            )
            .limit(1);

          if (recentNotes.length === 0) {
            await db
              .update(users)
              .set({
                status: 'deletion_pending',
                deletedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(users.id, user.id));

            await db.insert(deletionRequests).values({
              userId: user.id,
              scope: { inactiveScrub: true },
              mode: 'soft',
              status: 'pending'
            });

            await db.insert(privacyAuditLogs).values({
              actorId: user.id,
              actorType: 'system',
              targetType: 'user',
              targetId: user.id,
              action: 'scrub_inactive_account',
              subjectUserId: user.id,
              timestamp: new Date()
            });

            scrubbedCount++;
          }
        }
      }

      if (scrubbedCount > 0) {
        logInfo(`[Cron] Soft-deleted ${scrubbedCount} inactive user accounts.`);
      } else {
        logInfo('[Cron] No inactive accounts found.');
      }
    } catch (error) {
      logError('[Cron] Error running weekly inactive account scrub', error);
    }
  });
}
