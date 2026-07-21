import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { users, accountDeletionJobs, userProfiles, boxes } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { generateMockAppleToken } from '../src/utils/appleTestAuth.js';
import { processDeletionJobs } from '../src/cron.js';
import crypto from 'crypto';
import { encrypt } from '../src/utils/crypto.js';
import { getStorage } from '../src/compliance/storage.js';

describe('Apple Token Revocation and Deletion Purge retry logic (Part 3 & 5)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Success flow: hard purges user, keeps job row with status completed when revocation succeeds', async () => {
    const appleId = 'apple_revoke_success_user';
    const identityToken = generateMockAppleToken({ sub: appleId });
    const authRes = await request(app)
      .post('/v1/auth/apple')
      .send({
        identityToken,
        appleId,
        displayName: 'Revocation Success User',
        authorizationCode: 'valid_auth_code',
      });
    const userId = authRes.body.user.id;
    const token = authRes.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    // Verify tokens were saved on users record
    const [userRecordBefore] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(userRecordBefore.appleRefreshToken).toBeDefined();

    // Verify user profile exists
    const [profileBefore] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    expect(profileBefore).toBeDefined();

    // Request deletion
    const reauthChallengeRes = await request(app)
      .post('/v1/auth/reauthenticate/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'account_deletion' });
    const { challengeId, challenge } = reauthChallengeRes.body;
    const reauthIdentityToken = generateMockAppleToken({ sub: appleId, nonce: challenge });
    await request(app)
      .post('/v1/auth/reauthenticate')
      .set('Authorization', `Bearer ${token}`)
      .send({ challengeId, challenge, identityToken: reauthIdentityToken });

    const delRes = await request(app)
      .post('/v1/account/delete')
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(202);

    const tokenHash = crypto.createHash('sha256').update(delRes.body.statusToken).digest('hex');
    const [jobBefore] = await db.select().from(accountDeletionJobs).where(eq(accountDeletionJobs.statusTokenHash, tokenHash)).limit(1);
    expect(jobBefore.appleRevocationStatus).toBe('pending');
    expect(jobBefore.status).toBe('pending');

    // Run the background worker
    await processDeletionJobs();

    // Verify user record is deleted
    const [userRecordAfter] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(userRecordAfter).toBeUndefined();

    // Verify job row survives (onDelete: 'set null') and status is completed
    const [jobAfter] = await db.select().from(accountDeletionJobs).where(eq(accountDeletionJobs.id, jobBefore.id)).limit(1);
    expect(jobAfter).toBeDefined();
    expect(jobAfter.status).toBe('completed');
    expect(jobAfter.userId).toBeNull(); // Set null since user is gone

    // Verify checking status returns status completed
    const statusRes = await request(app)
      .get('/v1/privacy/delete/status')
      .set('Authorization', `DeletionStatus ${delRes.body.statusToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('completed');
  });

  it('Failure flow: deletes private content but keeps user and puts job into processor_cleanup_pending on Apple revocation failure', async () => {
    const appleId = 'apple_revoke_fail_user';
    const identityToken = generateMockAppleToken({ sub: appleId });
    const authRes = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken, appleId, displayName: 'Revocation Fail User' });
    const userId = authRes.body.user.id;
    const token = authRes.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    // Simulate force_fail_token by updating users record
    await db
      .update(users)
      .set({ appleRefreshToken: encrypt('force_fail_token') })
      .where(eq(users.id, userId));

    // Request deletion
    const reauthChallengeRes = await request(app)
      .post('/v1/auth/reauthenticate/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'account_deletion' });
    const { challengeId, challenge } = reauthChallengeRes.body;
    const reauthIdentityToken = generateMockAppleToken({ sub: appleId, nonce: challenge });
    await request(app)
      .post('/v1/auth/reauthenticate')
      .set('Authorization', `Bearer ${token}`)
      .send({ challengeId, challenge, identityToken: reauthIdentityToken });

    const delRes = await request(app)
      .post('/v1/account/delete')
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(202);

    const [profileBefore] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    expect(profileBefore).toBeDefined();

    // Run background worker
    await processDeletionJobs();

    // 1. Verify user profile private data is deleted
    const [profileAfter] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    expect(profileAfter).toBeUndefined();

    // 2. Verify user record is still present (for retry)
    const [userRecordAfter] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(userRecordAfter).toBeDefined();

    // 3. Verify job status updated to processor_cleanup_pending and appleRevocationStatus updated to failed
    const tokenHash = crypto.createHash('sha256').update(delRes.body.statusToken).digest('hex');
    const [jobAfter] = await db.select().from(accountDeletionJobs).where(eq(accountDeletionJobs.statusTokenHash, tokenHash)).limit(1);
    expect(jobAfter.status).toBe('processor_cleanup_pending');
    expect(jobAfter.appleRevocationStatus).toBe('failed');

    // 4. Retry flow: update token to be valid, run worker again, and verify complete deletion
    await db
      .update(users)
      .set({ appleRefreshToken: encrypt('valid_retry_token') })
      .where(eq(users.id, userId));

    await db
      .update(accountDeletionJobs)
      .set({ appleRevocationStatus: 'pending' }) // Reset to pending for retry
      .where(eq(accountDeletionJobs.id, jobAfter.id));

    // Run background worker again
    await processDeletionJobs();

    // Verify completely deleted now
    const [userRecordFinal] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(userRecordFinal).toBeUndefined();

    const [jobFinal] = await db.select().from(accountDeletionJobs).where(eq(accountDeletionJobs.id, jobAfter.id)).limit(1);
    expect(jobFinal).toBeDefined();
    expect(jobFinal.status).toBe('completed');
  });

  it('Cancellation flow: permits cancellation before physical purge begins via DeletionStatus credential', async () => {
    const appleId = 'apple_cancel_user';
    const identityToken = generateMockAppleToken({ sub: appleId });
    const authRes = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken, appleId, displayName: 'Cancel User' });
    const userId = authRes.body.user.id;
    const token = authRes.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    // Request deletion
    const reauthChallengeRes = await request(app)
      .post('/v1/auth/reauthenticate/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'account_deletion' });
    const { challengeId, challenge } = reauthChallengeRes.body;
    const reauthIdentityToken = generateMockAppleToken({ sub: appleId, nonce: challenge });
    await request(app)
      .post('/v1/auth/reauthenticate')
      .set('Authorization', `Bearer ${token}`)
      .send({ challengeId, challenge, identityToken: reauthIdentityToken });

    const delRes = await request(app)
      .post('/v1/account/delete')
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(202);

    const statusToken = delRes.body.statusToken;

    // Check user is currently deletion_pending
    const [userBefore] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(userBefore.status).toBe('deletion_pending');

    // Cancel deletion using DeletionStatus token
    const cancelRes = await request(app)
      .post('/v1/privacy/delete/cancel')
      .set('Authorization', `DeletionStatus ${statusToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);

    // Verify user is back to active
    const [userAfter] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(userAfter.status).toBe('active');

    // Verify job record is deleted
    const tokenHash = crypto.createHash('sha256').update(statusToken).digest('hex');
    const [jobAfter] = await db.select().from(accountDeletionJobs).where(eq(accountDeletionJobs.statusTokenHash, tokenHash)).limit(1);
    expect(jobAfter).toBeUndefined();
  });

  it('Private-object deletion failure: S3 failure does not delete user record', async () => {
    const appleId = 'apple_s3_fail_user';
    const identityToken = generateMockAppleToken({ sub: appleId });
    const authRes = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken, appleId, displayName: 'S3 Fail User' });
    const userId = authRes.body.user.id;
    const token = authRes.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    // Create a box for the user (to trigger storage deletion path)
    const boxRes = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'S3 Fail Box' });
    expect(boxRes.status).toBe(201);

    // Update the box displayPhotoKey
    await db
      .update(boxes)
      .set({ displayPhotoKey: 's3_fail_display_photo_key' })
      .where(eq(boxes.id, boxRes.body.id));

    // Request deletion
    const reauthChallengeRes = await request(app)
      .post('/v1/auth/reauthenticate/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'account_deletion' });
    const { challengeId, challenge } = reauthChallengeRes.body;
    const reauthIdentityToken = generateMockAppleToken({ sub: appleId, nonce: challenge });
    await request(app)
      .post('/v1/auth/reauthenticate')
      .set('Authorization', `Bearer ${token}`)
      .send({ challengeId, challenge, identityToken: reauthIdentityToken });

    const delRes = await request(app)
      .post('/v1/account/delete')
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(202);

    // Mock storage deleteObject to throw an error
    const storageInstance = getStorage();
    vi.spyOn(storageInstance, 'deleteObject').mockRejectedValue(new Error('S3 Connection Timed Out'));

    // Run background worker - S3 error will propagate and abort purge
    await processDeletionJobs();

    // Verify user record is still present (not deleted!)
    const [userRecordAfter] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(userRecordAfter).toBeDefined();

    // Verify job status updated to failed
    const tokenHash = crypto.createHash('sha256').update(delRes.body.statusToken).digest('hex');
    const [jobAfter] = await db.select().from(accountDeletionJobs).where(eq(accountDeletionJobs.statusTokenHash, tokenHash)).limit(1);
    expect(jobAfter.status).toBe('failed');
  });
});
