import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, AppleCredentialPayload } from '@/services/api';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { requestAppleReauthentication } from '@/services/apple-auth';
import { clearMutationQueue, drainMutationQueue, enqueueMutation, PendingMutation, resolveMappedId } from '@/services/offline-queue';
import NetInfo from '@react-native-community/netinfo';
import {
  clearLocalEncryptionKey,
  getEncryptedItem,
  getEncryptedJson,
  removeEncryptedItem,
  setEncryptedItem,
  setEncryptedJson,
} from '@/services/secure-local-storage';

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface Box {
  id: string;
  name: string;
  avatar?: string;
  createdAt: string;
  isArchived?: boolean;
  categoryId?: string;
}

export interface Note {
  id: string;
  boxId: string;
  body: string;
  createdAt: string;
  peopleIds: string[];
  receiptsCount: number;
}

export interface Person {
  id: string;
  name: string;
}

export interface AddMoreBlock {
  id: string;
  noteId: string;
  body: string;
  createdAt: string;
}

export interface AIPerspective {
  aligned: string;
  objective: string;
  unfiltered: string;
  intensity?: 'mild' | 'bold' | 'savage';
  scope?: 'single_note' | 'box_history' | 'people_across_boxes';
}

interface AppContextType {
  boxes: Box[];
  categories: Category[];
  notes: Note[];
  people: Person[];
  addMores: Record<string, AddMoreBlock[]>;
  perspectives: Record<string, AIPerspective>;
  addBox: (name: string, categoryId?: string) => Promise<string>;
  archiveBox: (id: string) => Promise<void>;
  deleteBox: (id: string) => Promise<void>;
  renameBox: (id: string, name: string, categoryId?: string) => Promise<void>;
  addNote: (boxId: string, body: string, peopleIds: string[], receiptsCount?: number) => Promise<string>;
  deleteNote: (id: string) => Promise<void>;
  editNote: (id: string, body: string) => Promise<void>;
  addMoreToNote: (noteId: string, body: string) => Promise<void>;
  addPerson: (name: string) => Promise<string>;
  addCategory: (name: string) => Promise<string>;
  isAuthenticated: boolean;
  ageAttested: boolean;
  login: (credential: AppleCredentialPayload) => Promise<void>;
  logout: () => Promise<void>;
  confirmEligibility: () => Promise<void>;
  declineEligibility: () => Promise<void>;
  deleteAccount: () => Promise<{ statusToken: string; expiresAt: string }>;
  hapticSetting: 'Standard' | 'Light' | 'Off';
  setHapticSetting: (setting: 'Standard' | 'Light' | 'Off') => void;
  syncWithBackend: () => Promise<void>;
  regeneratePerspectives: (noteId: string, intensity: 'mild' | 'bold' | 'savage', scope?: 'single_note' | 'box_history' | 'people_across_boxes') => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
const localId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [addMores, setAddMores] = useState<Record<string, AddMoreBlock[]>>({});
  const [perspectives, setPerspectives] = useState<Record<string, AIPerspective>>({});
  const [hapticSetting, setHapticSettingState] = useState<'Standard' | 'Light' | 'Off'>('Standard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [ageAttested, setAgeAttested] = useState<boolean>(false);

  // Domain data is encrypted before it is written to the AsyncStorage backing store.
  const saveLocal = useCallback(async (key: string, data: any) => {
    try {
      await setEncryptedJson(key, data);
    } catch (e) {
      console.warn('Failed to save to local storage', e);
    }
  }, []);

  const removeBoxDraft = async (boxId: string) => {
    const key = 'notebox_draft_box_' + boxId;
    try {
      await removeEncryptedItem(key);
      // Remove the pre-encryption SecureStore draft if this device has one.
      if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('Failed to delete draft:', e);
    }
  };

  const flushMutationQueue = useCallback(async () => {
    await drainMutationQueue(async (mutation: PendingMutation) => {
      const payload = mutation.payload as Record<string, any>;
      switch (mutation.kind) {
        case 'category.create': {
          const serverCategory = await api.areas.create(payload.name, mutation.id);
          setCategories((previous) => {
            const next = previous.map((item) => item.id === payload.tempId ? serverCategory : item);
            saveLocal('notebox_categories', next);
            return next;
          });
          setBoxes((previous) => {
            const next = previous.map((item) => item.categoryId === payload.tempId ? { ...item, categoryId: serverCategory.id } : item);
            saveLocal('notebox_boxes', next);
            return next;
          });
          return { localId: payload.tempId, serverId: serverCategory.id };
        }
        case 'box.create': {
          const categoryId = payload.categoryId ? await resolveMappedId(payload.categoryId) : undefined;
          const serverBox = await api.boxes.create(payload.name, categoryId && isUUID(categoryId) ? categoryId : undefined, mutation.id);
          const mapped: Box = { ...serverBox, categoryId: serverBox.categoryId || serverBox.areaId };
          setBoxes((previous) => {
            const next = previous.map((item) => item.id === payload.tempId ? mapped : item);
            saveLocal('notebox_boxes', next);
            return next;
          });
          setNotes((previous) => {
            const next = previous.map((item) => item.boxId === payload.tempId ? { ...item, boxId: serverBox.id } : item);
            saveLocal('notebox_notes', next);
            return next;
          });
          return { localId: payload.tempId, serverId: serverBox.id };
        }
        case 'box.rename': {
          const id = await resolveMappedId(payload.id);
          const categoryId = payload.categoryId ? await resolveMappedId(payload.categoryId) : undefined;
          await api.boxes.rename(id, payload.name, categoryId && isUUID(categoryId) ? categoryId : undefined, mutation.id);
          return;
        }
        case 'box.archive':
          await api.boxes.archive(await resolveMappedId(payload.id), mutation.id);
          return;
        case 'box.delete':
          await api.boxes.delete(await resolveMappedId(payload.id), mutation.id);
          return;
        case 'person.create': {
          const serverPerson = await api.people.create(payload.name, mutation.id);
          setPeople((previous) => {
            const next = previous.map((item) => item.id === payload.tempId ? serverPerson : item);
            saveLocal('notebox_people', next);
            return next;
          });
          setNotes((previous) => {
            const next = previous.map((item) => ({
              ...item,
              peopleIds: item.peopleIds.map((id) => id === payload.tempId ? serverPerson.id : id),
            }));
            saveLocal('notebox_notes', next);
            return next;
          });
          return { localId: payload.tempId, serverId: serverPerson.id };
        }
        case 'note.create': {
          const boxId = await resolveMappedId(payload.boxId);
          const peopleIds = await Promise.all((payload.peopleIds as string[]).map(resolveMappedId));
          const serverNote = await api.notes.create(boxId, payload.body, payload.peopleNames, mutation.id);
          const mapped: Note = { ...serverNote, boxId, peopleIds, receiptsCount: payload.receiptsCount };
          setNotes((previous) => {
            const next = previous.map((item) => item.id === payload.tempId ? mapped : item);
            saveLocal('notebox_notes', next);
            return next;
          });
          setAddMores((previous) => {
            if (!previous[payload.tempId]) return previous;
            const next: Record<string, AddMoreBlock[]> = {
              ...previous,
              [serverNote.id]: previous[payload.tempId].map((block) => ({ ...block, noteId: serverNote.id })),
            };
            delete next[payload.tempId];
            saveLocal('notebox_add_mores', next);
            return next;
          });
          const receipts = await getEncryptedItem(`note_receipts_${payload.tempId}`);
          if (receipts !== null) {
            await setEncryptedItem(`note_receipts_${serverNote.id}`, receipts);
            await removeEncryptedItem(`note_receipts_${payload.tempId}`);
          }
          return { localId: payload.tempId, serverId: serverNote.id };
        }
        case 'note.edit':
          await api.notes.edit(await resolveMappedId(payload.id), payload.body, mutation.id);
          return;
        case 'note.delete':
          await api.notes.delete(await resolveMappedId(payload.id), mutation.id);
          return;
        case 'addMore.create': {
          const noteId = await resolveMappedId(payload.noteId);
          const serverBlock = await api.notes.addMore(noteId, payload.body, mutation.id);
          setAddMores((previous) => {
            const source = previous[payload.noteId] || previous[noteId] || [];
            const next = {
              ...previous,
              [noteId]: source.map((block) => block.id === payload.tempId ? { ...serverBlock, noteId } : block),
            };
            if (payload.noteId !== noteId) delete next[payload.noteId];
            saveLocal('notebox_add_mores', next);
            return next;
          });
          return { localId: payload.tempId, serverId: serverBlock.id };
        }
      }
    });
  }, [saveLocal]);

  /**
   * Syncs local state with backend endpoints if available
   */
  const syncWithBackend = useCallback(async () => {
    try {
      await flushMutationQueue();
      // 1. Fetch areas (backend still uses areas endpoint)
      const serverAreas = await api.areas.list();
      const mappedCategories: Category[] = serverAreas.map((a: any) => ({
        id: a.id,
        name: a.name,
        createdAt: a.createdAt,
      }));
      setCategories(mappedCategories);
      await saveLocal('notebox_categories', mappedCategories);

      // 2. Fetch boxes (map backend areaId to client categoryId)
      const serverBoxes = await api.boxes.list();
      const mappedBoxes: Box[] = serverBoxes.map((b: any) => ({
        id: b.id,
        name: b.name,
        avatar: b.avatar,
        createdAt: b.createdAt,
        isArchived: b.isArchived,
        categoryId: b.categoryId || b.areaId,
      }));
      setBoxes(mappedBoxes);
      await saveLocal('notebox_boxes', mappedBoxes);

      // 3. Fetch notes
      const listedNotes = await api.notes.list();
      const serverNotes = await Promise.all(listedNotes.map((note: any) => api.notes.get(note.id)));
      const mappedNotes: Note[] = serverNotes.map((note: any) => ({
        ...note,
        peopleIds: (note.people || []).map((person: any) => person.id),
        receiptsCount: note.receiptsCount || 0,
      }));
      const mappedAddMores = serverNotes.reduce((result: Record<string, AddMoreBlock[]>, note: any) => {
        result[note.id] = note.addMores || [];
        return result;
      }, {});
      setNotes(mappedNotes);
      setAddMores(mappedAddMores);
      await saveLocal('notebox_notes', mappedNotes);
      await saveLocal('notebox_add_mores', mappedAddMores);

      // 4. Fetch people tags
      const serverPeople = await api.people.list();
      setPeople(serverPeople);
      await saveLocal('notebox_people', serverPeople);

    } catch (err) {
      // Sync failed (offline). Fallback silently.
      throw err;
    }
  }, [flushMutationQueue, saveLocal]);

  // Load cache on mount
  useEffect(() => {
    const loadCache = async () => {
      try {
        const storedBoxes = await getEncryptedJson<Box[]>('notebox_boxes');
        const storedCategories = await getEncryptedJson<Category[]>('notebox_categories');
        const storedAreas = await getEncryptedJson<Category[]>('notebox_areas');
        const storedNotes = await getEncryptedJson<Note[]>('notebox_notes');
        const storedPeople = await getEncryptedJson<Person[]>('notebox_people');
        const storedAddMores = await getEncryptedJson<Record<string, AddMoreBlock[]>>('notebox_add_mores');
        const storedPerspectives = await getEncryptedJson<Record<string, AIPerspective>>('notebox_perspectives');
        const storedHaptic = await AsyncStorage.getItem('hapticSetting');

        if (storedBoxes) {
          const mappedBoxes = storedBoxes.map((b) => ({
            ...b,
            categoryId: b.categoryId || (b as Box & { areaId?: string }).areaId,
          }));
          setBoxes(mappedBoxes);
        }

        if (storedCategories) {
          setCategories(storedCategories);
        } else if (storedAreas) {
          setCategories(storedAreas);
          await saveLocal('notebox_categories', storedAreas);
          await removeEncryptedItem('notebox_areas');
        } else {
          await saveLocal('notebox_categories', []);
        }
        if (storedNotes) setNotes(storedNotes);
        if (storedPeople) setPeople(storedPeople);
        if (storedAddMores) setAddMores(storedAddMores);
        if (storedPerspectives) setPerspectives(storedPerspectives);
        if (storedHaptic === 'Standard' || storedHaptic === 'Light' || storedHaptic === 'Off') {
          setHapticSettingState(storedHaptic);
        }

        // Check authentication status and eligibility
        const token = await SecureStore.getItemAsync('access_token');
        if (token) {
          try {
            const eligibility = await api.auth.getEligibility();
            setIsAuthenticated(true);
            setAgeAttested(eligibility.ageAttested);
            if (eligibility.ageAttested) {
              await syncWithBackend();
            }
          } catch {
            setIsAuthenticated(false);
            setAgeAttested(false);
            console.warn('Session could not be validated; private content remains locked.');
          }
        } else {
          setIsAuthenticated(false);
          setAgeAttested(false);
        }
      } catch (e) {
        console.warn('Failed to load local cache', e);
      }
    };
    loadCache();
  }, [syncWithBackend, saveLocal]);

  useEffect(() => NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false && isAuthenticated && ageAttested) {
      void syncWithBackend().catch((error) => {
        console.warn('Reconnection sync failed; queued changes remain preserved.', error);
      });
    }
  }), [ageAttested, isAuthenticated, syncWithBackend]);

  const setHapticSetting = async (setting: 'Standard' | 'Light' | 'Off') => {
    setHapticSettingState(setting);
    try {
      await AsyncStorage.setItem('hapticSetting', setting);
    } catch (e) {
      console.warn('Failed to save haptic setting', e);
    }
  };

  const login = async (credential: AppleCredentialPayload) => {
    try {
      const data = await api.auth.appleSignIn(credential);
      setIsAuthenticated(true);
      setAgeAttested(data.user.ageAttested);
      if (data.user.ageAttested) {
        await syncWithBackend();
      }
    } catch (e) {
      console.warn('Sign-in failed:', e);
      throw e;
    }
  };

  const logout = async () => {
    let cleanupFailed = false;
    try {
      await api.auth.logout();
    } catch {
      cleanupFailed = true;
    }
    setIsAuthenticated(false);
    setAgeAttested(false);

    // Clear local cache keys
    try {
      // Clear all box drafts from AsyncStorage and SecureStore
      for (const box of boxes) {
        const draftKey = `notebox_draft_box_${box.id}`;
        await AsyncStorage.removeItem(draftKey).catch(() => {});
        if (Platform.OS !== 'web') {
          await SecureStore.deleteItemAsync(draftKey).catch(() => {});
        }
      }

      const credentialDeletes = await Promise.allSettled([
        SecureStore.deleteItemAsync('access_token'),
        SecureStore.deleteItemAsync('refresh_token'),
      ]);
      cleanupFailed ||= credentialDeletes.some((result) => result.status === 'rejected');

      const allKeys = await AsyncStorage.getAllKeys();
      const keysToClear = allKeys.filter((key) =>
        key.startsWith('notebox_') ||
        key.startsWith('note_receipts_') ||
        key.startsWith('draft_') ||
        ['ai_consent_granted', 'face_id_enabled', 'do_not_sell_opt_out', 'onboarding_completed', 'age_verified', 'age_attested', 'subscription_tier'].includes(key)
      );
      await AsyncStorage.multiRemove(keysToClear);
      await clearMutationQueue();
      await clearLocalEncryptionKey();

      // Reset local state to defaults
      setBoxes([]);
      setCategories([]);
      setNotes([]);
      setPeople([]);
      setAddMores({});
      setPerspectives({});
    } catch (e) {
      console.warn('Failed to clear AsyncStorage cache:', e);
      cleanupFailed = true;
    }

    if (cleanupFailed) {
      throw new Error('Signed out, but some local data could not be removed. Please restart the app and try again.');
    }
  };

  const confirmEligibility = async () => {
    try {
      await api.auth.recordEligibility();
      setAgeAttested(true);
      await syncWithBackend();
    } catch (e) {
      console.warn('Confirm eligibility failed:', e);
      throw e;
    }
  };

  const declineEligibility = async () => {
    try {
      await api.auth.declineEligibility();
    } catch {}
    await logout();
  };

  const deleteAccount = async () => {
    await api.auth.reauthenticate('account_deletion', requestAppleReauthentication);
    const result = await api.compliance.deleteAccount();
    if (!result.statusToken) throw new Error('The server did not return a deletion status token.');
    await SecureStore.setItemAsync('deletion_status_token', result.statusToken);
    await SecureStore.setItemAsync('deletion_status_expires_at', result.expiresAt);
    await logout();
    return { statusToken: result.statusToken, expiresAt: result.expiresAt };
  };

  const addBox = async (name: string, categoryId?: string): Promise<string> => {
    const tempId = localId();
    const newBox: Box = {
      id: tempId,
      name,
      categoryId,
      createdAt: new Date().toISOString(),
    };
    const nextBoxes = [newBox, ...boxes];
    setBoxes(nextBoxes);
    await saveLocal('notebox_boxes', nextBoxes);

    await enqueueMutation({ id: localId(), kind: 'box.create', createdAt: new Date().toISOString(), payload: { tempId, name, categoryId } });
    await flushMutationQueue().catch(() => undefined);
    return resolveMappedId(tempId);
  };

  const archiveBox = async (id: string) => {
    const nextBoxes = boxes.map(box => box.id === id ? { ...box, isArchived: true } : box);
    setBoxes(nextBoxes);
    await saveLocal('notebox_boxes', nextBoxes);

    await enqueueMutation({ id: localId(), kind: 'box.archive', createdAt: new Date().toISOString(), payload: { id } });
    await flushMutationQueue().catch(() => undefined);
  };

  const deleteBox = async (id: string) => {
    const nextBoxes = boxes.filter(box => box.id !== id);
    setBoxes(nextBoxes);
    await saveLocal('notebox_boxes', nextBoxes);
    await removeBoxDraft(id);

    await enqueueMutation({ id: localId(), kind: 'box.delete', createdAt: new Date().toISOString(), payload: { id } });
    await flushMutationQueue().catch(() => undefined);
  };

  const renameBox = async (id: string, name: string, categoryId?: string) => {
    const nextBoxes = boxes.map(box => box.id === id ? { ...box, name, categoryId } : box);
    setBoxes(nextBoxes);
    await saveLocal('notebox_boxes', nextBoxes);

    await enqueueMutation({ id: localId(), kind: 'box.rename', createdAt: new Date().toISOString(), payload: { id, name, categoryId } });
    await flushMutationQueue().catch(() => undefined);
  };

  const addCategory = async (name: string): Promise<string> => {
    const tempId = localId();
    const newCategory: Category = {
      id: tempId,
      name,
      createdAt: new Date().toISOString(),
    };
    const nextCategories = [...categories, newCategory];
    setCategories(nextCategories);
    await saveLocal('notebox_categories', nextCategories);

    await enqueueMutation({ id: localId(), kind: 'category.create', createdAt: new Date().toISOString(), payload: { tempId, name } });
    await flushMutationQueue().catch(() => undefined);
    return resolveMappedId(tempId);
  };

  const addNote = async (boxId: string, body: string, peopleIds: string[], receiptsCount: number = 0): Promise<string> => {
    const tempId = localId();
    const newNote: Note = {
      id: tempId,
      boxId,
      body,
      createdAt: new Date().toISOString(),
      peopleIds,
      receiptsCount,
    };

    const nextNotes = [newNote, ...notes];

    setNotes(nextNotes);
    await saveLocal('notebox_notes', nextNotes);

    // Sync box timestamp to float it to top
    setBoxes(prevBoxes => {
      const boxToMove = prevBoxes.find(b => b.id === boxId);
      if (!boxToMove) return prevBoxes;
      const updatedBox = { ...boxToMove, createdAt: new Date().toISOString() };
      const nextList = [updatedBox, ...prevBoxes.filter(b => b.id !== boxId)];
      saveLocal('notebox_boxes', nextList);
      return nextList;
    });

    const peopleNames = people.filter(p => peopleIds.includes(p.id)).map(p => p.name);
    await enqueueMutation({
      id: localId(),
      kind: 'note.create',
      createdAt: new Date().toISOString(),
      payload: { tempId, boxId, body, peopleIds, peopleNames, receiptsCount },
    });
    await flushMutationQueue().catch(() => undefined);
    const resolvedId = await resolveMappedId(tempId);
    if (resolvedId !== tempId && await AsyncStorage.getItem('ai_consent_granted') === 'true') {
      try {
        const aiData = await api.perspectives.generate(resolvedId);
        const aligned = aiData.perspectives.find((item: any) => item.perspectiveType === 'aligned');
        const objective = aiData.perspectives.find((item: any) => item.perspectiveType === 'objective');
        const unfiltered = aiData.perspectives.find((item: any) => item.perspectiveType === 'unfiltered');
        if (aligned && objective && unfiltered) {
          const response: AIPerspective = {
            aligned: aligned.responseText,
            objective: objective.responseText,
            unfiltered: unfiltered.responseText,
            intensity: unfiltered.intensity,
            scope: aligned.contextScope || 'single_note',
          };
          setPerspectives((previous) => {
            const next = { ...previous, [resolvedId]: response };
            saveLocal('notebox_perspectives', next);
            return next;
          });
        }
      } catch (error) {
        console.warn('Perspective generation remains pending:', error);
      }
    }
    return resolvedId;
  };

  const deleteNote = async (id: string) => {
    const nextNotes = notes.filter(note => note.id !== id);
    setNotes(nextNotes);
    await saveLocal('notebox_notes', nextNotes);

    await enqueueMutation({ id: localId(), kind: 'note.delete', createdAt: new Date().toISOString(), payload: { id } });
    await flushMutationQueue().catch(() => undefined);
  };

  const editNote = async (id: string, body: string) => {
    const nextNotes = notes.map(note => note.id === id ? { ...note, body } : note);
    setNotes(nextNotes);
    await saveLocal('notebox_notes', nextNotes);

    await enqueueMutation({ id: localId(), kind: 'note.edit', createdAt: new Date().toISOString(), payload: { id, body } });
    await flushMutationQueue().catch(() => undefined);
  };

  const addMoreToNote = async (noteId: string, body: string) => {
    const newBlock: AddMoreBlock = {
      id: localId(),
      noteId,
      body,
      createdAt: new Date().toISOString(),
    };

    const nextAddMores = {
      ...addMores,
      [noteId]: [...(addMores[noteId] || []), newBlock],
    };
    setAddMores(nextAddMores);
    await saveLocal('notebox_add_mores', nextAddMores);

    await enqueueMutation({ id: localId(), kind: 'addMore.create', createdAt: new Date().toISOString(), payload: { tempId: newBlock.id, noteId, body } });
    await flushMutationQueue().catch(() => undefined);
  };

  const addPerson = async (name: string) => {
    const tempId = localId();
    const newPerson: Person = {
      id: tempId,
      name,
    };
    const nextPeople = [...people, newPerson];
    setPeople(nextPeople);
    await saveLocal('notebox_people', nextPeople);

    await enqueueMutation({ id: localId(), kind: 'person.create', createdAt: new Date().toISOString(), payload: { tempId, name } });
    await flushMutationQueue().catch(() => undefined);
    return resolveMappedId(tempId);
  };

  const regeneratePerspectives = async (noteId: string, intensity: 'mild' | 'bold' | 'savage', scope?: 'single_note' | 'box_history' | 'people_across_boxes') => {
    const consentKey = ['ai', 'consent', 'granted'].join('_');
    const hasConsent = await AsyncStorage.getItem(consentKey);
    if (hasConsent !== 'true') {
      throw new Error('AI consent is required before a Perspective can be generated.');
    }
    try {
      const aiData = await api.perspectives.generate(noteId, intensity, scope);
      const alignedP = aiData.perspectives.find((p: any) => p.perspectiveType === 'aligned');
      const unfilteredP = aiData.perspectives.find((p: any) => p.perspectiveType === 'unfiltered');
      const formatPerspectives = {
        aligned: alignedP?.responseText || '',
        objective: aiData.perspectives.find((p: any) => p.perspectiveType === 'objective')?.responseText || '',
        unfiltered: unfilteredP?.responseText || '',
        intensity: unfilteredP?.intensity || intensity,
        scope: alignedP?.contextScope || scope || 'single_note',
      };

      setPerspectives(prev => {
        const next = { ...prev, [noteId]: formatPerspectives };
        saveLocal('notebox_perspectives', next);
        return next;
      });
    } catch (err) {
      console.warn('Failed to regenerate perspectives:', err);
      throw err;
    }
  };

  return (
    <AppContext.Provider value={{
      boxes,
      categories,
      notes,
      people,
      addMores,
      perspectives,
      addBox,
      archiveBox,
      deleteBox,
      renameBox,
      addNote,
      deleteNote,
      editNote,
      addMoreToNote,
      addPerson,
      addCategory,
      hapticSetting,
      setHapticSetting,
      syncWithBackend,
      regeneratePerspectives,
      isAuthenticated,
      ageAttested,
      confirmEligibility,
      declineEligibility,
      deleteAccount,
      login,
      logout
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
