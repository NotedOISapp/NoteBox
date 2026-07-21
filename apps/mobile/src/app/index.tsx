import React, { useState } from 'react';
import { StyleSheet, ScrollView, TextInput, Pressable, Platform, View, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SymbolView } from 'expo-symbols';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/context/AppContext';
import { useHaptics } from '@/hooks/use-haptics';
import { useEntitlements } from '@/context/EntitlementContext';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { boxes, notes, people, addBox } = useApp();
  const { triggerHaptic } = useHaptics();
  const { plan } = useEntitlements();
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');

  // Track selected box in carousel (defaults to the first active box)
  const activeBoxes = boxes.filter(b => !b.isArchived);
  const [selectedBoxId, setSelectedBoxId] = useState(activeBoxes[0]?.id || '');

  const handleBoxSelect = (id: string) => {
    triggerHaptic('tick');
    setSelectedBoxId(id);
  };

  const handleNewBoxPress = () => {
    triggerHaptic('micro');
    const activeCount = boxes.filter(b => !b.isArchived).length;
    if (plan === 'free' && activeCount >= 5) {
      setShowLimitModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  const handleCreateBox = () => {
    const name = newBoxName.trim();
    if (!name) return;

    addBox(name);
    const newId = String(boxes.length + 1);
    setSelectedBoxId(newId);
    setNewBoxName('');
    setShowCreateModal(false);
    triggerHaptic('success');
  };

  const CARD_WIDTH = 160;
  const GAP_WIDTH = 16; // Spacing.three
  const INTERVAL = CARD_WIDTH + GAP_WIDTH; // 176

  const handleScroll = (event: any) => {
    const xOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(xOffset / INTERVAL);
    if (index >= 0 && index < filteredBoxes.length) {
      const targetBox = filteredBoxes[index];
      if (targetBox && targetBox.id !== selectedBoxId) {
        setSelectedBoxId(targetBox.id);
        triggerHaptic('tick');
      }
    }
  };

  // Filter boxes & notes based on search query
  const searchLower = searchQuery.toLowerCase();

  // People matching search query
  const matchingPeopleIds = people
    .filter(p => p.name.toLowerCase().includes(searchLower))
    .map(p => p.id);

  const filteredBoxes = activeBoxes.filter(box => {
    if (!searchQuery) return true;

    // Check box name matches
    const nameMatches = box.name.toLowerCase().includes(searchLower);

    // Check if notes in this box match query or tagged people match query
    const hasMatchingNote = notes.some(note =>
      note.boxId === box.id && (
        note.body.toLowerCase().includes(searchLower) ||
        note.peopleIds.some(pid => matchingPeopleIds.includes(pid))
      )
    );

    return nameMatches || hasMatchingNote;
  });

  // Recent notes from the selected box, filtered by search query if present
  const recentNotes = notes
    .filter(n => n.boxId === selectedBoxId)
    .filter(note => {
      if (!searchQuery) return true;
      return note.body.toLowerCase().includes(searchLower) ||
        note.peopleIds.some(pid => matchingPeopleIds.includes(pid));
    });

  // Helper to format date
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const showCarousel = filteredBoxes.length > 0 || !searchQuery;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        {/* Search Bar */}
        <ThemedView type="backgroundElement" style={styles.searchContainer}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' } as any}
            size={18}
            tintColor={theme.textSecondary}
            style={{ marginRight: Spacing.two }}
          />
          <TextInput
            placeholder="Search your Boxes"
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text && filteredBoxes.length > 0) {
                setSelectedBoxId(filteredBoxes[0].id);
              }
            }}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </ThemedView>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.contentScroll}>
          {/* Horizontal Carousel */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
              My Boxes
            </ThemedText>
            {!showCarousel ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                No matching boxes found.
              </ThemedText>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carousel}
                snapToInterval={INTERVAL}
                decelerationRate="fast"
                snapToAlignment="start"
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                {filteredBoxes.map((box) => {
                  const isSelected = box.id === selectedBoxId;
                  const boxNotesCount = notes.filter(n => n.boxId === box.id).length;
                  return (
                    <View key={box.id} style={{ alignItems: 'center', width: CARD_WIDTH }}>
                      <Pressable
                        onPress={() => handleBoxSelect(box.id)}
                        onLongPress={() => {
                          triggerHaptic('micro');
                          router.push(`/box/${box.id}`);
                        }}
                        style={({ pressed }) => [
                          styles.boxCard,
                          {
                            backgroundColor: isSelected ? theme.backgroundSelected + '22' : theme.backgroundElement,
                            borderColor: isSelected ? theme.roseGoldDark : 'transparent',
                            borderWidth: 1.5,
                          },
                          pressed && styles.pressed
                        ]}
                      >
                        <ThemedText type="smallBold" style={[styles.boxTitle, isSelected && { color: theme.roseGoldDark, fontWeight: '700' }]}>
                          {box.name}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.boxMeta}>
                          {boxNotesCount} {boxNotesCount === 1 ? 'note' : 'notes'}
                        </ThemedText>
                      </Pressable>
                      <View style={styles.activeDotContainer}>
                        {isSelected && (
                          <View style={[styles.activeDot, { backgroundColor: theme.roseGoldDark }]} />
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* + New Box Card */}
                <View style={{ alignItems: 'center', width: CARD_WIDTH }}>
                  <Pressable
                    onPress={handleNewBoxPress}
                    accessibilityLabel="Create new box"
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.boxCard,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.roseGoldDark,
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: Spacing.one,
                      },
                      pressed && styles.pressed
                    ]}
                  >
                    <ThemedText style={{ color: theme.roseGoldDark, fontSize: 24, fontWeight: '700' }}>+</ThemedText>
                    <ThemedText style={{ color: theme.roseGoldDark }} type="smallBold">New Box</ThemedText>
                  </Pressable>
                  <View style={styles.activeDotContainer} />
                </View>
              </ScrollView>
            )}
          </ThemedView>

          {/* Recent Notes Section */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
              Recent Notes
            </ThemedText>
            {selectedBoxId === '' ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                Select a box above to view notes.
              </ThemedText>
            ) : recentNotes.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyBoxNotes}>
                <ThemedText type="small" themeColor="textSecondary">
                  {searchQuery ? "No matching notes in this Box." : "Nothing in this Box yet."}
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedView style={styles.notesList}>
                {recentNotes.map((note) => (
                  <Pressable
                    key={note.id}
                    onPress={() => {
                      triggerHaptic('micro');
                      router.push(`/note/${note.id}`);
                    }}
                    style={({ pressed }) => [
                      styles.noteRow,
                      { backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed
                    ]}
                  >
                    <ThemedView style={styles.noteRowHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.one }}>
                        <ThemedText type="smallBold">
                          {boxes.find(b => b.id === note.boxId)?.name || 'Box'}
                        </ThemedText>
                        {note.receiptsCount > 0 && (
                          <SymbolView
                            name={{ ios: 'paperclip', android: 'paperclip', web: 'paperclip' } as any}
                            size={14}
                            tintColor={theme.textSecondary}
                            accessibilityLabel="Note has receipts attached"
                          />
                        )}
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatDate(note.createdAt)}
                      </ThemedText>
                    </ThemedView>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={3} style={styles.noteBodyText}>
                      {note.body}
                    </ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
            )}
          </ThemedView>
        </ScrollView>

        {/* Floating Add Note Action */}
        <Pressable
          onPress={() => {
            triggerHaptic('micro');
            router.push(`/note/compose?boxId=${selectedBoxId}`);
          }}
          accessibilityLabel="Compose new note"
          accessibilityRole="button"
          style={[styles.floatingAction, { backgroundColor: theme.roseGoldDark }]}
        >
          <ThemedText style={styles.fabText}>+</ThemedText>
        </Pressable>

        {/* Create Box Modal */}
        <Modal visible={showCreateModal} transparent animationType="slide">
          <ThemedView style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText type="smallBold" style={styles.modalTitle}>Create New Box</ThemedText>

              <TextInput
                placeholder="Enter box name"
                placeholderTextColor={theme.textSecondary}
                value={newBoxName}
                onChangeText={setNewBoxName}
                style={[
                  styles.modalTextInput,
                  {
                    color: theme.text,
                    borderColor: theme.textSecondary + '33',
                  }
                ]}
                accessibilityLabel="Box name input field"
              />

              <ThemedView style={styles.modalButtons}>
                <Pressable
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewBoxName('');
                    triggerHaptic('micro');
                  }}
                  accessibilityLabel="Cancel box creation"
                  accessibilityRole="button"
                  style={styles.modalButtonSecondary}
                >
                  <ThemedText type="smallBold">Cancel</ThemedText>
                </Pressable>

                <Pressable
                  onPress={handleCreateBox}
                  accessibilityLabel="Create box"
                  accessibilityRole="button"
                  style={[styles.modalButtonPrimary, { backgroundColor: theme.roseGoldDark }]}
                >
                  <ThemedText style={{ color: '#FFF' }} type="smallBold">Create</ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        </Modal>

        {/* Box Limit Reached Modal */}
        <Modal visible={showLimitModal} transparent animationType="fade">
          <ThemedView style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.lockModalContent}>
              <ThemedText type="subtitle" style={styles.lockTitle}>Box Limit Reached</ThemedText>
              <ThemedText type="default" style={styles.lockDescription}>
                You have reached the maximum limit of 5 active boxes on the free plan. Upgrade in Settings to create unlimited boxes.
              </ThemedText>

              <Pressable
                onPress={() => {
                  setShowLimitModal(false);
                  router.push('/settings');
                  triggerHaptic('micro');
                }}
                accessibilityLabel="Upgrade to create unlimited boxes"
                accessibilityRole="button"
                style={[styles.upgradeCTA, { backgroundColor: theme.roseGoldDark }]}
              >
                <ThemedText style={styles.upgradeText}>Upgrade in Settings</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowLimitModal(false);
                  triggerHaptic('micro');
                }}
                accessibilityLabel="Dismiss limit modal"
                accessibilityRole="button"
                style={styles.notNowButton}
              >
                <ThemedText themeColor="textSecondary" type="smallBold">Not now</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        </Modal>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset + Spacing.three,
    paddingTop: Spacing.four,
    position: 'relative',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    minHeight: 48,
    borderRadius: 24,
    marginBottom: Spacing.four,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  contentScroll: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.five,
  },
  sectionHeader: {
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: Spacing.three,
  },
  carousel: {
    gap: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  boxCard: {
    width: 160,
    height: 110,
    padding: Spacing.three,
    borderRadius: 24,
    justifyContent: 'space-between',
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  boxTitle: {
    fontSize: 16,
  },
  boxMeta: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.8,
  },
  notesList: {
    gap: Spacing.three,
  },
  noteRow: {
    padding: Spacing.four,
    borderRadius: 24,
    gap: Spacing.two,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  noteRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteBodyText: {
    lineHeight: 20,
  },
  emptyText: {
    paddingLeft: Spacing.one,
  },
  emptyBoxNotes: {
    padding: Spacing.four,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  floatingAction: {
    position: 'absolute',
    bottom: Spacing.four,
    right: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B76E79',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 999,
  },
  fabText: {
    color: '#FFF',
    fontSize: 32,
    lineHeight: Platform.OS === 'ios' ? 32 : 36,
    fontWeight: '400',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.five,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: Spacing.four,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: Spacing.three,
    textAlign: 'center',
    fontWeight: '700',
  },
  modalTextInput: {
    minHeight: 44,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  modalButtonPrimary: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 30,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  modalButtonSecondary: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 30,
  },
  lockModalContent: {
    width: '100%',
    borderRadius: 24,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  lockDescription: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
  upgradeCTA: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
  notNowButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  activeDotContainer: {
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
