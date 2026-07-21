import React from 'react';
import { StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useEntitlements } from '@/context/EntitlementContext';
import { useHaptics } from '@/hooks/use-haptics';
import { useApp } from '@/context/AppContext';

export default function PatternsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { plan } = useEntitlements();
  const { triggerHaptic } = useHaptics();

  const { notes, boxes } = useApp();

  const getDynamicPatterns = () => {
    const list: any[] = [];

    // 1. Scan for Minimization pattern
    const minimizationKeywords = ['minimize', 'minimizing', 'just a joke', 'overthinking', 'exaggerating', 'no big deal', 'downplay', 'downplayed', 'fine'];
    const minimizationSnippets: any[] = [];

    notes.forEach((note: any) => {
      const bodyLower = note.body.toLowerCase();
      const matchedKeyword = minimizationKeywords.find(k => bodyLower.includes(k));
      if (matchedKeyword) {
        const boxName = boxes.find((b: any) => b.id === note.boxId)?.name || 'General';
        const sentences = note.body.split(/[.!?]/);
        const matchSentence = sentences.find((s: any) => s.toLowerCase().includes(matchedKeyword))?.trim() || note.body.substring(0, 80);

        minimizationSnippets.push({
          date: new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          box: boxName,
          quote: `"${matchSentence}..."`
        });
      }
    });

    if (minimizationSnippets.length >= 2) {
      list.push({
        id: 'dyn_p1',
        title: 'Minimization Pattern Detected',
        description: 'Occurrences identified where feedback or discomfort was categorized as overthinking or downplayed.',
        snippets: minimizationSnippets
      });
    }

    // 2. Scan for Boundary Conflicts
    const boundaryKeywords = ['yell', 'yelling', 'yelled', 'fight', 'argued', 'boundary', 'boundaries', 'crossed'];
    const boundarySnippets: any[] = [];

    notes.forEach((note: any) => {
      const bodyLower = note.body.toLowerCase();
      const matchedKeyword = boundaryKeywords.find(k => bodyLower.includes(k));
      if (matchedKeyword) {
        const boxName = boxes.find((b: any) => b.id === note.boxId)?.name || 'General';
        const sentences = note.body.split(/[.!?]/);
        const matchSentence = sentences.find((s: any) => s.toLowerCase().includes(matchedKeyword))?.trim() || note.body.substring(0, 80);

        boundarySnippets.push({
          date: new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          box: boxName,
          quote: `"${matchSentence}..."`
        });
      }
    });

    if (boundarySnippets.length >= 2) {
      list.push({
        id: 'dyn_p2',
        title: 'Boundary Conflict Detected',
        description: 'Repeated friction points identified regarding communication limits or boundary pushback.',
        snippets: boundarySnippets
      });
    }

    return list;
  };

  const patterns = getDynamicPatterns();

  const handleUpgrade = () => {
    triggerHaptic('micro');
    router.push('/settings');
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
          /* Locked State for Free Plan */
          <ThemedView type="backgroundElement" style={styles.lockedCard}>
            <ThemedText type="smallBold" style={{ color: theme.roseGoldDark }}>
              Premium Pattern Insights
            </ThemedText>
            <ThemedText type="default" style={styles.lockedDescription}>
              Unlock client-side patterns detection. NoteBox will search across your boxes to identify repeating patterns and double standards with exact quote snippets.
            </ThemedText>

            <Pressable
              onPress={handleUpgrade}
              style={[styles.upgradeCTA, { backgroundColor: theme.roseGoldDark }]}
            >
              <ThemedText style={styles.upgradeText}>Upgrade to Unlock</ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          /* Unlocked State for Trial / Paid */
          <ThemedView style={styles.patternsContainer}>
            {patterns.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.patternCard}>
                <ThemedText type="smallBold" style={styles.patternTitle}>No patterns yet</ThemedText>
                <ThemedText type="default" style={styles.patternDesc}>
                  Patterns appear only when your saved notes contain repeated, matching evidence.
                </ThemedText>
              </ThemedView>
            ) : patterns.map(p => (
              <ThemedView key={p.id} type="backgroundElement" style={styles.patternCard}>
                <ThemedText type="smallBold" style={styles.patternTitle}>{p.title}</ThemedText>
                <ThemedText type="default" style={styles.patternDesc}>{p.description}</ThemedText>

                <ThemedView style={styles.snippetsSection}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.snippetsTitle}>
                    Proof Snippets:
                  </ThemedText>
                  {p.snippets.map((s: any, idx: number) => (
                    <ThemedView key={idx} style={styles.snippetRow}>
                      <ThemedText type="smallBold" style={styles.snippetMeta}>
                        {s.box} • {s.date}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.snippetQuote}>
                        {s.quote}
                      </ThemedText>
                    </ThemedView>
                  ))}
                </ThemedView>
              </ThemedView>
            ))}
          </ThemedView>
        )}
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset + Spacing.three,
    paddingTop: Spacing.four,
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: Spacing.five,
    gap: Spacing.one,
  },
  title: {
    fontWeight: '700',
  },
  subheadline: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  lockedCard: {
    padding: Spacing.five,
    borderRadius: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'stretch',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginTop: Spacing.two,
  },
  lockedDescription: {
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 15,
  },
  upgradeCTA: {
    alignSelf: 'stretch',
    paddingVertical: Spacing.three,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: Spacing.two,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  upgradeText: {
    color: '#FFF',
    fontWeight: '600',
  },
  patternsContainer: {
    gap: Spacing.four,
    alignSelf: 'stretch',
  },
  patternCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  patternTitle: {
    fontSize: 18,
  },
  patternDesc: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
  snippetsSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  snippetsTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
  },
  snippetRow: {
    gap: Spacing.one,
    paddingLeft: Spacing.two,
    borderLeftWidth: 2,
    borderLeftColor: '#E8B4B8', // Rose Gold Light highlight
  },
  snippetMeta: {
    fontSize: 12,
  },
  snippetQuote: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
