import { describe, expect, it, vi } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';
import {
  InMemoryStorageAdapter,
  S3StorageAdapter,
  StorageObjectAlreadyExistsError,
  streamToBuffer,
} from '../compliance/storage.js';
import { assertReceiptObjectsExportable } from './receiptExportIntegrity.js';

describe('Receipt object storage immutability', () => {
  it('rejects reuse of a conditionally authorized Receipt key', async () => {
    const storage = new InMemoryStorageAdapter();
    await storage.putObject({
      namespace: 'receipts',
      key: 'user/note/receipt',
      stream: Buffer.from('original'),
      contentType: 'image/png',
      ifNoneMatch: '*',
    });

    await expect(storage.putObject({
      namespace: 'receipts',
      key: 'user/note/receipt',
      stream: Buffer.from('replacement'),
      contentType: 'image/png',
      ifNoneMatch: '*',
    })).rejects.toBeInstanceOf(StorageObjectAlreadyExistsError);
  });

  it('reads the persisted exact version after the current key changes', async () => {
    const storage = new InMemoryStorageAdapter();
    const original = await storage.putObject({
      namespace: 'receipts',
      key: 'user/note/versioned-receipt',
      stream: Buffer.from('original'),
      contentType: 'image/png',
    });
    const replacement = await storage.putObject({
      namespace: 'receipts',
      key: 'user/note/versioned-receipt',
      stream: Buffer.from('replacement'),
      contentType: 'image/png',
    });

    expect(original.versionId).toBeTruthy();
    expect(replacement.versionId).not.toBe(original.versionId);
    const exact = await storage.openObject('receipts', original.key, original.versionId);
    expect((await streamToBuffer(exact)).toString()).toBe('original');
    expect((await storage.getObjectMetadata('receipts', original.key, original.versionId)).versionId)
      .toBe(original.versionId);
  });

  it('purges every stored version when a whole key is deleted', async () => {
    const storage = new InMemoryStorageAdapter();
    const first = await storage.putObject({
      namespace: 'exports',
      key: 'user/export.zip',
      stream: Buffer.from('first'),
      contentType: 'application/zip',
    });
    await storage.putObject({
      namespace: 'exports',
      key: 'user/export.zip',
      stream: Buffer.from('second'),
      contentType: 'application/zip',
    });

    await storage.deleteObject('exports', 'user/export.zip');

    await expect(storage.openObject('exports', 'user/export.zip', first.versionId))
      .rejects.toThrow('File not found');
  });

  it('purges S3 object versions and delete markers instead of creating another delete marker', async () => {
    const storage = new S3StorageAdapter();
    let listPage = 0;
    const send = vi.fn(async (command: { constructor: { name: string }; input: any }) => {
      if (command.constructor.name === 'ListObjectVersionsCommand') {
        listPage++;
        if (listPage === 1) {
          return {
            IsTruncated: true,
            NextKeyMarker: 'receipts/user/note/receipt',
            NextVersionIdMarker: 'version-1',
            Versions: [
              { Key: 'receipts/user/note/receipt', VersionId: 'version-1' },
              { Key: 'receipts/user/note/receipt-extra', VersionId: 'must-not-delete' },
            ],
          };
        }
        if (listPage === 2) return {
          IsTruncated: false,
          DeleteMarkers: [{ Key: 'receipts/user/note/receipt', VersionId: 'marker-1' }],
        };
        return { IsTruncated: false, Versions: [], DeleteMarkers: [] };
      }
      if (command.constructor.name === 'DeleteObjectsCommand') return {};
      throw new Error(`Unexpected command: ${command.constructor.name}`);
    });
    (storage as any).client = { send };
    (storage as any).bucketName = 'private-versioned-bucket';

    await storage.deleteObject('receipts', 'user/note/receipt');

    expect(send.mock.calls.map(([command]) => command.constructor.name))
      .toEqual([
        'ListObjectVersionsCommand',
        'ListObjectVersionsCommand',
        'DeleteObjectsCommand',
        'ListObjectVersionsCommand',
      ]);
    expect(send.mock.calls[1][0].input).toMatchObject({
      KeyMarker: 'receipts/user/note/receipt',
      VersionIdMarker: 'version-1',
    });
    expect(send.mock.calls[2][0].input.Delete.Objects).toEqual([
      { Key: 'receipts/user/note/receipt', VersionId: 'version-1' },
      { Key: 'receipts/user/note/receipt', VersionId: 'marker-1' },
    ]);
  });

  it('binds the declared byte length and single-write condition into S3 PUT authorization', async () => {
    const storage = new S3StorageAdapter();
    (storage as any).client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
    (storage as any).bucketName = 'private-versioned-bucket';

    const authorization = await storage.createUploadAuthorization({
      namespace: 'receipts',
      key: 'user/note/signed-receipt',
      contentType: 'image/png',
      maxSizeBytes: 4096,
      expiresInSeconds: 900,
    });

    const signedHeaders = new URL(authorization.url).searchParams.get('X-Amz-SignedHeaders')?.split(';');
    expect(signedHeaders).toEqual(expect.arrayContaining(['content-length', 'if-none-match']));
    expect(authorization.headers).toMatchObject({
      'content-length': '4096',
      'if-none-match': '*',
    });
  });

  it('fails export preflight when a legacy Receipt has no immutable object version', async () => {
    const storage = new InMemoryStorageAdapter();

    await expect(assertReceiptObjectsExportable(storage, [{
      id: 'legacy-receipt',
      storageKey: 'user/note/legacy-receipt',
      providerObjectVersion: null,
    }])).rejects.toMatchObject({
      name: 'RECEIPT_OBJECT_VERSION_UNAVAILABLE',
      code: 'RECEIPT_OBJECT_VERSION_UNAVAILABLE',
    });
  });
});
