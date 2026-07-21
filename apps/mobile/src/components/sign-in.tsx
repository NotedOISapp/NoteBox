import React, { useState } from 'react';
import { StyleSheet, View, Pressable, Platform, ActivityIndicator, Alert } from 'react-native';
import { ThemedText } from './themed-text';
import { useHaptics } from '@/hooks/use-haptics';
import { useApp } from '@/context/AppContext';
import { Spacing, Fonts, Palette } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { isAppleSignInAvailable, requestAppleSignIn } from '@/services/apple-auth';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/services/api';

interface SignInProps {
  onSignedIn?: () => void;
}

export default function SignInScreen({ onSignedIn }: SignInProps) {
  const { triggerHaptic } = useHaptics();
  const { login } = useApp();
  const [loading, setLoading] = useState(false);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');
  const [deletionStatus, setDeletionStatus] = useState<string | null>(null);

  React.useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  React.useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const token = await SecureStore.getItemAsync('deletion_status_token');
      if (!token || !active) return;

      try {
        const response = await api.compliance.getDeletionStatus(token);
        if (!active) return;
        setDeletionStatus(response.status);
        if (response.status === 'pending' || response.status === 'processing') {
          timer = setTimeout(() => void poll(), 5000);
        } else if (response.status === 'completed') {
          await Promise.all([
            SecureStore.deleteItemAsync('deletion_status_token'),
            SecureStore.deleteItemAsync('deletion_status_expires_at'),
          ]);
        }
      } catch (error) {
        if (!active) return;
        const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0;
        if (status === 410) {
          setDeletionStatus('status link expired');
          await Promise.all([
            SecureStore.deleteItemAsync('deletion_status_token'),
            SecureStore.deleteItemAsync('deletion_status_expires_at'),
          ]);
        } else {
          setDeletionStatus('status temporarily unavailable');
          timer = setTimeout(() => void poll(), 10000);
        }
      }
    };

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleAppleSignIn = async () => {
    triggerHaptic('micro');
    setLoading(true);
    try {
      const credential = await requestAppleSignIn();
      await login(credential);
      triggerHaptic('success');
      if (onSignedIn) onSignedIn();
    } catch (err) {
      if ((err as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
        triggerHaptic('warning');
        Alert.alert('Sign In Failed', err instanceof Error ? err.message : 'Unable to sign in with Apple. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[Palette.alabaster, '#F7ECE8', '#EBEAE4']}
      style={styles.gradientContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View entering={FadeIn.duration(650)} style={styles.content}>

          {/* Logo & Typography Header */}
          <View style={styles.logoWrapper}>
            <View style={styles.refractiveLogoRing}>
              <View style={styles.innerLogoCircle}>
                <View style={styles.logoLogoMark} />
              </View>
            </View>
            <ThemedText style={styles.wordmark}>NoteBox</ThemedText>
            <ThemedText style={styles.headline}>
              Keep the moments you do not want to lose.
            </ThemedText>
            <ThemedText style={styles.subcopy}>
              Notes, receipts, people, and context, together.
            </ThemedText>
          </View>

          {/* Action Row */}
          <View style={styles.actionBlock}>
            {deletionStatus && (
              <View style={styles.deletionStatusCard} accessibilityRole="summary">
                <ThemedText type="smallBold">Account deletion</ThemedText>
                <ThemedText type="small" style={styles.deletionStatusText}>
                  {deletionStatus === 'completed' ? 'Deletion is complete.' : `Status: ${deletionStatus}`}
                </ThemedText>
              </View>
            )}
            <Pressable
              onPressIn={() => setIsButtonPressed(true)}
              onPressOut={() => setIsButtonPressed(false)}
              onPress={handleAppleSignIn}
              disabled={loading || !appleAvailable}
              style={[
                styles.appleBtn,
                isButtonPressed ? styles.appleBtnPressed : styles.appleBtnNormal,
                (loading || !appleAvailable) && { opacity: 0.55 }
              ]}
              accessibilityLabel="Sign in with Apple"
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#FAF9F6" />
              ) : (
                <View style={styles.btnInner}>
                  <SymbolView
                    name="applelogo"
                    size={18}
                    tintColor="#FAF9F6"
                    style={{ marginRight: Spacing.two }}
                  />
                  <ThemedText style={styles.btnText}>
                    {appleAvailable ? 'Sign in with Apple' : 'Apple Sign-In Requires iOS'}
                  </ThemedText>
                </View>
              )}
            </Pressable>

            <ThemedText style={styles.disclaimerText}>
              By signing in, you agree to the Terms and Privacy Policy.
            </ThemedText>
          </View>

        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// Simple internal SafeAreaView wrapper for compatibility
function SafeAreaView({ children, style }: any) {
  return <View style={[styles.safeAreaView, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeAreaView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.five,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.six,
  },
  logoWrapper: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 64,
  },
  refractiveLogoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(229, 222, 210, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Palette.espresso,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: Spacing.two,
  },
  innerLogoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Palette.roseGoldDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLogoMark: {
    width: 22,
    height: 22,
    backgroundColor: Palette.espresso,
    borderRadius: 6,
    transform: [{ rotate: '45deg' }],
  },
  wordmark: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    fontSize: 40,
    fontWeight: 'bold',
    color: Palette.espresso,
    letterSpacing: -0.5,
    lineHeight: 46,
    paddingVertical: 4,
  },
  headline: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    fontSize: 20,
    fontWeight: 'bold',
    color: Palette.espresso,
    textAlign: 'center',
    lineHeight: 26,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  subcopy: {
    fontFamily: Fonts.sans.fontFamily,
    fontSize: 13,
    color: Palette.espresso + 'b3',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  actionBlock: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: 48,
  },
  deletionStatusCard: {
    width: '100%',
    padding: Spacing.three,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    gap: Spacing.one,
  },
  deletionStatusText: {
    textAlign: 'center',
  },
  appleBtn: {
    width: '100%',
    height: 52,
    backgroundColor: Palette.espresso,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: Palette.espresso,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  appleBtnNormal: {
    transform: [{ translateY: 0 }],
  },
  appleBtnPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: Fonts.sans.bold,
    color: '#FAF9F6',
    fontSize: 15,
  },
  disclaimerText: {
    fontFamily: Fonts.sans.fontFamily,
    fontSize: 10,
    color: Palette.espresso + '88',
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: Spacing.two,
  },
});
