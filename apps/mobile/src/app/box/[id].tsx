import React, { useEffect, useState } from 'react';
import { StyleSheet, Pressable, Modal, Alert, TextInput, View, Platform, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { api } from '@/services/api';
import { useHaptics } from '@/hooks/use-haptics';
import { PaywallModal } from '@/components/paywall';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NOTE_CARD_WIDTH = SCREEN_WIDTH * 0.72;

export default function BoxDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { boxes, categories, notes, people, archiveBox, deleteBox, renameBox } = useApp();
  const { triggerHaptic } = useHaptics();

  const [activeModal, setActiveModal] = useState<'menu' | 'rename' | 'sort' | null>(null);
  const [newBoxName, setNewBoxName] = useState('');
  const [boxEditAreaId, setBoxEditAreaId] = useState<string | undefined>(undefined);

  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showPaywall, setShowPaywall] = useState(false);

  const box = boxes.find(b => b.id === id);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !box?.id) {
      setSearchResultIds(null);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await api.search.query(query, { boxId: box.id, limit: 50 });
        if (!cancelled) {
          setSearchResultIds([...new Set(response.results.flatMap((result) => result.noteId ? [result.noteId] : []))]);
          setSearchError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchResultIds([]);
          setSearchError(typeof error === 'object' && error && 'message' in error
            ? String(error.message)
            : 'Search could not be completed.');
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [box?.id, searchQuery]);

  if (!box) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: '#F6F2EF' }]}>
        <ThemedText type="subtitle">Box not found</ThemedText>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: '#B76E79' }} type="link">Go Back</ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Box details
  const boxNotes = notes.filter(n => n.boxId === box.id);
  const boxArea = categories.find((a: any) => a.id === box.categoryId);

  // Filters & Search
  const filteredNotes = boxNotes
    .filter(n => {
      if (selectedPersonFilter && !n.peopleIds.includes(selectedPersonFilter)) return false;
      if (searchQuery.trim() !== '') return searchResultIds?.includes(n.id) ?? false;
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

  // Unique tagged people in notes
  const taggedPeopleIds = Array.from(new Set(boxNotes.flatMap(n => n.peopleIds)));
  const boxPeople = people.filter(p => taggedPeopleIds.includes(p.id));

  const handleArchive = () => {
    triggerHaptic('micro');
    archiveBox(box.id);
    setActiveModal(null);
    Alert.alert('Box Archived', `${box.name} has been archived.`);
    router.replace('/');
  };

  const handleDelete = () => {
    triggerHaptic('warning');
    Alert.alert(
      'Delete Box',
      `Delete ${box.name} permanently?`,
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteBox(box.id);
            router.replace('/');
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
    setActiveModal(null);
  };

  const handleRenameSave = () => {
    if (!newBoxName.trim()) return;
    triggerHaptic('success');
    renameBox(box.id, newBoxName.trim(), boxEditAreaId);
    setActiveModal(null);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={[styles.container, { backgroundColor: '#F6F2EF' }]}>
      <SafeAreaView style={styles.safeArea}>

        {/* Header Row */}
        <View style={styles.header}>
          <Pressable onPress={() => { triggerHaptic('tick'); router.back(); }} style={styles.backButton}>
            <SymbolView name="chevron.left" size={24} tintColor="#2E2A28" />
          </Pressable>

          <View style={styles.boxHeaderMeta}>
            <ThemedText style={styles.boxTitle}>{box.name}</ThemedText>
            {boxArea && (
              <View style={styles.areaBadge}>
                <ThemedText style={styles.areaBadgeText}>{boxArea.name}</ThemedText>
              </View>
            )}
          </View>

          <Pressable onPress={() => { triggerHaptic('micro'); setActiveModal('menu'); }} style={styles.menuTrigger}>
            <SymbolView name="ellipsis" size={20} tintColor="#2E2A28" />
          </Pressable>
        </View>

        {/* Search inside Box */}
        <View style={styles.searchContainer}>
          <SymbolView name="magnifyingglass" size={16} tintColor="#6F6763" />
          <TextInput
            placeholder="Search notes in this box..."
            placeholderTextColor="#6F6763"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>
        {searchError && (
          <ThemedText type="small" style={{ color: '#B76E79' }}>{searchError}</ThemedText>
        )}

        {/* People Chips filtering row */}
        {boxPeople.length > 0 && (
          <View style={styles.peopleRowContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable
                onPress={() => setSelectedPersonFilter(null)}
                style={[
                  styles.peopleChip,
                  selectedPersonFilter === null && { backgroundColor: '#B76E79' }
                ]}
              >
                <ThemedText style={[styles.peopleChipText, selectedPersonFilter === null && { color: '#FFF' }]}>
                  All
                </ThemedText>
              </Pressable>
              {boxPeople.map(person => {
                const isActive = selectedPersonFilter === person.id;
                return (
                  <Pressable
                    key={person.id}
                    onPress={() => setSelectedPersonFilter(isActive ? null : person.id)}
                    style={[
                      styles.peopleChip,
                      isActive && { backgroundColor: '#B76E79' }
                    ]}
                  >
                    <ThemedText style={[styles.peopleChipText, isActive && { color: '#FFF' }]}>
                      {person.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Notes Slider Container (Fits in viewport - Horizontal swipe cards) */}
        <View style={styles.notesContainer}>
          {filteredNotes.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyStateTitle}>Nothing in this Box yet.</ThemedText>
              <ThemedText style={styles.emptyStateSubtitle}>
                Drop the first note here when something feels worth keeping.
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              pagingEnabled={Platform.OS === 'ios'}
              snapToInterval={NOTE_CARD_WIDTH + 16}
              snapToAlignment="center"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: (SCREEN_WIDTH - NOTE_CARD_WIDTH) / 2 - 8 }}
            >
              {filteredNotes.map(note => {
                const notePeople = note.peopleIds.map(pid => people.find(p => p.id === pid)?.name).filter(Boolean);
                return (
                  <Pressable
                    key={note.id}
                    onPress={() => { triggerHaptic('micro'); router.push(`/note/${note.id}`); }}
                    style={styles.noteCard}
                  >
                    <View style={styles.noteCardTop}>
                      <ThemedText style={styles.noteCardDate}>{formatDate(note.createdAt)}</ThemedText>
                      {note.receiptsCount > 0 && (
                        <SymbolView name="paperclip" size={14} tintColor="#B76E79" />
                      )}
                    </View>
                    <ThemedText style={styles.noteCardBody} numberOfLines={6}>
                      {note.body}
                    </ThemedText>
                    <View style={styles.noteCardBottom}>
                      {notePeople.length > 0 && (
                        <ThemedText style={styles.noteCardPeople} numberOfLines={1}>
                          Tagged: {notePeople.join(', ')}
                        </ThemedText>
                      )}
                      <ThemedText style={styles.tapToViewText}>Tap to view Details →</ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Add Note Button CTA */}
        <Pressable
          onPress={() => {
            triggerHaptic('micro');
            router.push(`/note/compose?boxId=${box.id}`);
          }}
          style={({ pressed }) => [
            styles.addNoteBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
          ]}
        >
          <ThemedText style={styles.addNoteBtnText}>Add Note</ThemedText>
        </Pressable>

      </SafeAreaView>

      {/* Ellipsis Menu Modal */}
      <Modal visible={activeModal === 'menu'} transparent animationType="fade">
        <Pressable onPress={() => setActiveModal(null)} style={styles.modalBackdrop}>
          <View style={styles.menuContent}>
            <Pressable
              onPress={() => {
                setNewBoxName(box.name);
                setBoxEditAreaId(box.categoryId);
                setActiveModal('rename');
                triggerHaptic('micro');
              }}
              style={styles.menuItem}
            >
              <ThemedText style={styles.menuItemText}>✏️ Rename Box</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest');
                setActiveModal(null);
                triggerHaptic('micro');
              }}
              style={styles.menuItem}
            >
              <ThemedText style={styles.menuItemText}>
                ⇅ Sort: {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
              </ThemedText>
            </Pressable>
            <Pressable onPress={handleArchive} style={styles.menuItem}>
              <ThemedText style={styles.menuItemText}>📥 Archive Box</ThemedText>
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.menuItem}>
              <ThemedText style={[styles.menuItemText, { color: '#B76E79' }]}>🗑️ Delete Box</ThemedText>
            </Pressable>
            <Pressable onPress={() => setActiveModal(null)} style={styles.closeMenuItem}>
              <ThemedText style={styles.closeMenuItemText}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={activeModal === 'rename'} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.compactModalContent}>
            <ThemedText style={styles.compactModalTitle}>Rename Box</ThemedText>
            <TextInput
              placeholder="Enter new box name..."
              placeholderTextColor="#6F6763"
              value={newBoxName}
              onChangeText={setNewBoxName}
              style={styles.compactModalInput}
            />

            {/* Area select */}
            <ThemedText style={styles.areaSelectLabel}>Category / Area:</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
              <Pressable
                onPress={() => setBoxEditAreaId(undefined)}
                style={[styles.areaChip, boxEditAreaId === undefined && { backgroundColor: '#B76E79' }]}
              >
                <ThemedText style={[styles.areaChipText, boxEditAreaId === undefined && { color: '#FFF' }]}>
                  None
                </ThemedText>
              </Pressable>
              {categories.map((area: any) => (
                <Pressable
                  key={area.id}
                  onPress={() => setBoxEditAreaId(area.id)}
                  style={[styles.areaChip, boxEditAreaId === area.id && { backgroundColor: '#B76E79' }]}
                >
                  <ThemedText style={[styles.areaChipText, boxEditAreaId === area.id && { color: '#FFF' }]}>
                    {area.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setActiveModal(null)}
                style={styles.modalCancelBtn}
              >
                <ThemedText style={styles.modalCancelBtnText}>Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={handleRenameSave} style={styles.modalConfirmBtn}>
                <ThemedText style={styles.modalConfirmBtnText}>Save</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
    paddingBottom: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FBF8F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  boxHeaderMeta: {
    alignItems: 'center',
    gap: 4,
  },
  boxTitle: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    fontSize: 20,
    color: '#2E2A28',
  },
  areaBadge: {
    backgroundColor: '#E9C8C2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  areaBadgeText: {
    fontSize: 10,
    color: '#B76E79',
    fontWeight: 'bold',
  },
  menuTrigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FBF8F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF8F5',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Regular',
    fontSize: 14,
    color: '#2E2A28',
  },
  peopleRowContainer: {
    marginVertical: 4,
  },
  peopleChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FBF8F5',
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  peopleChipText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 12,
    color: '#2E2A28',
  },
  notesContainer: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: Spacing.four,
  },
  emptyState: {
    backgroundColor: '#FBF8F5',
    borderRadius: 24,
    padding: Spacing.five,
    alignItems: 'center',
    marginHorizontal: Spacing.four,
    gap: 8,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
  },
  emptyStateTitle: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    fontSize: 16,
    color: '#2E2A28',
  },
  emptyStateSubtitle: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Regular',
    fontSize: 12,
    color: '#6F6763',
    textAlign: 'center',
    lineHeight: 18,
  },
  noteCard: {
    width: NOTE_CARD_WIDTH,
    backgroundColor: '#FBF8F5',
    borderRadius: 24,
    padding: Spacing.four,
    marginHorizontal: 8,
    justifyContent: 'space-between',
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  noteCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteCardDate: {
    fontSize: 11,
    color: '#6F6763',
    fontWeight: 'bold',
  },
  noteCardBody: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#2E2A28',
    marginVertical: 12,
  },
  noteCardBottom: {
    gap: 6,
  },
  noteCardPeople: {
    fontSize: 11,
    color: '#6F6763',
    fontStyle: 'italic',
  },
  tapToViewText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 11,
    color: '#B76E79',
    textAlign: 'right',
  },
  addNoteBtn: {
    height: 50,
    backgroundColor: '#B76E79',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#B76E79',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addNoteBtnText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Bold',
    color: '#FFF',
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(46, 42, 40, 0.4)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: '#FBF8F5',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#D8CEC7',
  },
  menuItemText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 14,
    color: '#2E2A28',
  },
  closeMenuItem: {
    height: 44,
    backgroundColor: '#F6F2EF',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  closeMenuItemText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Bold',
    color: '#6F6763',
    fontSize: 13,
  },
  compactModalContent: {
    backgroundColor: '#FBF8F5',
    borderRadius: 24,
    padding: Spacing.four,
    marginHorizontal: Spacing.five,
    marginBottom: 'auto',
    marginTop: 'auto',
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    gap: 8,
  },
  compactModalTitle: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    fontSize: 18,
    color: '#2E2A28',
    textAlign: 'center',
    marginBottom: 8,
  },
  compactModalInput: {
    height: 44,
    backgroundColor: '#F6F2EF',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Regular',
    fontSize: 14,
    color: '#2E2A28',
    marginBottom: 12,
  },
  areaSelectLabel: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 13,
    color: '#6F6763',
    marginBottom: 4,
  },
  areaChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F6F2EF',
    marginRight: 6,
  },
  areaChipText: {
    fontSize: 11,
    color: '#6F6763',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F6F2EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Bold',
    color: '#6F6763',
    fontSize: 13,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#B76E79',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Bold',
    color: '#FFF',
    fontSize: 13,
  },
});
