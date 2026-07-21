import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_KEY_PREFIX = 'notebox_draft_';

const isWeb = Platform.OS === 'web';

const getDraftItem = async (key: string): Promise<string | null> => {
  if (isWeb) {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
};

const setDraftItem = async (key: string, value: string): Promise<void> => {
  if (isWeb) {
    return AsyncStorage.setItem(key, value);
  }
  return SecureStore.setItemAsync(key, value);
};

const removeDraftItem = async (key: string): Promise<void> => {
  if (isWeb) {
    return AsyncStorage.removeItem(key);
  }
  return SecureStore.deleteItemAsync(key);
};

export function useAutosave(draftId: string, initialValue: string = '') {
  const [draftText, setDraftText] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedText = useRef(initialValue);
  const draftTextRef = useRef(draftText);

  // Sync draftText state to draftTextRef
  useEffect(() => {
    draftTextRef.current = draftText;
  }, [draftText]);

  const prevDraftId = useRef(draftId);

  // Load draft on mount or draftId change
  useEffect(() => {
    const loadDraft = async () => {
      try {
        if (prevDraftId.current !== draftId) {
          const textToSave = draftTextRef.current;
          if (textToSave !== lastSavedText.current) {
            await setDraftItem(DRAFT_KEY_PREFIX + prevDraftId.current, textToSave);
          }
          prevDraftId.current = draftId;
        }

        const stored = await getDraftItem(DRAFT_KEY_PREFIX + draftId);
        if (stored !== null) {
          setDraftText(stored);
          lastSavedText.current = stored;
        } else {
          setDraftText(initialValue);
          lastSavedText.current = initialValue;
        }
      } catch (error) {
        console.warn('Failed to load draft:', error);
      }
    };

    loadDraft();
  }, [draftId, initialValue]);

  // Periodic autosave timer
  useEffect(() => {
    const saveTimer = setInterval(async () => {
      const currentText = draftTextRef.current;
      if (currentText === lastSavedText.current) return; // Nothing new to save

      setIsSaving(true);
      try {
        await setDraftItem(DRAFT_KEY_PREFIX + draftId, currentText);
        lastSavedText.current = currentText;
      } catch (error) {
        console.warn('Failed to save draft:', error);
      } finally {
        setTimeout(() => setIsSaving(false), 500); // Visual stability
      }
    }, 3000); // Autosave every 3 seconds

    return () => clearInterval(saveTimer);
  }, [draftId]);

  // Save immediately on AppState backgrounding
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        const currentText = draftTextRef.current;
        if (currentText === lastSavedText.current) return;

        setIsSaving(true);
        try {
          await setDraftItem(DRAFT_KEY_PREFIX + draftId, currentText);
          lastSavedText.current = currentText;
        } catch (error) {
          console.warn('Failed to save draft on background:', error);
        } finally {
          setIsSaving(false);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [draftId]);

  const forceSave = async (textToSave = draftText) => {
    if (textToSave === lastSavedText.current) return;
    setIsSaving(true);
    try {
      await setDraftItem(DRAFT_KEY_PREFIX + draftId, textToSave);
      lastSavedText.current = textToSave;
    } catch (error) {
      console.warn('Failed to force save draft:', error);
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const discardDraft = async () => {
    try {
      await removeDraftItem(DRAFT_KEY_PREFIX + draftId);
      setDraftText('');
      lastSavedText.current = '';
    } catch (error) {
      console.warn('Failed to discard draft:', error);
    }
  };

  return {
    draftText,
    setDraftText,
    isSaving,
    discardDraft,
    forceSave,
  };
}
