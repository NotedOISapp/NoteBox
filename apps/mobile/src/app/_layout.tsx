import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { AppState, AppStateStatus, Platform, Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '../components/app-tabs';
import { ThemedText } from '@/components/themed-text';
import { AppProvider, useApp } from '@/context/AppContext';
import { EntitlementProvider } from '@/context/EntitlementContext';
import { AIConsentProvider } from '@/components/ai-consent-modal';
import OnboardingScreen from './onboarding';
import SignInScreen from '@/components/sign-in';
import AgeGateScreen from './age-gate';
import { StoreKitRecovery } from '@/components/storekit-recovery';
import {
  authenticatePrivacyLock,
  getPrivacyLockEnabled,
  type PrivacyCoverState,
  privacyCoverForActiveSession,
  privacyCoverForHiddenApp,
  revealPrivacyCoverWithoutBiometrics,
  subscribeToPanicHide,
} from '@/services/privacy-lock';

// Prevent splash screen auto hide
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Prevent crash in Dev mode on hot reload */
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);

  // Load custom fonts asynchronously
  const [fontsLoaded, fontError] = useFonts({
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_500Medium,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
    'PlayfairDisplay-Regular': PlayfairDisplay_400Regular,
    'PlayfairDisplay-Medium': PlayfairDisplay_500Medium,
    'PlayfairDisplay-SemiBold': PlayfairDisplay_600SemiBold,
    'PlayfairDisplay-Bold': PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    AsyncStorage.getItem('onboarding_completed').then((val) => {
      setIsOnboardingCompleted(val === 'true');
    });
  }, []);

  const isAsyncStorageReady = isOnboardingCompleted !== null;
  const isFontsReady = fontsLoaded || fontError;

  useEffect(() => {
    if (isAsyncStorageReady && isFontsReady) {
      SplashScreen.hideAsync().catch(() => {
        /* Prevent crash on web where native splash screen isn't used */
      });
    }
  }, [isAsyncStorageReady, isFontsReady]);

  if (!isAsyncStorageReady || !isFontsReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppProvider>
        <EntitlementProvider>
          <AIConsentProvider>
            <AnimatedSplashOverlay />
            <StoreKitRecovery />

            <PrivacyGuard>
              <RootContent
                isOnboardingCompleted={isOnboardingCompleted}
                setIsOnboardingCompleted={setIsOnboardingCompleted}
              />
            </PrivacyGuard>
          </AIConsentProvider>
        </EntitlementProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

function PrivacyGuard({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const { isAuthenticated, logout } = useApp();
  const [coverState, setCoverState] = useState<PrivacyCoverState>({
    isCovered: true,
    requiresBiometric: false,
  });
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const unlockInFlight = useRef(false);

  const authenticateAndReveal = useCallback(async () => {
    if (!isAuthenticated || unlockInFlight.current) return;
    unlockInFlight.current = true;
    setIsUnlocking(true);
    try {
      if (await authenticatePrivacyLock()) {
        setCoverState({ isCovered: false, requiresBiometric: true });
      }
    } catch {
      // Authentication service errors fail closed; private content stays covered.
    } finally {
      unlockInFlight.current = false;
      setIsUnlocking(false);
    }
  }, [isAuthenticated]);

  const reveal = useCallback(() => {
    if (coverState.requiresBiometric) {
      void authenticateAndReveal();
    } else {
      setCoverState((current) => revealPrivacyCoverWithoutBiometrics(current));
    }
  }, [authenticateAndReveal, coverState.requiresBiometric]);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeToPanicHide(() => {
      setPrivacyChecked(false);
      setCoverState((current) => privacyCoverForHiddenApp(current.requiresBiometric));
      void getPrivacyLockEnabled()
        .then((enabled) => {
          if (!mounted) return;
          setCoverState(privacyCoverForHiddenApp(enabled));
          setPrivacyChecked(true);
        })
        .catch(() => {
          // Secure-storage errors fail closed; Sign Out remains available.
        });
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setCoverState({ isCovered: false, requiresBiometric: false });
      setPrivacyChecked(false);
      return;
    }

    let mounted = true;
    void getPrivacyLockEnabled()
      .then((enabled) => {
        if (!mounted) return;
        setCoverState(privacyCoverForActiveSession(enabled));
        setPrivacyChecked(true);
        if (enabled) void authenticateAndReveal();
      })
      .catch(() => {
        // Secure-storage errors fail closed; Sign Out remains available.
      });

    let currentState = AppState.currentState;
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const returningToForeground = currentState !== 'active' && nextState === 'active';
      currentState = nextState;

      if (nextState === 'inactive' || nextState === 'background') {
        setCoverState((current) => privacyCoverForHiddenApp(current.requiresBiometric));
      } else if (returningToForeground) {
        setPrivacyChecked(false);
        try {
          const enabled = await getPrivacyLockEnabled();
          if (!mounted) return;
          setCoverState(privacyCoverForHiddenApp(enabled));
          setPrivacyChecked(true);
          if (enabled) void authenticateAndReveal();
        } catch {
          // Secure-storage errors fail closed; Sign Out remains available.
        }
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [authenticateAndReveal, isAuthenticated]);

  const shouldCoverPrivateContent = isAuthenticated && (!privacyChecked || coverState.isCovered);

  return (
    <View style={styles.guardContainer}>
      <View
        style={styles.privateContent}
        pointerEvents={shouldCoverPrivateContent ? 'none' : 'auto'}
        accessibilityElementsHidden={shouldCoverPrivateContent}
        importantForAccessibility={shouldCoverPrivateContent ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {shouldCoverPrivateContent && (
        <View style={[
          styles.overlay,
          { backgroundColor: colorScheme === 'dark' ? '#2E2A28' : '#F6F2EF' },
        ]} accessibilityViewIsModal>
          <ThemedText type="subtitle" style={styles.overlayText}>NoteBox</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Private content is hidden.</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={coverState.requiresBiometric ? 'Unlock NoteBox' : 'Reveal NoteBox'}
            disabled={isUnlocking || !privacyChecked}
            onPress={reveal}
            style={styles.unlockButton}
          >
            <ThemedText style={styles.unlockButtonText}>
              {!privacyChecked || isUnlocking
                ? 'Checking…'
                : coverState.requiresBiometric
                  ? 'Unlock'
                  : 'Reveal'}
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void logout()}>
            <ThemedText type="small" themeColor="textSecondary">Sign Out</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

interface RootContentProps {
  isOnboardingCompleted: boolean;
  setIsOnboardingCompleted: (val: boolean) => void;
}

function RootContent({ isOnboardingCompleted, setIsOnboardingCompleted }: RootContentProps) {
  const { isAuthenticated, ageAttested } = useApp();

  if (!isOnboardingCompleted) {
    return (
      <OnboardingScreen
        onCompleted={async () => {
          await AsyncStorage.setItem('onboarding_completed', 'true');
          setIsOnboardingCompleted(true);
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return <SignInScreen />;
  }

  if (!ageAttested) {
    return (
      <AgeGateScreen
        onVerified={() => {
          // Success callback
        }}
      />
    );
  }

  return <AppTabs />;
}

const styles = StyleSheet.create({
  guardContainer: {
    flex: 1,
  },
  privateContent: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  overlayText: {
    fontSize: 28,
    fontWeight: Platform.select({ web: '700', default: undefined }),
    letterSpacing: 2,
    opacity: 0.8,
  },
  unlockButton: {
    minHeight: 48,
    minWidth: 180,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B76E79',
    marginTop: 24,
    marginBottom: 12,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
