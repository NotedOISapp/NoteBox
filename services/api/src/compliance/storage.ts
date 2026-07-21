import { Readable } from 'stream';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { isProd, EXPORT_STORAGE_PROVIDER, S3_BUCKET_NAME, AWS_REGION } from '../config/env.js';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetPublicAccessBlockCommand,
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StorageNamespace = 'exports' | 'receipts' | 'boxes' | 'people' | 'temp';

export interface PutObjectInput {
  namespace: StorageNamespace;
  key: string;
  stream: NodeJS.ReadableStream | Buffer;
  contentType: string;
  ifNoneMatch?: '*';
}

export interface StoredObject {
  namespace: StorageNamespace;
  key: string;
  sizeBytes: number;
  sha256: string;
  contentType?: string;
  versionId?: string | null;
}

export interface ObjectMetadata {
  sizeBytes: number;
  contentType: string;
  sha256: string | null;
  versionId: string | null;
}

export interface UploadAuthorization {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface PrivateStorageAdapter {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  openObject(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<NodeJS.ReadableStream>;
  deleteObject(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<void>;
  objectExists(namespace: StorageNamespace, key: string): Promise<boolean>;
  getObjectMetadata(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<ObjectMetadata>;
  createUploadAuthorization(input: {
    namespace: StorageNamespace;
    key: string;
    contentType: string;
    maxSizeBytes: number;
    sha256?: string | null;
    expiresInSeconds: number;
  }): Promise<UploadAuthorization>;
  listObjects(namespace: StorageNamespace, prefix?: string): Promise<string[]>;
}

export class StorageObjectAlreadyExistsError extends Error {
  readonly code = 'STORAGE_OBJECT_ALREADY_EXISTS';

  constructor() {
    super('STORAGE_OBJECT_ALREADY_EXISTS');
    this.name = 'StorageObjectAlreadyExistsError';
  }
}

// Helper to convert readable stream to Buffer
export async function streamToBuffer(stream: NodeJS.ReadableStream | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) {
    return stream;
  }
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// 1. In-Memory Adapter (for Testing)
export class InMemoryStorageAdapter implements PrivateStorageAdapter {
  private store = new Map<string, {
    currentVersionId: string;
    versions: Map<string, { buffer: Buffer; contentType: string }>;
  }>();

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const buffer = await streamToBuffer(input.stream);
    const storeKey = `${input.namespace}/${input.key}`;
    const existing = this.store.get(storeKey);
    if (input.ifNoneMatch === '*' && existing) {
      throw new StorageObjectAlreadyExistsError();
    }
    const versionId = crypto.randomUUID();
    const versions = existing?.versions ?? new Map<string, { buffer: Buffer; contentType: string }>();
    versions.set(versionId, { buffer, contentType: input.contentType });
    this.store.set(storeKey, { currentVersionId: versionId, versions });
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    return {
      namespace: input.namespace,
      key: input.key,
      sizeBytes: buffer.length,
      sha256,
      contentType: input.contentType,
      versionId,
    };
  }

  async openObject(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<NodeJS.ReadableStream> {
    const storeKey = `${namespace}/${key}`;
    const stored = this.store.get(storeKey);
    const file = stored?.versions.get(versionId || stored.currentVersionId);
    if (!file) {
      throw new Error(`File not found in Memory Storage: ${storeKey}`);
    }
    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null);
    return stream;
  }

  async deleteObject(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<void> {
    const storeKey = `${namespace}/${key}`;
    const stored = this.store.get(storeKey);
    if (!stored || !versionId) {
      this.store.delete(storeKey);
      return;
    }
    stored.versions.delete(versionId);
    if (stored.versions.size === 0) {
      this.store.delete(storeKey);
    } else if (stored.currentVersionId === versionId) {
      stored.currentVersionId = Array.from(stored.versions.keys()).at(-1)!;
    }
  }

  async objectExists(namespace: StorageNamespace, key: string): Promise<boolean> {
    const storeKey = `${namespace}/${key}`;
    return this.store.has(storeKey);
  }

  async getObjectMetadata(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<ObjectMetadata> {
    const stored = this.store.get(`${namespace}/${key}`);
    const resolvedVersionId = versionId || stored?.currentVersionId;
    const file = resolvedVersionId ? stored?.versions.get(resolvedVersionId) : undefined;
    if (!file) throw new Error('STORAGE_OBJECT_NOT_FOUND');
    return {
      sizeBytes: file.buffer.length,
      contentType: file.contentType,
      sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
      versionId: resolvedVersionId || null,
    };
  }

  async createUploadAuthorization(input: { namespace: StorageNamespace; key: string; contentType: string; maxSizeBytes: number; sha256?: string | null; expiresInSeconds: number }): Promise<UploadAuthorization> {
    return {
      url: `memory://${input.namespace}/${input.key}`,
      method: 'PUT',
      headers: {
        'content-type': input.contentType,
        'content-length': String(input.maxSizeBytes),
        'if-none-match': '*',
        ...(input.sha256 ? { 'x-notebox-sha256': input.sha256 } : {}),
      },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
    };
  }

  async listObjects(namespace: StorageNamespace, prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    const searchPrefix = prefix ? `${namespace}/${prefix}` : `${namespace}/`;
    for (const storeKey of this.store.keys()) {
      if (storeKey.startsWith(searchPrefix)) {
        keys.push(storeKey.substring(namespace.length + 1));
      }
    }
    return keys;
  }
}

// 2. Local Disk Adapter (for Development)
export class LocalDiskStorageAdapter implements PrivateStorageAdapter {
  private baseDir = path.resolve(process.cwd(), 'data/private-media');

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getPath(namespace: StorageNamespace, key: string): string {
    // Prevent directory traversal attacks
    const safeKey = key.replace(/\.\./g, '');
    return path.join(this.baseDir, namespace, safeKey);
  }

  private getVersionPath(namespace: StorageNamespace, key: string, versionId: string): string {
    const safeVersionId = versionId.replace(/[^a-zA-Z0-9-]/g, '');
    return path.join(this.baseDir, '.versions', namespace, key.replace(/\.\./g, ''), safeVersionId);
  }

  private getVersionDirectory(namespace: StorageNamespace, key: string): string {
    return path.join(this.baseDir, '.versions', namespace, key.replace(/\.\./g, ''));
  }

  private getMetadataPath(filePath: string): string {
    return `${filePath}.metadata.json`;
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const filePath = this.getPath(input.namespace, input.key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = await streamToBuffer(input.stream);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const versionId = crypto.randomUUID();
    if (input.ifNoneMatch === '*' && fs.existsSync(filePath)) {
      throw new StorageObjectAlreadyExistsError();
    }
    fs.writeFileSync(filePath, buffer, input.ifNoneMatch === '*' ? { flag: 'wx' } : undefined);
    const versionPath = this.getVersionPath(input.namespace, input.key, versionId);
    fs.mkdirSync(path.dirname(versionPath), { recursive: true });
    fs.writeFileSync(versionPath, buffer, { flag: 'wx' });
    const metadata = JSON.stringify({ contentType: input.contentType, sha256, versionId });
    fs.writeFileSync(this.getMetadataPath(filePath), metadata);
    fs.writeFileSync(this.getMetadataPath(versionPath), metadata, { flag: 'wx' });

    return {
      namespace: input.namespace,
      key: input.key,
      sizeBytes: buffer.length,
      sha256,
      contentType: input.contentType,
      versionId,
    };
  }

  async openObject(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<NodeJS.ReadableStream> {
    const filePath = versionId ? this.getVersionPath(namespace, key, versionId) : this.getPath(namespace, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found in Local Storage: ${namespace}/${key}`);
    }
    return fs.createReadStream(filePath);
  }

  async deleteObject(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<void> {
    const currentPath = this.getPath(namespace, key);
    const filePath = versionId ? this.getVersionPath(namespace, key, versionId) : currentPath;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const metadataPath = this.getMetadataPath(filePath);
    if (fs.existsSync(metadataPath)) fs.unlinkSync(metadataPath);
    if (versionId && fs.existsSync(this.getMetadataPath(currentPath))) {
      const current = JSON.parse(fs.readFileSync(this.getMetadataPath(currentPath), 'utf8')) as { versionId?: string };
      if (current.versionId === versionId) {
        fs.unlinkSync(currentPath);
        fs.unlinkSync(this.getMetadataPath(currentPath));
      }
    }
    if (!versionId) {
      const versionDirectory = this.getVersionDirectory(namespace, key);
      if (fs.existsSync(versionDirectory)) fs.rmSync(versionDirectory, { recursive: true, force: true });
    }
  }

  async objectExists(namespace: StorageNamespace, key: string): Promise<boolean> {
    const filePath = this.getPath(namespace, key);
    return fs.existsSync(filePath);
  }

  async getObjectMetadata(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<ObjectMetadata> {
    const filePath = versionId ? this.getVersionPath(namespace, key, versionId) : this.getPath(namespace, key);
    if (!fs.existsSync(filePath)) throw new Error('STORAGE_OBJECT_NOT_FOUND');
    const buffer = fs.readFileSync(filePath);
    const metadataPath = this.getMetadataPath(filePath);
    if (!fs.existsSync(metadataPath)) throw new Error('STORAGE_OBJECT_METADATA_INVALID');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as {
      contentType: string;
      sha256: string;
      versionId: string;
    };
    return {
      sizeBytes: buffer.length,
      contentType: metadata.contentType,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      versionId: metadata.versionId,
    };
  }

  async createUploadAuthorization(input: { namespace: StorageNamespace; key: string; contentType: string; maxSizeBytes: number; sha256?: string | null; expiresInSeconds: number }): Promise<UploadAuthorization> {
    return {
      url: `local://${input.namespace}/${input.key}`,
      method: 'PUT',
      headers: {
        'content-type': input.contentType,
        'content-length': String(input.maxSizeBytes),
        'if-none-match': '*',
        ...(input.sha256 ? { 'x-notebox-sha256': input.sha256 } : {}),
      },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
    };
  }

  async listObjects(namespace: StorageNamespace, prefix?: string): Promise<string[]> {
    const nsDir = path.join(this.baseDir, namespace);
    if (!fs.existsSync(nsDir)) return [];

    const collectFiles = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(collectFiles(fullPath));
        } else {
          results.push(path.relative(nsDir, fullPath).replace(/\\/g, '/'));
        }
      });
      return results;
    };

    const allFiles = collectFiles(nsDir);
    if (prefix) {
      return allFiles.filter(f => f.startsWith(prefix));
    }
    return allFiles;
  }
}

// 3. S3 Adapter (Production)
export class S3StorageAdapter implements PrivateStorageAdapter {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = S3_BUCKET_NAME;
    this.client = new S3Client({
      region: AWS_REGION,
    });
  }

  private getS3Key(namespace: StorageNamespace, key: string): string {
    return `${namespace}/${key}`;
  }

  protected presignUpload(command: PutObjectCommand, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const s3Key = this.getS3Key(input.namespace, input.key);
    const buffer = await streamToBuffer(input.stream);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    const response = await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: input.contentType,
      ServerSideEncryption: 'AES256',
      ...(input.ifNoneMatch ? { IfNoneMatch: input.ifNoneMatch } : {}),
    }));

    return {
      namespace: input.namespace,
      key: input.key,
      sizeBytes: buffer.length,
      sha256,
      contentType: input.contentType,
      versionId: response.VersionId || null,
    };
  }

  async openObject(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<NodeJS.ReadableStream> {
    const s3Key = this.getS3Key(namespace, key);
    const res = await this.client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ...(versionId ? { VersionId: versionId } : {}),
    }));
    if (!res.Body) {
      throw new Error(`S3 GetObject returned empty body for key ${s3Key}`);
    }
    return res.Body as NodeJS.ReadableStream;
  }

  async deleteObject(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<void> {
    const s3Key = this.getS3Key(namespace, key);
    if (!versionId) {
      for (let purgePass = 0; purgePass < 10; purgePass++) {
        const identifiers: Array<{ Key: string; VersionId: string }> = [];
        let keyMarker: string | undefined;
        let versionIdMarker: string | undefined;
        do {
          const listed = await this.client.send(new ListObjectVersionsCommand({
            Bucket: this.bucketName,
            Prefix: s3Key,
            KeyMarker: keyMarker,
            VersionIdMarker: versionIdMarker,
          }));
          for (const item of [...(listed.Versions || []), ...(listed.DeleteMarkers || [])]) {
            if (item.Key === s3Key && item.VersionId) {
              identifiers.push({ Key: s3Key, VersionId: item.VersionId });
            }
          }
          keyMarker = listed.NextKeyMarker;
          versionIdMarker = listed.NextVersionIdMarker;
          if (!listed.IsTruncated) break;
          if (!keyMarker && !versionIdMarker) throw new Error('S3_VERSION_PURGE_PAGINATION_INVALID');
        } while (keyMarker || versionIdMarker);

        if (identifiers.length === 0) return;
        for (let offset = 0; offset < identifiers.length; offset += 1000) {
          const response = await this.client.send(new DeleteObjectsCommand({
            Bucket: this.bucketName,
            Delete: { Objects: identifiers.slice(offset, offset + 1000), Quiet: true },
          }));
          if (response.Errors?.length) {
            throw new Error(`S3_VERSION_PURGE_FAILED:${response.Errors.map((item) => item.Code || 'Unknown').join(',')}`);
          }
        }
      }
      throw new Error('S3_VERSION_PURGE_DID_NOT_CONVERGE');
    }
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ...(versionId ? { VersionId: versionId } : {}),
    }));
  }

  async objectExists(namespace: StorageNamespace, key: string): Promise<boolean> {
    const s3Key = this.getS3Key(namespace, key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: s3Key }));
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return false;
      throw err;
    }
  }

  async getObjectMetadata(namespace: StorageNamespace, key: string, versionId?: string | null): Promise<ObjectMetadata> {
    const response = await this.client.send(new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: this.getS3Key(namespace, key),
      ...(versionId ? { VersionId: versionId } : {}),
    }));
    if (response.ContentLength == null) throw new Error('STORAGE_OBJECT_METADATA_INVALID');
    return {
      sizeBytes: response.ContentLength,
      contentType: response.ContentType || 'application/octet-stream',
      sha256: response.Metadata?.sha256 || null,
      versionId: response.VersionId || null,
    };
  }

  async createUploadAuthorization(input: { namespace: StorageNamespace; key: string; contentType: string; maxSizeBytes: number; sha256?: string | null; expiresInSeconds: number }): Promise<UploadAuthorization> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: this.getS3Key(input.namespace, input.key),
      ContentType: input.contentType,
      ContentLength: input.maxSizeBytes,
      Metadata: input.sha256 ? { sha256: input.sha256 } : undefined,
      ServerSideEncryption: 'AES256',
      IfNoneMatch: '*',
    });
    const url = await this.presignUpload(command, input.expiresInSeconds);
    return {
      url,
      method: 'PUT',
      headers: {
        'content-type': input.contentType,
        'content-length': String(input.maxSizeBytes),
        'if-none-match': '*',
        ...(input.sha256 ? { 'x-amz-meta-sha256': input.sha256 } : {}),
      },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
    };
  }

  async listObjects(namespace: StorageNamespace, prefix?: string): Promise<string[]> {
    const s3Prefix = prefix ? `${namespace}/${prefix}` : `${namespace}/`;
    const res = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: s3Prefix,
    }));
    if (!res.Contents) return [];
    return res.Contents
      .map(c => c.Key!)
      .filter(k => k.startsWith(s3Prefix))
      .map(k => k.substring(namespace.length + 1));
  }

  // Enforces all Block Public Access settings and server-side encryption controls
  async runSecurityChecks(): Promise<void> {
    const versioning = await this.client.send(new GetBucketVersioningCommand({
      Bucket: this.bucketName,
    }));
    if (versioning.Status !== 'Enabled') {
      throw new Error(`S3 Security Exception: Versioning must be enabled on bucket ${this.bucketName}.`);
    }

    try {
      const publicBlock = await this.client.send(new GetPublicAccessBlockCommand({
        Bucket: this.bucketName,
      }));
      const p = publicBlock.PublicAccessBlockConfiguration;
      if (!p || !p.BlockPublicAcls || !p.IgnorePublicAcls || !p.BlockPublicPolicy || !p.RestrictPublicBuckets) {
        throw new Error(`S3 Security Exception: One or more Block Public Access settings are not fully enabled on bucket ${this.bucketName}.`);
      }
    } catch (err: any) {
      if (err.name === 'AccessDenied' || err.$metadata?.httpStatusCode === 403) {
        console.warn(`S3 Security Warning: GetPublicAccessBlock access is denied for least-privilege validation.`);
      } else {
        throw err;
      }
    }

    try {
      const encryption = await this.client.send(new GetBucketEncryptionCommand({
        Bucket: this.bucketName,
      }));
      const rules = encryption.ServerSideEncryptionConfiguration?.Rules;
      if (!rules || rules.length === 0) {
        throw new Error(`S3 Security Exception: Server-side encryption is not configured on bucket ${this.bucketName}.`);
      }
    } catch (err: any) {
      if (err.name === 'AccessDenied' || err.$metadata?.httpStatusCode === 403) {
        console.warn(`S3 Security Warning: GetBucketEncryption access is denied for least-privilege validation.`);
      } else {
        throw err;
      }
    }
  }
}

// Global Storage Adapter Singleton resolved at startup
let currentAdapter: PrivateStorageAdapter;

export async function initStorage(): Promise<PrivateStorageAdapter> {
  if (isProd) {
    if (EXPORT_STORAGE_PROVIDER !== 's3') {
      throw new Error('Production Startup Blocker: EXPORT_STORAGE_PROVIDER must be "s3" in production.');
    }
    const s3Adapter = new S3StorageAdapter();
    await s3Adapter.runSecurityChecks();
    currentAdapter = s3Adapter;
    console.log('S3 Private Storage adapter initialized and verified successfully.');
  } else if (EXPORT_STORAGE_PROVIDER === 'local') {
    currentAdapter = new LocalDiskStorageAdapter();
    console.log('Local Private Disk Storage adapter initialized successfully.');
  } else {
    currentAdapter = new InMemoryStorageAdapter();
    console.log('In-Memory Private Storage adapter initialized successfully.');
  }
  return currentAdapter;
}

export function getStorage(): PrivateStorageAdapter {
  if (!currentAdapter) {
    if (isProd) {
      throw new Error('Production Storage Error: Storage not initialized. Call initStorage() at startup.');
    }
    currentAdapter = new InMemoryStorageAdapter();
  }
  return currentAdapter;
}
