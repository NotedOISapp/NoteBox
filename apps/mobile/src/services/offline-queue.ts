import {
  getEncryptedJson,
  decryptLocalFileBytes,
  encryptLocalFileBytes,
  removeEncryptedItem,
  SecureLocalDataError,
  setEncryptedJson,
} from './secure-local-storage';
import { Directory, File, Paths } from 'expo-file-system';

export type MutationKind =
  | 'category.create'
  | 'box.create'
  | 'box.rename'
  | 'box.archive'
  | 'box.delete'
  | 'person.create'
  | 'note.create'
  | 'note.edit'
  | 'note.delete'
  | 'receipt.upload'
  | 'addMore.create';

export interface PendingMutation {
  id: string;
  kind: MutationKind;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface IdMapping {
  localId: string;
  serverId: string;
}

export interface DeadLetterMutation {
  mutation: PendingMutation;
  failedAt: string;
  errorCode: string;
}

export class PermanentMutationError extends Error {
  constructor(
    message: string,
    readonly errorCode: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'PermanentMutationError';
  }
}

export class MutationDrainError extends Error {
  constructor(
    readonly deadLetters: DeadLetterMutation[],
    options?: { cause?: unknown },
  ) {
    super(
      deadLetters.length === 1
        ? 'One saved change could not be accepted. Later changes continued syncing.'
        : `${deadLetters.length} saved changes could not be accepted. Later changes continued syncing.`,
      options,
    );
    this.name = 'MutationDrainError';
  }
}

export interface ReceiptUploadAssetReference {
  uri: string;
  contentType: string;
  fileName: string;
  attachmentKind: 'receipt' | 'screenshot';
  sizeBytes: number;
  encryptionBinding: string;
}

export interface ReceiptUploadSource {
  uri: string;
  contentType: string;
  fileName: string;
  attachmentKind: 'receipt' | 'screenshot';
}

export const MUTATION_QUEUE_KEY = 'notebox_pending_mutations';
export const ID_MAPPING_KEY = 'notebox_id_mappings';
export const DEAD_LETTER_QUEUE_KEY = 'notebox_dead_letter_mutations';
export const MAX_PENDING_RECEIPT_BYTES = 10 * 1024 * 1024;
const PENDING_RECEIPT_DIRECTORY_NAME = 'notebox-pending-receipts';
const TRANSIENT_RECEIPT_DIRECTORY_NAME = 'notebox-receipt-uploads';

let queueWrite: Promise<unknown> = Promise.resolve();
let activeDrain: Promise<void> | null = null;

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queueWrite.then(work, work);
  queueWrite = next.catch(() => undefined);
  return next;
}

export async function readMutationQueue(): Promise<PendingMutation[]> {
  const parsed = await getEncryptedJson<unknown>(MUTATION_QUEUE_KEY);
  if (parsed === null) return [];
  if (!Array.isArray(parsed)) {
    throw new SecureLocalDataError('The pending mutation queue is invalid. It was preserved for recovery.', MUTATION_QUEUE_KEY);
  }
  return parsed as PendingMutation[];
}

export async function enqueueMutation(mutation: PendingMutation): Promise<void> {
  await serialize(async () => {
    const queue = await readMutationQueue();
    if (!queue.some((item) => item.id === mutation.id)) {
      queue.push(mutation);
      await setEncryptedJson(MUTATION_QUEUE_KEY, queue);
    }
  });
}

async function recordIdMapping(mapping: IdMapping): Promise<void> {
  const mappings = await getEncryptedJson<Record<string, string>>(ID_MAPPING_KEY) ?? {};
  mappings[mapping.localId] = mapping.serverId;
  await setEncryptedJson(ID_MAPPING_KEY, mappings);
}

export async function resolveMappedId(id: string): Promise<string> {
  const mappings = await getEncryptedJson<Record<string, string>>(ID_MAPPING_KEY);
  return mappings?.[id] || id;
}

export async function readDeadLetterQueue(): Promise<DeadLetterMutation[]> {
  return await getEncryptedJson<DeadLetterMutation[]>(DEAD_LETTER_QUEUE_KEY) ?? [];
}

async function recordDeadLetter(mutation: PendingMutation, error: PermanentMutationError): Promise<DeadLetterMutation> {
  const deadLetters = await readDeadLetterQueue();
  const existing = deadLetters.find((item) => item.mutation.id === mutation.id);
  if (existing) return existing;
  const deadLetter = {
    mutation,
    failedAt: new Date().toISOString(),
    errorCode: error.errorCode,
  };
  deadLetters.push(deadLetter);
  await setEncryptedJson(DEAD_LETTER_QUEUE_KEY, deadLetters);
  return deadLetter;
}

function pendingReceiptDirectory(): Directory {
  return new Directory(Paths.document, PENDING_RECEIPT_DIRECTORY_NAME);
}

function safeExtension(fileName: string, uri: string): string {
  const candidate = fileName.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0]
    ?? uri.split(/[?#]/, 1)[0].match(/\.[a-zA-Z0-9]{1,10}$/)?.[0]
    ?? '';
  return candidate.toLowerCase();
}

export async function persistReceiptUploadAsset(
  source: ReceiptUploadSource,
  mutationId: string,
): Promise<ReceiptUploadAssetReference> {
  const directory = pendingReceiptDirectory();
  directory.create({ intermediates: true, idempotent: true });
  const safeMutationId = mutationId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sourceFile = new File(source.uri);
  if (!sourceFile.exists || sourceFile.size <= 0) {
    throw new Error('The selected attachment is empty or could not be preserved.');
  }
  if (sourceFile.size > MAX_PENDING_RECEIPT_BYTES) {
    throw new Error('Attachments must be 10 MB or smaller.');
  }
  const plaintext = await sourceFile.bytes();
  const sizeBytes = plaintext.length;
  if (sizeBytes <= 0) {
    throw new Error('The selected attachment is empty or could not be preserved.');
  }
  if (sizeBytes > MAX_PENDING_RECEIPT_BYTES) {
    throw new Error('Attachments must be 10 MB or smaller.');
  }
  const encryptionBinding = `receipt-upload:${mutationId}`;
  const encrypted = await encryptLocalFileBytes(encryptionBinding, plaintext);
  const destination = new File(directory, `${safeMutationId}.nbq`);
  destination.create({ overwrite: true, intermediates: true });
  destination.write(encrypted);
  return { ...source, uri: destination.uri, sizeBytes, encryptionBinding };
}

export async function removePersistedReceiptUploadAsset(uri: string): Promise<void> {
  const directory = pendingReceiptDirectory();
  const directoryPrefix = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
  if (!uri.startsWith(directoryPrefix)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}

export async function materializeReceiptUploadAsset(asset: ReceiptUploadAssetReference): Promise<string> {
  const encryptedFile = new File(asset.uri);
  if (!encryptedFile.exists) throw new Error('The queued attachment file is no longer available.');
  const plaintext = await decryptLocalFileBytes(asset.encryptionBinding, await encryptedFile.bytes());
  const directory = new Directory(Paths.cache, TRANSIENT_RECEIPT_DIRECTORY_NAME);
  directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, `${asset.encryptionBinding.replace(/[^a-zA-Z0-9_-]/g, '_')}${safeExtension(asset.fileName, '')}`);
  destination.create({ overwrite: true, intermediates: true });
  destination.write(plaintext);
  return destination.uri;
}

export async function removeMaterializedReceiptUploadAsset(uri: string): Promise<void> {
  const directory = new Directory(Paths.cache, TRANSIENT_RECEIPT_DIRECTORY_NAME);
  const directoryPrefix = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
  if (!uri.startsWith(directoryPrefix)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}

export function drainMutationQueue(
  handler: (
    mutation: PendingMutation,
    persistPayload: (patch: Record<string, unknown>) => Promise<void>,
    afterCommit: (work: () => Promise<void>) => void,
  ) => Promise<IdMapping | void>,
): Promise<void> {
  if (activeDrain) return activeDrain;
  activeDrain = serialize(async () => {
    const queue = await readMutationQueue();
    const newDeadLetters: DeadLetterMutation[] = [];
    while (queue.length > 0) {
      const mutation = queue[0];
      const persistPayload = async (patch: Record<string, unknown>) => {
        mutation.payload = { ...mutation.payload, ...patch };
        queue[0] = mutation;
        await setEncryptedJson(MUTATION_QUEUE_KEY, queue);
      };
      const afterCommitWork: (() => Promise<void>)[] = [];
      let mapping: IdMapping | void;
      try {
        mapping = await handler(mutation, persistPayload, (work) => afterCommitWork.push(work));
      } catch (error) {
        if (!(error instanceof PermanentMutationError)) {
          if (newDeadLetters.length) throw new MutationDrainError(newDeadLetters, { cause: error });
          throw error;
        }
        newDeadLetters.push(await recordDeadLetter(mutation, error));
        mapping = undefined;
      }
      if (mapping) await recordIdMapping(mapping);
      queue.shift();
      if (queue.length) {
        await setEncryptedJson(MUTATION_QUEUE_KEY, queue);
      } else {
        await removeEncryptedItem(MUTATION_QUEUE_KEY);
      }
      await Promise.allSettled(afterCommitWork.map((work) => work()));
    }
    if (newDeadLetters.length) throw new MutationDrainError(newDeadLetters);
  }).finally(() => {
    activeDrain = null;
  });
  return activeDrain;
}

export async function clearMutationQueue(): Promise<void> {
  await serialize(async () => {
    const pendingDirectory = pendingReceiptDirectory();
    if (pendingDirectory.exists) pendingDirectory.delete();
    const transientDirectory = new Directory(Paths.cache, TRANSIENT_RECEIPT_DIRECTORY_NAME);
    if (transientDirectory.exists) transientDirectory.delete();
    await removeEncryptedItem(MUTATION_QUEUE_KEY);
    await removeEncryptedItem(ID_MAPPING_KEY);
    await removeEncryptedItem(DEAD_LETTER_QUEUE_KEY);
  });
}
