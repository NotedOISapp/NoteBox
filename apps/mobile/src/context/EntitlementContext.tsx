import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/services/api';
import {
  FREE_ENTITLEMENT,
  NormalizedEntitlement,
  normalizeEntitlement,
} from '@/services/entitlements';
import { useApp } from './AppContext';

export type { BackendEntitlement, NormalizedEntitlement, UserPlan } from '@/services/entitlements';
export { normalizeEntitlement } from '@/services/entitlements';

interface EntitlementContextType extends NormalizedEntitlement {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  checkBoxLocked: (noteCount: number) => boolean;
}

const EntitlementContext = createContext<EntitlementContextType | undefined>(undefined);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useApp();
  const [entitlement, setEntitlement] = useState<NormalizedEntitlement>(FREE_ENTITLEMENT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setEntitlement(FREE_ENTITLEMENT);
      setError(null);
      return;
    }
    setIsLoading(true);
    try {
      setEntitlement(normalizeEntitlement(await api.entitlements.get()));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh membership status.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh().catch(() => {
      // The backend remains canonical; do not invent paid access on a failed refresh.
    });
  }, [refresh]);

  return (
    <EntitlementContext.Provider value={{
      ...entitlement,
      isLoading,
      error,
      refresh,
      checkBoxLocked: (noteCount) => entitlement.plan === 'free' && noteCount >= entitlement.limits.maxNotesPerBox,
    }}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlements() {
  const context = useContext(EntitlementContext);
  if (!context) throw new Error('useEntitlements must be used within an EntitlementProvider');
  return context;
}
