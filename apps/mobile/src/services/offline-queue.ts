import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const value = await AsyncStorage.getItem(MUTATION_QUEUE_KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function enqueueMutation(mutation: PendingMutation): Promise<void> {
  await serialize(async () => {
    const queue = await readMutationQueue();
    if (!queue.some((item) => item.id === mutation.id)) {
      queue.push(mutation);
      await AsyncStorage.setItem(MUTATION_QUEUE_KEY, JSON.stringify(queue));
    }
  });
}

async function recordIdMapping(mapping: IdMapping): Promise<void> {
  const raw = await AsyncStorage.getItem(ID_MAPPING_KEY);
  const mappings: Record<string, string> = raw ? JSON.parse(raw) : {};
  mappings[mapping.localId] = mapping.serverId;
  await AsyncStorage.setItem(ID_MAPPING_KEY, JSON.stringify(mappings));
}

export async function resolveMappedId(id: string): Promise<string> {
  const raw = await AsyncStorage.getItem(ID_MAPPING_KEY);
  if (!raw) return id;
  try {
    return JSON.parse(raw)[id] || id;
  } catch {
    return id;
  }
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
        await AsyncStorage.setItem(MUTATION_QUEUE_KEY, JSON.stringify(remaining));
      } else {
        await AsyncStorage.removeItem(MUTATION_QUEUE_KEY);
      }
    }
  }).finally(() => {
    activeDrain = null;
  });
  return activeDrain;
}

export async function clearMutationQueue(): Promise<void> {
  await serialize(async () => {
    await AsyncStorage.removeItem(MUTATION_QUEUE_KEY);
    await AsyncStorage.removeItem(ID_MAPPING_KEY);
  });
}
