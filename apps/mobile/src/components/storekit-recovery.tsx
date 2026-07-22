import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useApp } from '@/context/AppContext';
import { useEntitlements } from '@/context/EntitlementContext';
import { recoverNoteBoxTransactions } from '@/services/storekit';

export function StoreKitRecovery() {
  const { isAuthenticated, ageAttested } = useApp();
  const { refresh } = useEntitlements();
  const recoveryInFlight = useRef(false);
  const recoveryPending = useRef(false);
  const recoveryEligible = useRef(false);
  recoveryEligible.current = isAuthenticated && ageAttested;

  const recover = useCallback(async function runRecovery() {
    if (Platform.OS !== 'ios' || !recoveryEligible.current) {
      return;
    }
    if (recoveryInFlight.current) {
      recoveryPending.current = true;
      return;
    }

    recoveryInFlight.current = true;
    try {
      const result = await recoverNoteBoxTransactions();
      if (result.restoredCount > 0 && recoveryEligible.current) {
        try {
          await refresh();
        } catch {
          console.warn('StoreKit transactions were verified, but the membership display could not refresh.');
        }
      }
    } catch (error) {
      // Unfinished StoreKit transactions remain available for the next foreground retry.
      console.warn('StoreKit transaction recovery was deferred.', error);
    } finally {
      recoveryInFlight.current = false;
      if (recoveryPending.current) {
        recoveryPending.current = false;
        void runRecovery();
      }
    }
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void recover();
    });
    return () => subscription.remove();
  }, [recover]);

  useEffect(() => {
    if (isAuthenticated && ageAttested) void recover();
  }, [ageAttested, isAuthenticated, recover]);

  return null;
}
