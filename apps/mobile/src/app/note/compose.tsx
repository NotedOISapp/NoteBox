import React, { useState } from 'react';
import { StyleSheet, TextInput, Pressable, Modal, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/context/AppContext';
import { useEntitlements } from '@/context/EntitlementContext';
import { useAutosave } from '@/hooks/use-autosave';
import { useHaptics } from '@/hooks/use-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ReceiptUploadSource } from '@/services/offline-queue';

type PendingAttachment = ReceiptUploadSource;

export default function NoteComposerScreen() {
  const router = useRouter();
  const { boxId } = useLocalSearchParams<{ boxId?: string }>();
  const theme = useTheme();
  const { boxes, people, addNote, notes, addPerson, queueReceiptUploads } = useApp();
  const { plan, limits } = useEntitlements();
  const { triggerHaptic } = useHaptics();

  // Load state
  const [selectedBoxId, setSelectedBoxId] = useState(boxId || boxes[0]?.id || '1');
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [showBoxPicker, setShowBoxPicker] = useState(false);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  // Autosave draft setup
  const { draftText, setDraftText, isSaving, discardDraft, forceSave } = useAutosave(`box_${selectedBoxId}`, '');

  const selectedBox = boxes.find(b => b.id === selectedBoxId) || boxes[0];
  const selectedBoxNotesCount = notes.filter(n => n.boxId === selectedBoxId).length;

  const handleSave = async () => {
    if (!draftText.trim()) {
      Alert.alert('Empty Note', 'Please enter some text before saving.');
      return;
    }

    // Check free plan limits
    if (plan === 'free' && selectedBoxNotesCount >= limits.maxNotesPerBox) {
      // Disabled warning haptic on locked box modal
      setShowLockedModal(true);
      return;
    }

    // Heads up warning for 4th note
    if (plan === 'free' && selectedBoxNotesCount === 4) {
      Alert.alert(
        'One More Note',
        'One more note can be added to this Box on the free plan. You will still be able to read everything.',
        [
          {
            text: 'Save Note',
            onPress: () => performSave(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          }
        ]
      );
      return;
    }

    performSave();
  };

  const addAttachment = (attachment: PendingAttachment) => {
    const maxAttachments = plan === 'free' ? 3 : 10;
    setAttachments((current) => {
      if (current.length >= maxAttachments) {
        Alert.alert('Receipt limit reached', `This plan allows up to ${maxAttachments} Receipts on one Note.`);
        return current;
      }
      return [...current, attachment];
    });
  };

  const pickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos access needed', 'Allow Photos access to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled) {
      const asset = result.assets[0];
      addAttachment({
        uri: asset.uri,
        fileName: asset.fileName || 'screenshot.jpg',
        contentType: asset.mimeType || 'image/jpeg',
        attachmentKind: 'screenshot',
      });
      triggerHaptic('micro');
    }
  };

  const pickReceipt = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      addAttachment({
        uri: asset.uri,
        fileName: asset.name,
        contentType: asset.mimeType || 'application/octet-stream',
        attachmentKind: 'receipt',
      });
      triggerHaptic('micro');
    }
  };

  const performSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const savedNoteId = await addNote(selectedBoxId, draftText, selectedPeopleIds, 0);
      let failedToQueue = 0;
      for (const attachment of attachments) {
        try {
          await queueReceiptUploads(savedNoteId, [attachment]);
        } catch {
          failedToQueue += 1;
        }
      }

      await triggerHaptic(failedToQueue === 0 ? 'success' : 'warning');
      await discardDraft();
      router.replace(`/note/${savedNoteId}`);
      if (failedToQueue > 0) {
        Alert.alert(
          'Note saved; attachment not queued',
          `${failedToQueue} selected file${failedToQueue === 1 ? '' : 's'} could not be preserved for upload. Attach ${failedToQueue === 1 ? 'it' : 'them'} again from the Note.`,
        );
      }
    } catch (error: any) {
      Alert.alert('Note not saved', error?.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePersonTag = (id: string) => {
    triggerHaptic('micro');
    if (selectedPeopleIds.includes(id)) {
      setSelectedPeopleIds(selectedPeopleIds.filter(pid => pid !== id));
    } else {
      setSelectedPeopleIds([...selectedPeopleIds, id]);
    }
  };

  const handleAddPerson = async () => {
    const name = newPersonName.trim();
    if (!name) return;

    // Check if duplicate
    const existing = people.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selectedPeopleIds.includes(existing.id)) {
        setSelectedPeopleIds([...selectedPeopleIds, existing.id]);
      }
      setNewPersonName('');
      triggerHaptic('micro');
      return;
    }

    const newId = await addPerson(name);
    setSelectedPeopleIds([...selectedPeopleIds, newId]);
    setNewPersonName('');
    triggerHaptic('success');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        {/* Header Toolbar */}
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={{ color: theme.roseGoldDark }} type="link">Cancel</ThemedText>
          </Pressable>

          <Pressable onPress={() => setShowBoxPicker(true)} style={[styles.boxSelector, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{selectedBox?.name || 'Select Box'} ▾</ThemedText>
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary">
            {isSaving ? 'Autosaving...' : 'Draft saved'}
          </ThemedText>
        </ThemedView>

        {/* Text Input Area */}
        <TextInput
          multiline
          placeholder="What happened?"
          placeholderTextColor={theme.textSecondary}
          value={draftText}
          onChangeText={setDraftText}
          style={[styles.textInput, { color: theme.text }]}
        />

        {/* Attachment and people actions */}
        <ThemedView style={styles.actionToolbar}>
          <Pressable
            onPress={pickScreenshot}
            accessibilityLabel="Choose a screenshot to attach"
            accessibilityRole="button"
            style={[styles.toolbarButton, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="small">Screenshot</ThemedText>
          </Pressable>

          <Pressable
            onPress={pickReceipt}
            accessibilityLabel="Choose a Receipt to attach"
            accessibilityRole="button"
            style={[styles.toolbarButton, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="small">Receipt</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setShowPeoplePicker(true)}
            style={[
              styles.toolbarButton,
              {
                backgroundColor: selectedPeopleIds.length > 0 ? theme.backgroundSelected + '22' : theme.backgroundElement,
                borderColor: selectedPeopleIds.length > 0 ? theme.roseGoldDark : 'transparent',
              }
            ]}
          >
            <ThemedText type="small" style={selectedPeopleIds.length > 0 && { color: theme.roseGoldDark, fontWeight: '700' }}>
              👤 Tag People ({selectedPeopleIds.length})
            </ThemedText>
          </Pressable>
        </ThemedView>

        {attachments.length > 0 && (
          <ThemedView style={styles.attachmentList}>
            {attachments.map((attachment, index) => (
              <Pressable
                key={`${attachment.uri}-${index}`}
                onPress={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                accessibilityLabel={`Remove ${attachment.fileName}`}
                accessibilityRole="button"
                style={[styles.attachmentChip, { backgroundColor: theme.backgroundSelected }]}
              >
                <ThemedText type="small" numberOfLines={1}>{attachment.fileName} · Remove</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        )}

        {/* Primary Save Action */}
        <Pressable
          onPress={handleSave}
          disabled={isSubmitting}
          style={[styles.saveCTA, { backgroundColor: theme.roseGoldDark, opacity: isSubmitting ? 0.65 : 1 }]}
        >
          <ThemedText style={styles.saveText}>{isSubmitting ? 'Saving…' : 'Save Note'}</ThemedText>
        </Pressable>

        {/* Box Picker Modal */}
        <Modal visible={showBoxPicker} transparent animationType="slide">
          <ThemedView style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText type="smallBold" style={styles.modalTitle}>Choose a Box</ThemedText>
              <FlatList
                data={boxes.filter(b => !b.isArchived)}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={async () => {
                      await forceSave();
                      setSelectedBoxId(item.id);
                      setShowBoxPicker(false);
                      triggerHaptic('micro');
                    }}
                    style={styles.pickerItem}
                  >
                    <ThemedText type="default">{item.name}</ThemedText>
                  </Pressable>
                )}
              />
              <Pressable
                onPress={() => setShowBoxPicker(false)}
                accessibilityLabel="Close box picker"
                accessibilityRole="button"
                style={styles.closeModalButton}
              >
                <ThemedText style={{ color: theme.roseGoldDark }} type="smallBold">Close</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        </Modal>

        {/* People Tag Modal */}
        <Modal visible={showPeoplePicker} transparent animationType="slide">
          <ThemedView style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.modalContent}>
              <ThemedText type="smallBold" style={styles.modalTitle}>Tag People</ThemedText>

              {/* Quick Add Person tag */}
              <ThemedView style={styles.quickAddContainer}>
                <TextInput
                  placeholder="Quick add person..."
                  placeholderTextColor={theme.textSecondary}
                  value={newPersonName}
                  onChangeText={setNewPersonName}
                  style={[styles.quickAddInput, { color: theme.text, borderColor: 'rgba(0,0,0,0.1)' }]}
                />
                <Pressable
                  onPress={handleAddPerson}
                  style={[styles.quickAddButton, { backgroundColor: theme.roseGoldDark }]}
                >
                  <ThemedText style={{ color: '#FFF' }} type="smallBold">Add</ThemedText>
                </Pressable>
              </ThemedView>

              <FlatList
                data={people}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isSelected = selectedPeopleIds.includes(item.id);
                  return (
                    <Pressable
                      onPress={() => togglePersonTag(item.id)}
                      style={[styles.pickerItem, isSelected && { backgroundColor: theme.backgroundSelected }]}
                    >
                      <ThemedText type="default">{item.name} {isSelected && '✓'}</ThemedText>
                    </Pressable>
                  );
                }}
              />
              <Pressable
                onPress={() => setShowPeoplePicker(false)}
                accessibilityLabel="Close people tag picker"
                accessibilityRole="button"
                style={styles.closeModalButton}
              >
                <ThemedText style={{ color: theme.roseGoldDark }} type="smallBold">Done</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        </Modal>

        {/* Locked Box Modal */}
        <Modal visible={showLockedModal} transparent animationType="fade">
          <ThemedView style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.lockModalContent}>
              <ThemedText type="subtitle" style={styles.lockTitle}>Box Locked</ThemedText>
              <ThemedText type="default" style={styles.lockDescription}>
                This Box is locked for new notes. You can still read everything.
              </ThemedText>

              <Pressable
                onPress={() => {
                  setShowLockedModal(false);
                  router.push('/settings');
                  triggerHaptic('micro');
                }}
                accessibilityLabel="Upgrade to keep adding notes"
                accessibilityRole="button"
                style={[styles.upgradeCTA, { backgroundColor: theme.roseGoldDark }]}
              >
                <ThemedText style={styles.upgradeText}>Upgrade to keep adding</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowLockedModal(false);
                  triggerHaptic('micro');
                }}
                accessibilityLabel="Dismiss locked box modal"
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
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  backButton: {
    minHeight: 44,
    minWidth: 60,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  boxSelector: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
    textAlignVertical: 'top',
    paddingVertical: Spacing.two,
  },
  actionToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  toolbarButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  attachmentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  attachmentChip: {
    minHeight: 44,
    maxWidth: '100%',
    justifyContent: 'center',
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
  },
  saveCTA: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    marginTop: Spacing.two,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  saveText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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
    maxHeight: 450,
    borderRadius: Spacing.four,
    padding: Spacing.four,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: Spacing.three,
    textAlign: 'center',
  },
  pickerItem: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  closeModalButton: {
    marginTop: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  lockModalContent: {
    width: '100%',
    borderRadius: Spacing.four,
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
  quickAddContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
    alignItems: 'center',
  },
  quickAddInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
  },
  quickAddButton: {
    minHeight: 44,
    minWidth: 65,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: Spacing.two,
  },
});
