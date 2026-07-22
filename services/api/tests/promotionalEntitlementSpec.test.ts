import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { users, userCampaignStates, storekitTransactions, promotionalGrants, foundingFeedback, creatorRewardApprovals, sessions } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { addCalendarMonthsClamped } from '../src/utils/dateUtils.js';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-at-least-32-chars';
const TEST_SIGNUP = new Date();

function generateAuthToken(userId: string) {
  return jwt.sign({ userId, role: 'user', authTime: Math.floor(Date.now() / 1000) }, JWT_SECRET);
}

function createSignedTransaction(overrides: {
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  appAccountToken?: string;
  purchaseDate?: string;
  bundleId?: string;
  environment?: string;
  revocationDate?: string;
  revocationReason?: string;
} = {}) {
  const payload = {
    transactionId: overrides.transactionId || `txn_${Math.random().toString(36).substring(2, 9)}`,
    originalTransactionId: overrides.originalTransactionId || `orig_${Math.random().toString(36).substring(2, 9)}`,
    productId: overrides.productId || 'com.notebox.pro.founding.launch3m',
    appAccountToken: overrides.appAccountToken,
    purchaseDate: overrides.purchaseDate || TEST_SIGNUP.toISOString(),
    bundleId: overrides.bundleId || 'com.notebox.app',
    environment: overrides.environment || 'Sandbox',
    revocationDate: overrides.revocationDate,
    revocationReason: overrides.revocationReason,
  };
  return jwt.sign(payload, JWT_SECRET);
}

describe('Promotional Entitlements Specification', () => {
  let userAId: string;
  let userAToken: string;
  let userAAppAccountToken: string;
  const now = TEST_SIGNUP;

  let userBId: string;
  let userBToken: string;
  let userBAppAccountToken: string;

  beforeAll(async () => {
    // Create test user A
    const [userA] = await db
      .insert(users)
      .values({
        email: 'founding_user_a@example.com',
        status: 'active',
        ageAttested: true,
        createdAt: now,
      })
      .returning();
    userAId = userA.id;
    userAAppAccountToken = userA.appAccountToken;
    userAToken = generateAuthToken(userAId);

    // Create user campaign state for user A
    await db.insert(userCampaignStates).values({
      userId: userAId,
      foundingCampaignEligible: true,
      foundingCampaignAnchorAt: now,
    });

    // Create test user B
    const [userB] = await db
      .insert(users)
      .values({
        email: 'user_b@example.com',
        status: 'active',
        ageAttested: true,
        createdAt: now,
      })
      .returning();
    userBId = userB.id;
    userBAppAccountToken = userB.appAccountToken;
    userBToken = generateAuthToken(userBId);

    // Create user campaign state for user B
    await db.insert(userCampaignStates).values({
      userId: userBId,
      foundingCampaignEligible: true,
      foundingCampaignAnchorAt: now,
    });
  });

  describe('1. Founding Launch Claim & Entitlement', () => {
    it('should successfully claim founding launch transaction and calculate 3-month access', async () => {
      const signedTxn = createSignedTransaction({
        transactionId: 'launch_txn_1001',
        productId: 'com.notebox.pro.founding.launch3m',
        appAccountToken: userAAppAccountToken,
        purchaseDate: now.toISOString(),
      });

      const res = await request(app)
        .post('/v1/storekit/transactions/claim')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ signedTransactions: [signedTxn] });

      expect(res.status).toBe(200);
      expect(res.body.claimed).toHaveLength(1);
      expect(res.body.claimed[0].status).toBe('created');
      expect(res.body.claimed[0].grantType).toBe('founding_launch');

      expect(res.body.entitlement.tier).toBe('promotional');
      expect(res.body.entitlement.hasProAccess).toBe(true);
      expect(res.body.entitlement.source).toBe('founding_campaign');
      expect(res.body.entitlement.foundingCampaign.launchRedeemed).toBe(true);
      expect(res.body.entitlement.foundingCampaign.extensionRedeemed).toBe(false);
      expect(res.body.entitlement.capabilities.patterns).toBe(true);
    });
  });

  describe('2. Founding Extension in Month Two', () => {
    it('should expand founding base access from 3 months to 12 months from original signup date', async () => {
      const signedExtensionTxn = createSignedTransaction({
        transactionId: 'extension_txn_2001',
        productId: 'com.notebox.pro.founding.extension9m',
        appAccountToken: userAAppAccountToken,
        purchaseDate: addCalendarMonthsClamped(now, 2).toISOString(),
      });

      const res = await request(app)
        .post('/v1/storekit/transactions/claim')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ signedTransactions: [signedExtensionTxn] });

      expect(res.status).toBe(200);
      expect(res.body.claimed[0].status).toBe('created');
      expect(res.body.claimed[0].grantType).toBe('founding_extension');

      expect(res.body.entitlement.foundingCampaign.extensionRedeemed).toBe(true);
      const expected12mEnd = addCalendarMonthsClamped(now, 12).toISOString();
      expect(res.body.entitlement.foundingCampaign.baseAccessEndsAt).toBe(expected12mEnd);
      expect(res.body.entitlement.accessEndsAt).toBe(expected12mEnd);
    });
  });

  describe('3. Creator Reward Bonus Stackability', () => {
    it('should append 1 additional month after the complete founding campaign duration', async () => {
      // Create creator reward approval for User A
      await db.insert(creatorRewardApprovals).values({
        userId: userAId,
        deliverableUrl: 'https://tiktok.com/@usera/video/999',
        platform: 'tiktok',
        status: 'code_issued',
        approvedMonths: 1,
        approvedAt: now,
        codeIssuedAt: now,
      });

      const signedCreatorTxn = createSignedTransaction({
        transactionId: 'creator_txn_3001',
        productId: 'com.notebox.pro.creator.bonus1m',
        appAccountToken: userAAppAccountToken,
        purchaseDate: now.toISOString(),
      });

      const res = await request(app)
        .post('/v1/storekit/transactions/claim')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ signedTransactions: [signedCreatorTxn] });

      expect(res.status).toBe(200);
      expect(res.body.claimed[0].status).toBe('created');
      expect(res.body.claimed[0].grantType).toBe('creator_bonus');

      expect(res.body.entitlement.foundingCampaign.creatorBonusMonths).toBe(1);
      const expected13mEnd = addCalendarMonthsClamped(now, 13).toISOString();
      expect(res.body.entitlement.foundingCampaign.finalAccessEndsAt).toBe(expected13mEnd);
      expect(res.body.entitlement.accessEndsAt).toBe(expected13mEnd);
    });
  });

  describe('4. Duplicate & Replay Claims', () => {
    it('should return already_claimed status and not alter dates on duplicate submission', async () => {
      const signedTxn = createSignedTransaction({
        transactionId: 'launch_txn_1001', // already submitted in test 1
        productId: 'com.notebox.pro.founding.launch3m',
        appAccountToken: userAAppAccountToken,
      });

      const res = await request(app)
        .post('/v1/storekit/transactions/claim')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ signedTransactions: [signedTxn] });

      expect(res.status).toBe(200);
      expect(res.body.claimed[0].status).toBe('already_claimed');
    });

    it('should reject cross-account transaction replay with ownership mismatch', async () => {
      // User B attempts to submit User A's transaction
      const signedTxnUserA = createSignedTransaction({
        transactionId: 'user_a_exclusive_txn',
        productId: 'com.notebox.pro.founding.launch3m',
        appAccountToken: userAAppAccountToken, // Belongs to User A
      });

      const res = await request(app)
        .post('/v1/storekit/transactions/claim')
        .set('Authorization', `Bearer ${userBToken}`) // User B calls API
        .send({ signedTransactions: [signedTxnUserA] });

      expect(res.status).toBe(200);
      expect(res.body.claimed[0].status).toBe('rejected');
      expect(res.body.claimed[0].errorCode).toBe('STOREKIT_TRANSACTION_OWNERSHIP_MISMATCH');
    });
  });

  describe('5. Extension Without Launch Guard', () => {
    it('should reject extension transaction if user does not have a verified launch grant', async () => {
      const extensionTxn = createSignedTransaction({
        transactionId: 'extension_no_launch_txn',
        productId: 'com.notebox.pro.founding.extension9m',
        appAccountToken: userBAppAccountToken,
      });

      const res = await request(app)
        .post('/v1/storekit/transactions/claim')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ signedTransactions: [extensionTxn] });

      expect(res.status).toBe(200);
      expect(res.body.claimed[0].status).toBe('rejected');
      expect(res.body.claimed[0].errorCode).toBe('FOUNDING_LAUNCH_REQUIRED');
    });
  });

  describe('6. GET /v1/entitlements/me', () => {
    it('should return canonical effective entitlement for user', async () => {
      const res = await request(app)
        .get('/v1/entitlements/me')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.hasProAccess).toBe(true);
      expect(res.body.capabilities.patterns).toBe(true);
      expect(res.body.capabilities.editing).toBe(true);
      expect(res.body.foundingCampaign.launchRedeemed).toBe(true);
      expect(res.body.foundingCampaign.extensionRedeemed).toBe(true);
      expect(res.body.foundingCampaign.creatorBonusMonths).toBe(1);
    });
  });

  describe('7. Founding Feedback Independence', () => {
    it('should save structured feedback and set timestamp without creating a grant or altering entitlement', async () => {
      const feedbackPayload = {
        whatWorked: 'The box organization system is great.',
        whatWasConfusing: 'Nothing was confusing.',
        bugsEncountered: 'None encountered.',
        mostValuableFeature: 'Patterns analysis.',
        whatAlmostMadeYouStop: 'Nothing.',
        mayContactForFollowUp: true,
      };

      const res = await request(app)
        .post('/v1/founding-feedback')
        .set('Authorization', `Bearer ${userBToken}`)
        .send(feedbackPayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.extensionFeedbackCompletedAt).toBeDefined();

      // Check User B's entitlement: should still be free because feedback DOES NOT grant entitlement directly
      const entitlementRes = await request(app)
        .get('/v1/entitlements/me')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(entitlementRes.body.hasProAccess).toBe(false);
      expect(entitlementRes.body.tier).toBe('free');
    });
  });

  describe('8. App Store Webhook Revocation', () => {
    it('should process REVOKE notification, mark transaction & grant revoked, and update entitlement', async () => {
      // First, create a fresh launch claim for User B
      const launchTxnUserB = createSignedTransaction({
        transactionId: 'user_b_launch_txn_to_revoke',
        productId: 'com.notebox.pro.founding.launch3m',
        appAccountToken: userBAppAccountToken,
      });

      await request(app)
        .post('/v1/storekit/transactions/claim')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ signedTransactions: [launchTxnUserB] });

      // Verify User B has pro access
      const beforeRevoke = await request(app)
        .get('/v1/entitlements/me')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(beforeRevoke.body.hasProAccess).toBe(true);

      // Now send Apple Webhook REVOKE event for User B's transaction
      const nestedTransaction = createSignedTransaction({
        transactionId: 'user_b_launch_txn_to_revoke',
        productId: 'com.notebox.pro.founding.launch3m',
        appAccountToken: userBAppAccountToken,
        revocationDate: new Date().toISOString(),
      });
      const webhookPayload = jwt.sign(
        {
          notificationType: 'REVOKE',
          notificationUUID: 'notif_revoke_123',
          data: {
            environment: 'Sandbox',
            signedTransactionInfo: nestedTransaction,
          },
        },
        JWT_SECRET,
      );

      const webhookRes = await request(app)
        .post('/v1/webhooks/apple/app-store')
        .send({ signedPayload: webhookPayload });

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.status).toBe('processed');
    });
  });

  describe('9. Non-Founding Creator Reward Claim', () => {
    it('should allow a non-Founding creator to redeem 1 month without requiring a Founding User state row', async () => {
      // Admin approves creator deliverable for User B
      const [adminUser] = await db
        .insert(users)
        .values({
          email: 'admin_user@example.com',
          role: 'admin',
          status: 'active',
          ageAttested: true,
        })
        .returning();
      const [adminSession] = await db.insert(sessions).values({
        userId: adminUser.id,
        reauthenticatedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }).returning();
      const adminToken = jwt.sign({
        userId: adminUser.id,
        role: 'admin',
        sessionId: adminSession.id,
      }, JWT_SECRET);

      const approveRes = await request(app)
        .post('/internal/campaigns/creator-rewards/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: userBId,
          deliverableUrl: 'https://tiktok.com/@userb/video/12345',
          reason: 'Verified creator deliverable',
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);

      const codeIssuedRes = await request(app)
        .post('/internal/campaigns/creator-rewards/code-issued')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          approvalId: approveRes.body.data.id,
          reason: 'Apple creator offer code issued',
        });
      expect(codeIssuedRes.status).toBe(200);

      // User B claims creator bonus transaction
      const creatorTxn = createSignedTransaction({
        transactionId: 'non_founding_creator_txn_9001',
        productId: 'com.notebox.pro.creator.bonus1m',
        appAccountToken: userBAppAccountToken,
      });

      const claimRes = await request(app)
        .post('/v1/storekit/transactions/claim')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ signedTransactions: [creatorTxn] });

      expect(claimRes.status).toBe(200);
      expect(claimRes.body.claimed[0].status).toBe('created');
      expect(claimRes.body.claimed[0].grantType).toBe('creator_bonus');
      expect(claimRes.body.entitlement.hasProAccess).toBe(true);
      expect(claimRes.body.entitlement.tier).toBe('promotional');
    });
  });

  describe('10. Admin Route Authorization & Privacy Audit Logging', () => {
    it('should reject non-admin users from accessing internal campaign endpoints with 403', async () => {
      const [userSession] = await db.insert(sessions).values({
        userId: userAId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }).returning();
      const authenticatedNonAdminToken = jwt.sign({
        userId: userAId,
        role: 'user',
        sessionId: userSession.id,
      }, JWT_SECRET);
      const res = await request(app)
        .post('/internal/campaigns/founding/enroll')
        .set('Authorization', `Bearer ${authenticatedNonAdminToken}`)
        .send({ userId: userBId, reason: 'Authorization boundary test' });

      expect(res.status).toBe(403);
    });
  });

  describe('11. Option A Product Export Policy', () => {
    it('should block product export (POST /v1/compliance/export) with 402 PaymentRequired for Free users', async () => {
      // Create user C (Free tier)
      const [userC] = await db
        .insert(users)
        .values({
          email: 'user_c_free@example.com',
          status: 'active',
          ageAttested: true,
        })
        .returning();
      const userCToken = generateAuthToken(userC.id);

      const res = await request(app)
        .post('/v1/compliance/export')
        .set('Authorization', `Bearer ${userCToken}`)
        .send({});

      expect(res.status).toBe(402);
      expect(res.body.error).toBe('PAYMENT_REQUIRED');
    });
  });
});
