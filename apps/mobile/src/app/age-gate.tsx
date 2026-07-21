import React, { useState } from 'react';
import { StyleSheet, View, Pressable, Platform, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useHaptics } from '@/hooks/use-haptics';
import { Spacing, Fonts, Palette } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { SymbolView } from 'expo-symbols';
import Animated, { FadeIn } from 'react-native-reanimated';

interface AgeGateProps {
  onVerified: () => void;
}

export default function AgeGateScreen({ onVerified }: AgeGateProps) {
  const { triggerHaptic } = useHaptics();
  const { confirmEligibility, declineEligibility } = useApp();

  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [isDeclinePressed, setIsDeclinePressed] = useState(false);

  const handleContinue = async () => {
    if (!isChecked) {
      triggerHaptic('warning');
      return;
    }

    triggerHaptic('success');
    setLoading(true);
    try {
      await confirmEligibility();
      onVerified();
    } catch (error) {
      console.warn('Age attestation recording failed:', error);
      triggerHaptic('warning');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    triggerHaptic('warning');
    setLoading(true);
    try {
      await declineEligibility();
    } catch (error) {
      console.warn('Decline eligibility failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCheckbox = () => {
    triggerHaptic('micro');
    setIsChecked(!isChecked);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: Palette.alabaster }]}>
      <Animated.View entering={FadeIn.duration(500)} style={styles.content}>

        {/* Header Section */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>
            Before we start
          </ThemedText>
          <ThemedText style={styles.description}>
            NoteBox is designed for adults. It may contain private notes, receipts, emotionally sensitive context, and AI-generated perspectives.
          </ThemedText>
        </View>

        {/* Refractive Checkbox Section */}
        <Pressable
          onPress={toggleCheckbox}
          style={styles.checkboxRow}
          accessibilityLabel="Confirm age eligibility checkbox"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isChecked }}
        >
          <View
            style={[
              styles.checkbox,
              { borderColor: Palette.roseGoldDark },
              isChecked && { backgroundColor: Palette.roseGoldDark }
            ]}
          >
            {isChecked && (
              <SymbolView
                name="checkmark"
                size={12}
                tintColor="#FAF9F6"
              />
            )}
          </View>
          <ThemedText style={styles.checkboxLabel}>
            I confirm I am 18 or older.
          </ThemedText>
        </Pressable>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable
            onPressIn={() => isChecked && setIsButtonPressed(true)}
            onPressOut={() => isChecked && setIsButtonPressed(false)}
            onPress={handleContinue}
            disabled={!isChecked || loading}
            style={[
              styles.button,
              isChecked ? styles.buttonActive : styles.buttonInactive,
              isButtonPressed && styles.buttonPressed,
              (!isChecked || loading) && { opacity: 0.5 },
            ]}
            accessibilityLabel="Continue to app"
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#FAF9F6" />
            ) : (
              <ThemedText style={[styles.buttonText, { color: '#FAF9F6' }]}>
                Continue
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            onPressIn={() => setIsDeclinePressed(true)}
            onPressOut={() => setIsDeclinePressed(false)}
            onPress={handleDecline}
            disabled={loading}
            style={[
              styles.button,
              styles.declineButton,
              isDeclinePressed && styles.buttonPressed
            ]}
            accessibilityLabel="Decline age verification"
            accessibilityRole="button"
          >
            <ThemedText style={[styles.buttonText, { color: Palette.espresso }]}>
              Decline & Exit
            </ThemedText>
          </Pressable>

          <ThemedText style={styles.footer}>
            By continuing, you agree to the Terms and Privacy Policy.
          </ThemedText>
        </View>

      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    height: '65%',
    minHeight: 450,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    color: Palette.espresso,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 38,
  },
  description: {
    fontFamily: Fonts.sans.fontFamily,
    color: Palette.espresso + 'b3',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.two,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    marginVertical: Spacing.four,
    paddingVertical: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: {
    fontFamily: Fonts.sans.semibold,
    fontSize: 15,
    color: Palette.espresso,
    flexShrink: 1,
  },
  buttonContainer: {
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  button: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  buttonActive: {
    backgroundColor: Palette.espresso,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: Palette.espresso,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonInactive: {
    backgroundColor: Palette.oatmeal,
    borderWidth: 1,
    borderColor: '#EAE5E0',
  },
  declineButton: {
    backgroundColor: Palette.oatmeal,
    borderWidth: 1.5,
    borderColor: Palette.espresso,
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  buttonText: {
    fontFamily: Fonts.sans.bold,
    fontSize: 15,
  },
  footer: {
    fontFamily: Fonts.sans.fontFamily,
    color: Palette.espresso + '88',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    marginTop: Spacing.two,
  },
});
