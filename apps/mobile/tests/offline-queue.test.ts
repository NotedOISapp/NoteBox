import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { storage.delete(key); }),
  },
}));

import { clearMutationQueue, drainMutationQueue, enqueueMutation, readMutationQueue, resolveMappedId } from '@/services/offline-queue';

describe('durable offline mutation queue', () => {
  beforeEach(async () => {
    storage.clear();
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
});
