import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
const files = new Map<string, Uint8Array>();
let byteReads = 0;
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { storage.delete(key); }),
  },
}));

vi.mock('@/services/secure-local-storage', () => ({
  getEncryptedJson: vi.fn(async (key: string) => {
    const value = storage.get(key);
    return value === undefined ? null : JSON.parse(value);
  }),
  setEncryptedJson: vi.fn(async (key: string, value: unknown) => {
    storage.set(key, JSON.stringify(value));
  }),
  removeEncryptedItem: vi.fn(async (key: string) => {
    storage.delete(key);
  }),
  encryptLocalFileBytes: vi.fn(async (_binding: string, value: Uint8Array) => value),
  decryptLocalFileBytes: vi.fn(async (_binding: string, value: Uint8Array) => value),
}));

vi.mock('expo-file-system', () => {
  const join = (parts: Array<string | { uri: string }>) => parts
    .map((part) => typeof part === 'string' ? part : part.uri)
    .join('/')
    .replace(/\/{2,}/g, '/')
    .replace(/^file:\//, 'file:///');
  class Directory {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = join(parts);
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) {
      this.uri = join(parts);
    }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.length ?? 0; }
    async bytes() {
      byteReads += 1;
      return files.get(this.uri) ?? new Uint8Array();
    }
    create() {}
    write(value: Uint8Array) { files.set(this.uri, value); }
    delete() { files.delete(this.uri); }
  }
  return { Directory, File, Paths: { document: 'file:///documents', cache: 'file:///cache' } };
});

import {
  clearMutationQueue,
  drainMutationQueue,
  enqueueMutation,
  MAX_PENDING_RECEIPT_BYTES,
  MutationDrainError,
  PermanentMutationError,
  persistReceiptUploadAsset,
  readDeadLetterQueue,
  readMutationQueue,
  removePersistedReceiptUploadAsset,
  resolveMappedId,
} from '@/services/offline-queue';
import { encryptLocalFileBytes } from '@/services/secure-local-storage';

describe('durable offline mutation queue', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    files.clear();
    byteReads = 0;
    await clearMutationQueue();
  });

  it('persists failed work and retries it in order', async () => {
    await enqueueMutation({ id: 'm1', kind: 'box.create', createdAt: '2026-01-01', payload: { tempId: 'local-box', name: 'Work' } });
    await enqueueMutation({ id: 'm2', kind: 'note.create', createdAt: '2026-01-02', payload: { tempId: 'local-note', boxId: 'local-box', body: 'Text', peopleNames: [] } });
    const seen: string[] = [];

    await expect(drainMutationQueue(async (mutation) => {
      seen.push(mutation.id);
      if (mutation.id === 'm1') throw new Error('offline');
      return undefined;
    })).rejects.toThrow('offline');

    expect(seen).toEqual(['m1']);
    expect((await readMutationQueue()).map((item) => item.id)).toEqual(['m1', 'm2']);
  });

  it('records server ID mappings so dependent mutations reconcile', async () => {
    await enqueueMutation({ id: 'm1', kind: 'box.create', createdAt: '2026-01-01', payload: { tempId: 'local-box', name: 'Work' } });
    await drainMutationQueue(async () => ({ localId: 'local-box', serverId: 'server-box' }));

    expect(await resolveMappedId('local-box')).toBe('server-box');
    expect(await readMutationQueue()).toEqual([]);
  });

  it('dead-letters a permanent failure and continues draining later mutations', async () => {
    await enqueueMutation({ id: 'bad', kind: 'receipt.upload', createdAt: '2026-01-01', payload: {} });
    await enqueueMutation({ id: 'good', kind: 'box.create', createdAt: '2026-01-02', payload: {} });
    const seen: string[] = [];

    const error = await drainMutationQueue(async (mutation) => {
      seen.push(mutation.id);
      if (mutation.id === 'bad') {
        throw new PermanentMutationError('Receipt limit reached.', 'RECEIPT_LIMIT_REACHED');
      }
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(MutationDrainError);
    expect(error.deadLetters).toMatchObject([{
      mutation: { id: 'bad', kind: 'receipt.upload' },
      errorCode: 'RECEIPT_LIMIT_REACHED',
    }]);
    expect(seen).toEqual(['bad', 'good']);
    expect(await readMutationQueue()).toEqual([]);
    expect(await readDeadLetterQueue()).toMatchObject([{
      mutation: { id: 'bad', kind: 'receipt.upload' },
      errorCode: 'RECEIPT_LIMIT_REACHED',
    }]);
  });

  it('runs destructive cleanup only after the queue checkpoint is durable', async () => {
    await enqueueMutation({ id: 'm1', kind: 'box.create', createdAt: '2026-01-01', payload: {} });
    let queueAtCleanup: string[] | undefined;

    await drainMutationQueue(async (_mutation, _persistPayload, afterCommit) => {
      afterCommit(async () => {
        queueAtCleanup = (await readMutationQueue()).map((item) => item.id);
      });
    });

    expect(queueAtCleanup).toEqual([]);
  });

  it('persists Receipt file metadata and keeps authorization progress across retry', async () => {
    files.set('file:///picker/receipt.pdf', new Uint8Array(4096));
    const asset = await persistReceiptUploadAsset({
      uri: 'file:///picker/receipt.pdf',
      contentType: 'application/pdf',
      fileName: 'receipt.pdf',
      attachmentKind: 'receipt',
    }, 'upload-1');
    await enqueueMutation({
      id: 'upload-1',
      kind: 'receipt.upload',
      createdAt: '2026-01-03',
      payload: { noteId: 'local-note', asset },
    });

    await expect(drainMutationQueue(async (_mutation, persistPayload) => {
      await persistPayload({
        authorization: {
          reservationId: 'reservation-1',
          uploadUrl: '/v1/receipts/upload/reservation-1',
          method: 'PUT',
          expiresAt: '2026-01-04T00:00:00.000Z',
        },
      });
      throw new Error('offline after authorization');
    })).rejects.toThrow('offline after authorization');

    const [queued] = await readMutationQueue();
    expect(queued.payload).toMatchObject({
      noteId: 'local-note',
      asset: {
        uri: expect.stringContaining('notebox-pending-receipts/upload-1.nbq'),
        contentType: 'application/pdf',
        fileName: 'receipt.pdf',
        attachmentKind: 'receipt',
        sizeBytes: 4096,
        encryptionBinding: 'receipt-upload:upload-1',
      },
      authorization: { reservationId: 'reservation-1' },
    });
    expect(files.has((queued.payload.asset as { uri: string }).uri)).toBe(true);
  });

  it('rejects an oversized attachment from file metadata before reading or encrypting it', async () => {
    files.set('file:///picker/oversized.pdf', new Uint8Array(MAX_PENDING_RECEIPT_BYTES + 1));

    await expect(persistReceiptUploadAsset({
      uri: 'file:///picker/oversized.pdf',
      contentType: 'application/pdf',
      fileName: 'oversized.pdf',
      attachmentKind: 'receipt',
    }, 'oversized-upload')).rejects.toThrow('10 MB or smaller');

    expect(byteReads).toBe(0);
    expect(encryptLocalFileBytes).not.toHaveBeenCalled();
  });

  it('reconciles a temporary Note ID before a queued Receipt upload and cleans its durable file', async () => {
    files.set('file:///documents/notebox-pending-receipts/upload-2.nbq', new Uint8Array(512));
    await enqueueMutation({
      id: 'note-create',
      kind: 'note.create',
      createdAt: '2026-01-01',
      payload: { tempId: 'local-note' },
    });
    await enqueueMutation({
      id: 'upload-2',
      kind: 'receipt.upload',
      createdAt: '2026-01-02',
      payload: {
        noteId: 'local-note',
        asset: {
          uri: 'file:///documents/notebox-pending-receipts/upload-2.nbq',
          contentType: 'image/jpeg',
          fileName: 'screen.jpg',
          attachmentKind: 'screenshot',
          sizeBytes: 512,
          encryptionBinding: 'receipt-upload:upload-2',
        },
      },
    });

    const uploadedTo: string[] = [];
    await drainMutationQueue(async (mutation, persistPayload) => {
      if (mutation.kind === 'note.create') {
        return { localId: 'local-note', serverId: 'server-note' };
      }
      await persistPayload({ authorization: { reservationId: 'reservation-2' } });
      uploadedTo.push(await resolveMappedId(String(mutation.payload.noteId)));
      await removePersistedReceiptUploadAsset((mutation.payload.asset as { uri: string }).uri);
      return undefined;
    });

    expect(uploadedTo).toEqual(['server-note']);
    expect(files.has('file:///documents/notebox-pending-receipts/upload-2.nbq')).toBe(false);
    expect(await readMutationQueue()).toEqual([]);
  });
});
