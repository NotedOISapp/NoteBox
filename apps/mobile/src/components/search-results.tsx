import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useTheme } from '@/hooks/use-theme';
import { SearchMatch } from '@/services/api';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface SearchResultsProps {
  query: string;
  results: SearchMatch[];
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

function plainSnippet(snippet: string): string {
  return snippet.replace(/<\/?mark>/g, '');
}

export function SearchResults({ query, results, isLoading, error, onRetry }: SearchResultsProps) {
  const theme = useTheme();
  const { triggerHaptic } = useHaptics();
  const router = useRouter();

  if (!query.trim()) return null;

  const grouped = results.reduce<Record<string, { boxName: string; matches: SearchMatch[] }>>((all, match) => {
    all[match.boxId] ??= { boxName: match.boxName, matches: [] };
    all[match.boxId].matches.push(match);
    return all;
  }, {});

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.header}>
        Results for “{query}”
      </ThemedText>

      {isLoading ? (
        <ActivityIndicator color={theme.roseGoldDark} accessibilityLabel="Searching" />
      ) : error ? (
        <ThemedView type="backgroundElement" style={styles.emptyCard}>
          <ThemedText type="default">Search unavailable</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{error}</ThemedText>
          {onRetry && (
            <Pressable accessibilityRole="button" onPress={onRetry}>
              <ThemedText type="smallBold" style={{ color: theme.roseGoldDark }}>Try Again</ThemedText>
            </Pressable>
          )}
        </ThemedView>
      ) : results.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.emptyCard}>
          <ThemedText type="default">No matching Notes</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            Search checks Box names, Note text, Add More context, People mentions, and extracted Receipt text.
          </ThemedText>
        </ThemedView>
      ) : Object.entries(grouped).map(([boxId, group]) => (
        <View key={boxId} style={styles.groupContainer}>
          <ThemedView type="backgroundElement" style={styles.boxHeader}>
            <ThemedText type="smallBold" themeColor="roseGoldDark">{group.boxName}</ThemedText>
          </ThemedView>
          <View style={styles.notesList}>
            {group.matches.map((match) => (
              <Pressable
                key={`${match.noteId ?? match.boxId}-${match.matchType}`}
                accessibilityRole="button"
                accessibilityLabel={`Open matching Note in ${group.boxName}`}
                onPress={() => {
                  triggerHaptic('micro');
                  router.push(match.resultType === 'box' || !match.noteId ? `/box/${match.boxId}` : `/note/${match.noteId}`);
                }}
                style={({ pressed }) => [
                  styles.noteResultRow,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowHeader}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {new Date(match.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {match.matchType === 'box_title' ? 'Box' : match.matchType === 'add_more' ? 'Add More' : match.matchType === 'ocr_text' ? 'Receipt text' : 'Note'}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.snippetText}>
                  {plainSnippet(match.snippet)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Spacing.two },
  header: { fontSize: 11, letterSpacing: 1, marginBottom: Spacing.three, paddingLeft: Spacing.one },
  emptyCard: { padding: Spacing.five, borderRadius: Spacing.four, alignItems: 'center', gap: Spacing.two, marginTop: Spacing.four },
  centerText: { textAlign: 'center' },
  groupContainer: { marginBottom: Spacing.four, gap: Spacing.two },
  boxHeader: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: 12, alignSelf: 'flex-start' },
  notesList: { gap: Spacing.two },
  noteResultRow: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one, minHeight: 54 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  snippetText: { lineHeight: 18 },
  pressed: { opacity: 0.8 },
});
