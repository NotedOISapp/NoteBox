import {
  getEncryptedJson,
  removeEncryptedItem,
  SecureLocalDataError,
  setEncryptedJson,
} from './secure-local-storage';

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

export const MUTATION_QUEUE_KEY = 'notebox_pending_mutations';
export const ID_MAPPING_KEY = 'notebox_id_mappings';

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

export function drainMutationQueue(
  handler: (mutation: PendingMutation) => Promise<IdMapping | void>,
): Promise<void> {
  if (activeDrain) return activeDrain;
  activeDrain = serialize(async () => {
    const queue = await readMutationQueue();
    for (let index = 0; index < queue.length; index += 1) {
      const mutation = queue[index];
      const mapping = await handler(mutation);
      if (mapping) await recordIdMapping(mapping);
      const remaining = queue.slice(index + 1);
      if (remaining.length) {
        await setEncryptedJson(MUTATION_QUEUE_KEY, remaining);
      } else {
        await removeEncryptedItem(MUTATION_QUEUE_KEY);
      }
    }
  }).finally(() => {
    activeDrain = null;
  });
  return activeDrain;
}

export async function clearMutationQueue(): Promise<void> {
  await serialize(async () => {
    await removeEncryptedItem(MUTATION_QUEUE_KEY);
    await removeEncryptedItem(ID_MAPPING_KEY);
  });
}
