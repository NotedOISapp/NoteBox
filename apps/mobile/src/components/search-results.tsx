import React from 'react';
import { StyleSheet, ScrollView, Pressable, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/use-haptics';
import { useRouter } from 'expo-router';

interface Box {
  id: string;
  name: string;
}

interface Note {
  id: string;
  boxId: string;
  body: string;
  createdAt: string;
  peopleIds: string[];
}

interface Person {
  id: string;
  name: string;
}

interface AddMoreBlock {
  id: string;
  noteId: string;
  body: string;
  createdAt: string;
}

interface SearchResultsProps {
  query: string;
  boxes: Box[];
  notes: Note[];
  people: Person[];
  addMores: Record<string, AddMoreBlock[]>;
  onResultPress?: () => void;
}

export function SearchResults({ query, boxes, notes, people, addMores, onResultPress }: SearchResultsProps) {
  const theme = useTheme();
  const { triggerHaptic } = useHaptics();
  const router = useRouter();

  if (!query.trim()) return null;

  const searchLower = query.toLowerCase().trim();

  // Filter notes that contain the query in the body, tagged people, or add-more blocks
  const matchingNotes = notes.filter((note) => {
    // 1. Check body text
    const bodyMatch = note.body.toLowerCase().includes(searchLower);

    // 2. Check tagged people names
    const taggedPeopleNames = people
      .filter((p) => note.peopleIds.includes(p.id))
      .map((p) => p.name.toLowerCase());
    const peopleMatch = taggedPeopleNames.some((name) => name.includes(searchLower));

    // 3. Check add-more blocks
    const noteAddMores = addMores[note.id] || [];
    const addMoresMatch = noteAddMores.some((am) => am.body.toLowerCase().includes(searchLower));

    return bodyMatch || peopleMatch || addMoresMatch;
  });

  // Group notes by Box ID
  const groupedResults: Record<string, { boxName: string; notes: Note[] }> = {};

  matchingNotes.forEach((note) => {
    const box = boxes.find((b) => b.id === note.boxId);
    if (!box) return;

    if (!groupedResults[note.boxId]) {
      groupedResults[note.boxId] = {
        boxName: box.name,
        notes: [],
      };
    }
    groupedResults[note.boxId].notes.push(note);
  });

  const handleNotePress = (noteId: string) => {
    triggerHaptic('micro');
    if (onResultPress) onResultPress();
    router.push(`/note/${noteId}`);
  };

  /**
   * Extracts a snippet of text around the matched query and highlights it
   */
  const renderSnippet = (note: Note) => {
    // Check main body first
    let idx = note.body.toLowerCase().indexOf(searchLower);
    let matchedText = note.body;
    let matchPrefix = '';

    if (idx === -1) {
      // Check add-mores if body didn't match
      const noteAddMores = addMores[note.id] || [];
      const matchedAM = noteAddMores.find((am) => am.body.toLowerCase().includes(searchLower));
      if (matchedAM) {
        idx = matchedAM.body.toLowerCase().indexOf(searchLower);
        matchedText = matchedAM.body;
        matchPrefix = '[Add More Context] ';
      } else {
        // Fallback: check tagged people match
        const taggedPeople = people.filter((p) => note.peopleIds.includes(p.id));
        const matchedPerson = taggedPeople.find((p) => p.name.toLowerCase().includes(searchLower));
        if (matchedPerson) {
          return (
            <ThemedText type="small" themeColor="textSecondary" style={styles.snippetText}>
              👤 Tagged: <ThemedText type="smallBold" style={{ color: theme.roseGoldDark }}>{matchedPerson.name}</ThemedText> in note.
            </ThemedText>
          );
        }
        return <ThemedText type="small" themeColor="textSecondary">{note.body.substring(0, 75)}...</ThemedText>;
      }
    }

    const start = Math.max(0, idx - 30);
    const end = Math.min(matchedText.length, idx + query.length + 30);

    const prefix = (start > 0 ? '...' : '') + matchedText.substring(start, idx);
    const match = matchedText.substring(idx, idx + query.length);
    const suffix = matchedText.substring(idx + query.length, end) + (end < matchedText.length ? '...' : '');

    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.snippetText}>
        {matchPrefix && <ThemedText type="smallBold" themeColor="textSecondary">{matchPrefix}</ThemedText>}
        {prefix}
        <ThemedText type="smallBold" style={{ color: theme.roseGoldDark, backgroundColor: theme.backgroundSelected + '44' }}>
          {match}
        </ThemedText>
        {suffix}
      </ThemedText>
    );
  };

  const hasResults = Object.keys(groupedResults).length > 0;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.header}>
        {"SEARCH RESULTS FOR \"" + query.toUpperCase() + "\""}
      </ThemedText>

      {!hasResults ? (
        <ThemedView type="backgroundElement" style={styles.emptyCard}>
          <ThemedText type="default">{"No notes found matching \"" + query + "\""}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Check spelling or search for box names instead.
          </ThemedText>
        </ThemedView>
      ) : (
        Object.entries(groupedResults).map(([boxId, group]) => (
          <View key={boxId} style={styles.groupContainer}>
            {/* Box Header */}
            <ThemedView type="backgroundElement" style={styles.boxHeader}>
              <ThemedText type="smallBold" themeColor="roseGoldDark">
                📦 Box: {group.boxName}
              </ThemedText>
            </ThemedView>

            {/* Matching Notes list */}
            <View style={styles.notesList}>
              {group.notes.map((note) => (
                <Pressable
                  key={note.id}
                  onPress={() => handleNotePress(note.id)}
                  style={({ pressed }) => [
                    styles.noteResultRow,
                    { backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.rowHeader}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </ThemedText>
                  </View>
                  {renderSnippet(note)}
                </Pressable>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Spacing.two,
  },
  header: {
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: Spacing.three,
    paddingLeft: Spacing.one,
  },
  emptyCard: {
    padding: Spacing.five,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  groupContainer: {
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  boxHeader: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  notesList: {
    gap: Spacing.two,
  },
  noteResultRow: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 3,
    elevation: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  snippetText: {
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.8,
  },
});
