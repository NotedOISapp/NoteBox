import React, { useState, useEffect, createContext, useContext } from 'react';
import { StyleSheet, View, Pressable, Modal, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/use-haptics';
import { Spacing } from '@/constants/theme';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// ── Context ──────────────────────────────────────────────────────────────────
interface AIConsentContextType {
  isConsentGranted: boolean | null;
  showModal: boolean;
  requestAIConsent: () => Promise<boolean>;
  grantAIConsent: () => Promise<void>;
  revokeAIConsent: () => Promise<void>;
  closeModal: () => void;
}

const AIConsentContext = createContext<AIConsentContextType | undefined>(undefined);

export function AIConsentProvider({ children }: { children: React.ReactNode }) {
  const [isConsentGranted, setIsConsentGranted] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<((val: boolean) => void) | null>(null);

  const { triggerHaptic } = useHaptics();

  useEffect(() => {
    AsyncStorage.getItem('ai_consent_granted').then((val) => {
      setIsConsentGranted(val === 'true');
    });
  }, []);

  const requestAIConsent = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (isConsentGranted === true) {
        resolve(true);
      } else {
        setResolvePromise(() => resolve);
        setShowModal(true);
      }
    });
  };

  const grantAIConsent = async () => {
    triggerHaptic('success');
    await AsyncStorage.setItem('ai_consent_granted', 'true');
    setIsConsentGranted(true);
    setShowModal(false);
    if (resolvePromise) resolvePromise(true);
  };

  const revokeAIConsent = async () => {
    triggerHaptic('warning');
    await AsyncStorage.setItem('ai_consent_granted', 'false');
    setIsConsentGranted(false);
    setShowModal(false);
    if (resolvePromise) resolvePromise(false);
  };

  const closeModal = () => {
    setShowModal(false);
    if (resolvePromise) resolvePromise(false);
  };

  return (
    <AIConsentContext.Provider
      value={{
        isConsentGranted,
        showModal,
        requestAIConsent,
        grantAIConsent,
        revokeAIConsent,
        closeModal,
      }}
    >
      {children}
      <AIConsentModal />
    </AIConsentContext.Provider>
  );
}

export function useAIConsent() {
  const ctx = useContext(AIConsentContext);
  if (!ctx) {
    throw new Error('useAIConsent must be used within an AIConsentProvider');
  }
  return ctx;
}

// ── Modal Component ──────────────────────────────────────────────────────────
export function AIConsentModal() {
  const { showModal, grantAIConsent, revokeAIConsent } = useAIConsent();
  const theme = useTheme();
  const { triggerHaptic } = useHaptics();

  const [expanded, setExpanded] = useState(false);

  const heightVal = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(heightVal.value, { duration: 250 }),
      opacity: withTiming(heightVal.value > 0 ? 1 : 0, { duration: 200 }),
    };
  });

  const toggleExpand = () => {
    triggerHaptic('micro');
    if (expanded) {
      heightVal.value = 0;
    } else {
      heightVal.value = 160; // Approximate height for learn more content
    }
    setExpanded(!expanded);
  };

  return (
    <Modal visible={showModal} transparent animationType="fade">
      <View style={styles.overlay}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <ThemedText style={styles.icon}>✨</ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                AI Perspectives
              </ThemedText>
            </View>

            {/* Body */}
            <ThemedText type="default" style={styles.bodyText}>
              To generate Perspectives on your Notes, NoteBox sends your Note text to a third-party AI provider. They are contractually prohibited from using your data for training.
            </ThemedText>

            {/* Expandable Learn More */}
            <Pressable onPress={toggleExpand} style={styles.expandTrigger}>
              <ThemedText type="smallBold" themeColor="roseGoldDark">
                {expanded ? 'Hide Details' : 'Learn More'}
              </ThemedText>
            </Pressable>

            <Animated.View style={[styles.expandContent, animatedStyle]}>
              <View style={styles.infoRow}>
                <ThemedText type="smallBold">What data is sent: </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  The text of your Note (names, emails, and phone numbers are redacted before sending).
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText type="smallBold">Who processes it: </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  OpenAI API (Enterprise Data Gateway)
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText type="smallBold">How long it is stored: </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Temporarily cached, deleted within 30 days.
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText type="smallBold">AI training: </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Never — your private notes are never used to train models.
                </ThemedText>
              </View>
            </Animated.View>

            {/* Action buttons */}
            <View style={styles.buttonContainer}>
              <Pressable
                onPress={grantAIConsent}
                style={[styles.button, { backgroundColor: theme.roseGoldDark }]}
              >
                <ThemedText type="smallBold" style={styles.buttonText}>
                  Allow Perspectives
                </ThemedText>
              </Pressable>

              {/* COMPLIANCE RULE: Equal visual weight, no dark patterns */}
              <Pressable
                onPress={revokeAIConsent}
                style={[
                  styles.button,
                  { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.roseGoldDark }
                ]}
              >
                <ThemedText type="smallBold" style={[styles.buttonText, { color: theme.roseGoldDark }]}>
                  Not Now
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  bodyText: {
    lineHeight: 22,
  },
  expandTrigger: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  expandContent: {
    overflow: 'hidden',
    gap: Spacing.two,
  },
  infoRow: {
    gap: Spacing.half,
  },
  buttonContainer: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  button: {
    height: 50,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44, // 44px min tap target
  },
  buttonText: {
    fontSize: 16,
    color: '#FFF',
  },
});
