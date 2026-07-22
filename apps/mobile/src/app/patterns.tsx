import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useEntitlements } from '@/context/EntitlementContext';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { api, PatternInsight } from '@/services/api';

export default function PatternsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { plan } = useEntitlements();
  const { triggerHaptic } = useHaptics();
  const [patterns, setPatterns] = useState<PatternInsight[]>([]);
  const [isLoading, setIsLoading] = useState(plan !== 'free');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPatterns = useCallback(async () => {
    if (plan === 'free') {
      setPatterns([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      setPatterns(await api.patterns.list());
    } catch (error) {
      const message = typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'Patterns could not be loaded.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, [plan]);

  useEffect(() => {
    void loadPatterns();
  }, [loadPatterns]);

  const handleUpgrade = () => {
    triggerHaptic('micro');
    router.push('/profile');
  };

  const dismissPattern = (pattern: PatternInsight) => {
    Alert.alert('Dismiss Pattern?', 'This Pattern will no longer appear.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dismiss',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.patterns.dismiss(pattern.key);
            setPatterns((current) => current.filter((item) => item.key !== pattern.key));
          } catch {
            Alert.alert('Dismiss Failed', 'This Pattern could not be dismissed. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle" style={styles.title}>Patterns</ThemedText>
          <ThemedText style={styles.subheadline} themeColor="textSecondary">
            I noticed something.
          </ThemedText>
        </ThemedView>

        {plan === 'free' ? (
          <ThemedView type="backgroundElement" style={styles.lockedCard}>
            <ThemedText type="smallBold" style={{ color: theme.roseGoldDark }}>
              Premium Pattern Insights
            </ThemedText>
            <ThemedText type="default" style={styles.lockedDescription}>
              Unlock server-verified Pattern insights across your saved Notes, with exact supporting snippets.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={handleUpgrade}
              style={[styles.primaryButton, { backgroundColor: theme.roseGoldDark }]}
            >
              <ThemedText style={styles.primaryButtonText}>Upgrade to Unlock</ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <ThemedView style={styles.patternsContainer}>
            {isLoading ? (
              <ThemedView type="backgroundElement" style={styles.patternCard}>
                <ActivityIndicator color={theme.roseGoldDark} accessibilityLabel="Loading Patterns" />
              </ThemedView>
            ) : loadError ? (
              <ThemedView type="backgroundElement" style={styles.patternCard}>
                <ThemedText type="smallBold" style={styles.patternTitle}>Patterns unavailable</ThemedText>
                <ThemedText type="default" style={styles.patternDescription}>{loadError}</ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadPatterns()}
                  style={[styles.primaryButton, { backgroundColor: theme.roseGoldDark }]}
                >
                  <ThemedText style={styles.primaryButtonText}>Try Again</ThemedText>
                </Pressable>
              </ThemedView>
            ) : patterns.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.patternCard}>
                <ThemedText type="smallBold" style={styles.patternTitle}>No Patterns yet</ThemedText>
                <ThemedText type="default" style={styles.patternDescription}>
                  Patterns appear only when your saved Notes contain repeated, matching evidence.
                </ThemedText>
              </ThemedView>
            ) : patterns.map((pattern) => (
              <ThemedView key={pattern.key} type="backgroundElement" style={styles.patternCard}>
                <ThemedText type="smallBold" style={styles.patternTitle}>{pattern.name}</ThemedText>
                <ThemedText type="default" style={styles.patternDescription}>{pattern.description}</ThemedText>
                <ThemedView style={styles.snippetsSection}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.snippetsTitle}>
                    Supporting snippets
                  </ThemedText>
                  {pattern.matches.map((match, index) => (
                    <Pressable
                      key={`${match.noteId}-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel="Open matching Note"
                      onPress={() => router.push(`/note/${match.noteId}`)}
                    >
                      <ThemedView style={styles.snippetRow}>
                        <ThemedText type="smallBold" style={styles.snippetMeta}>
                          {new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.snippetQuote}>
                          {match.quote}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  ))}
                </ThemedView>
                <Pressable accessibilityRole="button" onPress={() => dismissPattern(pattern)}>
                  <ThemedText type="small" themeColor="textSecondary">Dismiss</ThemedText>
                </Pressable>
              </ThemedView>
            ))}
          </ThemedView>
        )}
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: { flexGrow: 1, justifyContent: 'center', flexDirection: 'row' },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset + Spacing.three,
    paddingTop: Spacing.four,
  },
  header: { alignItems: 'flex-start', marginBottom: Spacing.five, gap: Spacing.one },
  title: { fontWeight: '700' },
  subheadline: { fontSize: 16, fontStyle: 'italic' },
  lockedCard: {
    padding: Spacing.five,
    borderRadius: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  lockedDescription: { textAlign: 'center', lineHeight: 22, fontSize: 15 },
  primaryButton: {
    alignSelf: 'stretch',
    paddingVertical: Spacing.three,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  primaryButtonText: { color: '#FFF', fontWeight: '600' },
  patternsContainer: { gap: Spacing.four, alignSelf: 'stretch' },
  patternCard: { padding: Spacing.four, borderRadius: Spacing.four, gap: Spacing.two },
  patternTitle: { fontSize: 18 },
  patternDescription: { fontSize: 15, lineHeight: 22, marginBottom: Spacing.two },
  snippetsSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  snippetsTitle: { fontSize: 11, textTransform: 'uppercase' },
  snippetRow: {
    gap: Spacing.one,
    paddingLeft: Spacing.two,
    borderLeftWidth: 2,
    borderLeftColor: '#E8B4B8',
  },
  snippetMeta: { fontSize: 12 },
  snippetQuote: { fontSize: 13, fontStyle: 'italic' },
});
