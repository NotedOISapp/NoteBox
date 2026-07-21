import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { AppState, AppStateStatus, Platform, StyleSheet, View, useColorScheme } from 'react-native';
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

// Prevent splash screen auto hide
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Prevent crash in Dev mode on hot reload */
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [isBackgrounded, setIsBackgrounded] = useState(false);
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

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setIsBackgrounded(nextAppState === 'inactive' || nextAppState === 'background');
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
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

            <RootContent
              isOnboardingCompleted={isOnboardingCompleted}
              setIsOnboardingCompleted={setIsOnboardingCompleted}
            />

            {isBackgrounded && (
              <View style={[
                styles.overlay,
                { backgroundColor: colorScheme === 'dark' ? 'rgba(46, 42, 40, 0.85)' : 'rgba(246, 242, 239, 0.85)' }
              ]}>
                <ThemedText type="subtitle" style={styles.overlayText}>
                  NoteBox
                </ThemedText>
              </View>
            )}
          </AIConsentProvider>
        </EntitlementProvider>
      </AppProvider>
    </ThemeProvider>
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
});
