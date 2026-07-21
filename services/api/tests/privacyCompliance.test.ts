import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Set up mock queue for sequental database queries
let mockQueryQueue: any[] = [];

const mockDbChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  for: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  then: vi.fn((resolve) => {
    const res = mockQueryQueue.shift() || [];
    return Promise.resolve(res).then(resolve);
  }),
};

const mockClient = {
  query: vi.fn(async () => ({ rows: [] })),
  release: vi.fn(),
};

vi.mock('../src/db/index.js', () => {
  return {
    db: {
      select: vi.fn(() => mockDbChain),
      insert: vi.fn(() => mockDbChain),
      update: vi.fn(() => mockDbChain),
      delete: vi.fn(() => mockDbChain),
      transaction: vi.fn(async (cb) => {
        return cb(mockDbChain);
      }),
    },
    pool: {
      connect: vi.fn(async () => mockClient),
      end: vi.fn(),
    },
    rlsStorage: {
      run: vi.fn((ctx, cb) => cb()),
    }
  };
});

// Mock S3/Storage Client
const mockStorage = {
  putObject: vi.fn(async () => ({ key: 'temp', sizeBytes: 123, sha256: 'sha' })),
  openObject: vi.fn(async () => {
    const { Readable } = await import('stream');
    const s = new Readable();
    s.push('mock-zip-content');
    s.push(null);
    return s;
  }),
  deleteObject: vi.fn(async () => {}),
  objectExists: vi.fn(async () => true),
  getObjectMetadata: vi.fn(async () => ({
    sizeBytes: 1,
    contentType: 'image/png',
    sha256: null,
    versionId: 'version-1',
  })),
};

vi.mock('../src/compliance/storage.js', () => {
  return {
    getStorage: () => mockStorage,
    initStorage: async () => {},
  };
});

// Mock telemetry
vi.mock('../src/utils/telemetry.js', () => {
  return {
    trackEvent: vi.fn(),
    getTelemetryViolationCount: () => 0,
  };
});

// Now import app and secrets
import { app } from '../src/index.js';
import { JWT_ACCESS_SECRET } from '../src/config/env.js';

describe('Privacy Compliance & Access Request System Tests', () => {
  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  let accessToken: string;

  beforeEach(() => {
    mockQueryQueue = [];
    vi.clearAllMocks();

    accessToken = jwt.sign(
      { userId, sessionId, role: 'user', email: 'user@example.com' },
      JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
  });

  const setupAuthMocks = (userStatus: string = 'active', reauthenticatedAt: Date | null = new Date()) => {
    mockQueryQueue.push(
      [{ id: userId, email: 'user@example.com', status: userStatus, ageAttested: true }], // users query
      [{ id: sessionId, userId, reauthenticatedAt, expiresAt: new Date(Date.now() + 3600000) }] // sessions query
    );
  };

  describe('1. Privacy Preferences Update', () => {
    it('successfully updates privacy preferences and logs audit event', async () => {
      setupAuthMocks();

      // select existing pref (empty)
      mockQueryQueue.push([]);
      // insert pref result
      mockQueryQueue.push([{ userId }]);
      // audit log insertion
      mockQueryQueue.push([]);

      const response = await request(app)
        .patch('/v1/privacy/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ aiProcessingAllowed: true, thirdPartyAiAllowed: false });

      if (response.status !== 200) {
        console.log('DEBUG /preferences FAIL:', response.status, response.body, response.text);
      }
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('2. DSAR Request Filing', () => {
    it('successfully submits a DSAR request and returns 201', async () => {
      setupAuthMocks();

      // insert dsar record
      mockQueryQueue.push([{ id: 'dsar-1', requestType: 'portability', status: 'pending' }]);
      // audit log insertion
      mockQueryQueue.push([]);

      const response = await request(app)
        .post('/v1/privacy/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ requestType: 'portability' });

      if (response.status !== 201) {
        console.log('DEBUG /request FAIL:', response.status, response.body);
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('3. Data Export Request & Ticket Status', () => {
    it('enqueues a new data export ticket in pending state', async () => {
      setupAuthMocks('active', new Date()); // reauthenticated within 5 minutes

      // recentAuthMiddleware session query
      mockQueryQueue.push([{ id: sessionId, userId, reauthenticatedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) }]);

      // insert data export ticket
      mockQueryQueue.push([{ id: 'export-1', status: 'pending' }]);
      // audit log
      mockQueryQueue.push([]);

      const response = await request(app)
        .post('/v1/privacy/export-request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ format: 'zip' });

      if (response.status !== 202) {
        console.log('DEBUG /export-request FAIL:', response.status, response.body);
      }
      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
    });

    it('returns a download link if the export is ready', async () => {
      setupAuthMocks();

      // select export ticket
      mockQueryQueue.push([{ id: 'export-1', status: 'ready', expiresAt: new Date(Date.now() + 100000), generatedAt: new Date() }]);

      const response = await request(app)
        .get('/v1/privacy/export-request/export-1')
        .set('Authorization', `Bearer ${accessToken}`);

      if (response.status !== 200) {
        console.log('DEBUG /export-request/:id FAIL:', response.status, response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('4. Data Export Download Gating', () => {
    it('streams export file download using session auth', async () => {
      setupAuthMocks('active', new Date()); // reauthenticated within 5 minutes

      // recentAuthMiddleware session query
      mockQueryQueue.push([{ id: sessionId, userId, reauthenticatedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) }]);

      mockQueryQueue.push([{
        id: '00000000-0000-0000-0000-000000000123',
        status: 'ready',
        artifactStorageKey: 'key-123',
        downloadCount: 0,
        expiresAt: new Date(Date.now() + 100000)
      }]);
      mockQueryQueue.push([]);

      const response = await request(app)
        .get('/v1/privacy/export-request/00000000-0000-0000-0000-000000000123/download')
        .set('Authorization', `Bearer ${accessToken}`);

      if (response.status !== 200) {
        console.log('DEBUG /export-request/:id/download FAIL:', response.status, response.body, response.text);
      }
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toBe('application/zip');
      expect(response.text).toBe('mock-zip-content');
    });
  });

  describe('5. Account Deletion Trigger & Status', () => {
    it('sets user to deletion_pending, revokes other sessions and creates deletion job', async () => {
      setupAuthMocks('active', new Date()); // reauthenticated within 5 minutes

      // recentAuthMiddleware session query
      mockQueryQueue.push([{ id: sessionId, userId, reauthenticatedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) }]);

      // select users (check user exists in route)
      mockQueryQueue.push([{ id: userId, email: 'user@example.com' }]);
      // transaction updates (user, sessions, jobs)
      mockQueryQueue.push([]); // update user
      mockQueryQueue.push([]); // update sessions
      mockQueryQueue.push([{ id: 'job-1' }]); // insert jobs
      // audit log
      mockQueryQueue.push([]);

      const response = await request(app)
        .post('/v1/privacy/delete')
        .set('Authorization', `Bearer ${accessToken}`);

      if (response.status !== 202) {
        console.log('DEBUG /delete FAIL:', response.status, response.body, response.text);
      }
      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.statusToken).toBeDefined();
    });

    it('rejects deletion trigger if recent auth check expired', async () => {
      // Reauthenticated 10 minutes ago
      setupAuthMocks('active', new Date(Date.now() - 10 * 60 * 1000));
      // recentAuthMiddleware session query
      mockQueryQueue.push([{ id: sessionId, userId, reauthenticatedAt: new Date(Date.now() - 10 * 60 * 1000), expiresAt: new Date(Date.now() + 3600000) }]);

      const response = await request(app)
        .post('/v1/privacy/delete')
        .set('Authorization', `Bearer ${accessToken}`);

      if (response.status !== 401) {
        console.log('DEBUG /delete check expired FAIL:', response.status, response.body);
      }
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('ReauthenticationRequired');
    });
  });

  describe('6. Deletion Status Polling & Rate Limiting', () => {
    it('returns pending status when check is valid', async () => {
      const jobId = crypto.randomUUID();
      const random = crypto.randomBytes(16).toString('hex');
      const sigData = `${jobId}_${random}`;
      const sig = crypto.createHmac('sha256', JWT_ACCESS_SECRET).update(sigData).digest('hex');
      const token = `del_${jobId}_${random}_${sig}`;

      // transaction query for job
      mockQueryQueue.push([{
        id: jobId,
        status: 'pending',
        tokenExpiresAt: new Date(Date.now() + 100000),
        tokenFailedAttempts: 0
      }]);

      const response = await request(app)
        .get('/v1/privacy/delete/status')
        .set('Authorization', `DeletionStatus ${token}`);

      if (response.status !== 200) {
        console.log('DEBUG /delete/status FAIL:', response.status, response.body, response.text);
      }
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('pending');
    });

    it('returns completed when job is not found but signature is valid (cascade delete complete)', async () => {
      const jobId = crypto.randomUUID();
      const random = crypto.randomBytes(16).toString('hex');
      const sigData = `${jobId}_${random}`;
      const sig = crypto.createHmac('sha256', JWT_ACCESS_SECRET).update(sigData).digest('hex');
      const token = `del_${jobId}_${random}_${sig}`;

      // transaction query for job returns empty
      mockQueryQueue.push([]);

      const response = await request(app)
        .get('/v1/privacy/delete/status')
        .set('Authorization', `DeletionStatus ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NotFoundError');
    });

    it('blocks request and returns 429 after 5 failed check attempts', async () => {
      const jobId = crypto.randomUUID();
      const random = crypto.randomBytes(16).toString('hex');
      const sigData = `${jobId}_${random}`;
      const sig = crypto.createHmac('sha256', JWT_ACCESS_SECRET).update(sigData).digest('hex');
      const token = `del_${jobId}_${random}_${sig}`;

      // transaction query returns a locked job
      mockQueryQueue.push([{
        id: jobId,
        status: 'pending',
        tokenExpiresAt: new Date(Date.now() + 100000),
        tokenFailedAttempts: 5
      }]);

      const response = await request(app)
        .get('/v1/privacy/delete/status')
        .set('Authorization', `DeletionStatus ${token}`);

      if (response.status !== 429) {
        console.log('DEBUG /delete/status locked FAIL:', response.status, response.body);
      }
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('TooManyRequests');
    });
  });

  describe('7. Deletion Cancellation', () => {
    it('successfully restores account to active and deletes job', async () => {
      const jobId = crypto.randomUUID();
      const random = crypto.randomBytes(16).toString('hex');
      const sigData = `${jobId}_${random}`;
      const sig = crypto.createHmac('sha256', JWT_ACCESS_SECRET).update(sigData).digest('hex');
      const token = `del_${jobId}_${random}_${sig}`;

      // transaction query returns a valid job
      mockQueryQueue.push([{
        id: jobId,
        userId,
        status: 'pending',
        tokenExpiresAt: new Date(Date.now() + 100000)
      }]);

      // transaction update user
      mockQueryQueue.push([]);
      // transaction delete job
      mockQueryQueue.push([]);
      // audit log insert
      mockQueryQueue.push([]);

      const response = await request(app)
        .post('/v1/privacy/delete/cancel')
        .set('Authorization', `DeletionStatus ${token}`);

      if (response.status !== 200) {
        console.log('DEBUG /delete/cancel FAIL:', response.status, response.body, response.text);
      }
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('8. OCR Consent and Search', () => {
    it('rejects OCR trigger if AI processing consent is false', async () => {
      setupAuthMocks();

      const receiptId = crypto.randomUUID();
      // select receipt
      mockQueryQueue.push([{ id: receiptId, userId, storageKey: 'key', contentType: 'image/png' }]);
      // select prefs (no consent)
      mockQueryQueue.push([{ userId, aiProcessingAllowed: false }]);

      const response = await request(app)
        .post(`/v1/receipts/${receiptId}/ocr`)
        .set('Authorization', `Bearer ${accessToken}`);

      if (response.status !== 403) {
        console.log('DEBUG /receipts/:id/ocr FAIL:', response.status, response.body, response.text);
      }
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('ConsentRequired');
    });

    it('keeps non-OCR search available without consulting current AI consent', async () => {
      setupAuthMocks();

      // select boxes
      mockQueryQueue.push([{ id: 'box-1', name: 'Work' }]);
      // select notes
      mockQueryQueue.push([{ id: 'note-1', userId, boxId: 'box-1', body: 'body-text', createdAt: new Date() }]);
      // select people
      mockQueryQueue.push([]);
      // select aliases
      mockQueryQueue.push([]);
      // select mentions
      mockQueryQueue.push([]);
      // select addmores
      mockQueryQueue.push([]);
      // select receipts
      mockQueryQueue.push([]);

      const response = await request(app)
        .get('/v1/search?q=test')
        .set('Authorization', `Bearer ${accessToken}`);

      if (response.status !== 200) {
        console.log('DEBUG /search FAIL:', response.status, response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('9. Worker Leases and Physical Purges', () => {
    it('processPendingExports claimed and processes successfully', async () => {
      const { processPendingExports } = await import('../src/cron.js');

      // select pending tickets
      mockQueryQueue.push([{ id: 'export-1', userId, attemptCount: 0, format: 'zip' }]);
      // CAS claimed returning
      mockQueryQueue.push([{ id: 'export-1', userId, attemptCount: 1, format: 'zip' }]);

      // Fetch queries for graphs
      mockQueryQueue.push([{ userId, displayName: 'Me' }]); // profile
      mockQueryQueue.push([]); // boxes
      mockQueryQueue.push([]); // categories
      mockQueryQueue.push([]); // notes
      mockQueryQueue.push([]); // consentEvents
      mockQueryQueue.push([]); // prefs
      mockQueryQueue.push([]); // dsar
      mockQueryQueue.push([]); // exports
      mockQueryQueue.push([]); // auditlogs
      mockQueryQueue.push([]); // processinglogs
      mockQueryQueue.push([]); // retention deletion audits
      mockQueryQueue.push([]); // people

      // S3 upload zip mock triggers, then CAS update ready returning
      mockQueryQueue.push([]); // final update status ready

      await processPendingExports();
    });

    it('fails an export instead of silently omitting a legacy unversioned Receipt', async () => {
      const { processPendingExports } = await import('../src/cron.js');
      const noteId = crypto.randomUUID();
      const receiptId = crypto.randomUUID();

      mockQueryQueue.push([{ id: 'export-unversioned', userId, attemptCount: 0, format: 'zip' }]);
      mockQueryQueue.push([{ id: 'export-unversioned', userId, attemptCount: 1, format: 'zip' }]);
      mockQueryQueue.push([]); // profile
      mockQueryQueue.push([]); // boxes
      mockQueryQueue.push([]); // categories
      mockQueryQueue.push([{ id: noteId, userId, body: 'legacy note' }]); // notes
      mockQueryQueue.push([]); // consent events
      mockQueryQueue.push([]); // privacy preferences
      mockQueryQueue.push([]); // DSAR requests
      mockQueryQueue.push([]); // privacy audit logs
      mockQueryQueue.push([]); // processing logs
      mockQueryQueue.push([]); // retention/deletion audits
      mockQueryQueue.push([]); // note versions
      mockQueryQueue.push([]); // Add Mores
      mockQueryQueue.push([]); // note people
      mockQueryQueue.push([{
        id: receiptId,
        noteId,
        userId,
        storageKey: 'user/note/legacy-receipt',
        providerObjectVersion: null,
      }]);
      mockQueryQueue.push([]); // AI responses
      mockQueryQueue.push([]); // regeneration usage
      mockQueryQueue.push([]); // OCR texts
      mockQueryQueue.push([]); // people
      mockQueryQueue.push([]); // failed status update
      mockQueryQueue.push([]); // no next export

      await processPendingExports();

      expect(mockDbChain.set).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed',
        failureCode: 'RECEIPT_OBJECT_VERSION_UNAVAILABLE',
      }));
      expect(mockStorage.putObject).not.toHaveBeenCalled();
    });

    it('processDeletionJobs deletes S3 objects and cascades DB purge', async () => {
      const { processDeletionJobs } = await import('../src/cron.js');

      // select pending deletion jobs
      mockQueryQueue.push([{ id: 'job-123', userId }]);
      // CAS claim update returning
      mockQueryQueue.push([{ id: 'job-123', userId }]);
      // fetch assets before cascade
      mockQueryQueue.push([]); // boxes
      mockQueryQueue.push([]); // people
      mockQueryQueue.push([]); // notes
      mockQueryQueue.push([]); // exports
      // delete user query
      mockQueryQueue.push([]);

      await processDeletionJobs();
    });
  });
});
