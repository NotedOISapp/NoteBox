import { beforeAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { storekitTransactions, subscriptions, users } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { generateMockAppleToken } from '../utils/appleTestAuth.js';

const TEST_JWS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-at-least-32-chars';
const PRODUCT_ID = 'com.notebox.pro.monthly';

function signedSubscription(overrides: Record<string, unknown> = {}): string {
  const now = Date.now();
  return jwt.sign({
    transactionId: `subscription-${crypto.randomUUID()}`,
    originalTransactionId: `original-${crypto.randomUUID()}`,
    productId: PRODUCT_ID,
    type: 'Auto-Renewable Subscription',
    bundleId: process.env.APPLE_BUNDLE_ID || 'com.notebox.app',
    environment: process.env.APPLE_STOREKIT_ENVIRONMENT || 'Sandbox',
    purchaseDate: now,
    originalPurchaseDate: now,
    expiresDate: now + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  }, TEST_JWS_SECRET);
}

describe('StoreKit subscription synchronization', () => {
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let userAAppAccountToken: string;
  let userBAppAccountToken: string;
  let claimedOriginalTransactionId: string;
  let claimedSignedTransaction: string;

  beforeAll(async () => {
    const authA = await request(app)
      .post('/v1/auth/apple')
      .send({
        identityToken: generateMockAppleToken({ sub: 'storekit_subscription_user_a' }),
        appleId: 'storekit_subscription_user_a',
        displayName: 'StoreKit Subscription User A',
      });
    tokenA = authA.body.accessToken;
    userAId = authA.body.user.id;
    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ attestAdult: true });

    const authB = await request(app)
      .post('/v1/auth/apple')
      .send({
        identityToken: generateMockAppleToken({ sub: 'storekit_subscription_user_b' }),
        appleId: 'storekit_subscription_user_b',
        displayName: 'StoreKit Subscription User B',
      });
    tokenB = authB.body.accessToken;

    const [userA] = await db.select().from(users).where(eq(users.id, userAId)).limit(1);
    const [userB] = await db.select().from(users).where(eq(users.id, authB.body.user.id)).limit(1);
    userAAppAccountToken = userA.appAccountToken;
    userBAppAccountToken = userB.appAccountToken;
  });

  it('returns the authenticated user stable appAccountToken only in the owner entitlement contract', async () => {
    const first = await request(app)
      .get('/v1/entitlements/me')
      .set('Authorization', `Bearer ${tokenA}`);
    const second = await request(app)
      .get('/v1/entitlements/me')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.body.appAccountToken).toBe(userAAppAccountToken);
    expect(first.body.appAccountToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second.body.appAccountToken).toBe(first.body.appAccountToken);

    const unauthenticated = await request(app).get('/v1/entitlements/me');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).not.toHaveProperty('appAccountToken');
  });

  it('verifies and synchronizes the configured monthly subscription into paid access', async () => {
    const originalTransactionId = `monthly-original-${crypto.randomUUID()}`;
    claimedOriginalTransactionId = originalTransactionId;
    const signedTransaction = signedSubscription({
      transactionId: `monthly-transaction-${crypto.randomUUID()}`,
      originalTransactionId,
      appAccountToken: userAAppAccountToken,
    });
    claimedSignedTransaction = signedTransaction;

    const response = await request(app)
      .post('/v1/storekit/transactions/sync')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ signedTransactions: [signedTransaction] });

    expect(response.status).toBe(200);
    expect(response.body.claimed).toContainEqual(expect.objectContaining({
      productId: PRODUCT_ID,
      grantType: null,
      status: 'created',
    }));
    expect(response.body.entitlement).toMatchObject({
      tier: 'paid',
      source: 'storekit_subscription',
      hasProAccess: true,
    });

    const [subscription] = await db.select().from(subscriptions).where(and(
      eq(subscriptions.userId, userAId),
      eq(subscriptions.originalTxnId, originalTransactionId),
    )).limit(1);
    expect(subscription).toMatchObject({
      platform: 'apple',
      productId: PRODUCT_ID,
      status: 'active',
    });

    const replay = await request(app)
      .post('/v1/storekit/transactions/sync')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ signedTransactions: [signedTransaction] });
    expect(replay.status).toBe(200);
    expect(replay.body.claimed[0].status).toBe('already_claimed');
    const rows = await db.select().from(subscriptions).where(and(
      eq(subscriptions.userId, userAId),
      eq(subscriptions.originalTxnId, originalTransactionId),
    ));
    expect(rows).toHaveLength(1);
  });

  it('does not grant a verified subscription that belongs to another appAccountToken', async () => {
    const transactionId = `ownership-mismatch-${crypto.randomUUID()}`;
    const response = await request(app)
      .post('/v1/storekit/transactions/sync')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ signedTransactions: [signedSubscription({
        transactionId,
        appAccountToken: userBAppAccountToken,
      })] });

    expect(response.status).toBe(200);
    expect(response.body.claimed[0]).toMatchObject({
      productId: PRODUCT_ID,
      status: 'rejected',
      errorCode: 'STOREKIT_TRANSACTION_OWNERSHIP_MISMATCH',
    });
    const rows = await db.select().from(storekitTransactions)
      .where(eq(storekitTransactions.transactionId, transactionId));
    expect(rows).toHaveLength(0);
  });

  it('does not transfer an already-bound subscription lineage when appAccountToken is absent', async () => {
    const response = await request(app)
      .post('/v1/storekit/transactions/sync')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ signedTransactions: [signedSubscription({
        originalTransactionId: claimedOriginalTransactionId,
        appAccountToken: undefined,
      })] });

    expect(response.status).toBe(200);
    expect(response.body.claimed[0]).toMatchObject({
      productId: PRODUCT_ID,
      status: 'rejected',
      errorCode: 'STOREKIT_TRANSACTION_OWNERSHIP_MISMATCH',
    });
    expect(response.body.entitlement.hasProAccess).toBe(false);
  });

  it('continues to reject signed transactions for products outside the server allowlist', async () => {
    const response = await request(app)
      .post('/v1/storekit/transactions/sync')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ signedTransactions: [signedSubscription({
        productId: 'com.notebox.attacker.monthly',
      })] });

    expect(response.status).toBe(200);
    expect(response.body.claimed[0]).toMatchObject({
      status: 'rejected',
      errorCode: 'STOREKIT_PRODUCT_NOT_RECOGNIZED',
    });
  });

  it('revokes paid access when Apple refunds the current subscription period', async () => {
    const signedNotification = jwt.sign({
      notificationUUID: crypto.randomUUID(),
      notificationType: 'REFUND',
      data: {
        environment: process.env.APPLE_STOREKIT_ENVIRONMENT || 'Sandbox',
        signedTransactionInfo: claimedSignedTransaction,
      },
    }, TEST_JWS_SECRET);

    const webhook = await request(app)
      .post('/v1/webhooks/apple/app-store')
      .send({ signedPayload: signedNotification });
    expect(webhook.status).toBe(200);
    expect(webhook.body.status).toBe('processed');

    const entitlement = await request(app)
      .get('/v1/entitlements/me')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(entitlement.status).toBe(200);
    expect(entitlement.body.hasProAccess).toBe(false);

    const [subscription] = await db.select().from(subscriptions).where(and(
      eq(subscriptions.userId, userAId),
      eq(subscriptions.originalTxnId, claimedOriginalTransactionId),
    )).limit(1);
    expect(subscription.status).toBe('refunded');
    expect(subscription.autoRenew).toBe(false);
  });
});
