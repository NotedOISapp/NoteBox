import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Pressable, TextInput, Modal, Alert, Clipboard, Share, View, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { useEntitlements } from '@/context/EntitlementContext';
import { useHaptics } from '@/hooks/use-haptics';
import { PaywallModal } from '@/components/paywall';
import * as DocumentPicker from 'expo-document-picker';
import { api, ReceiptOcrResponse, ReceiptRecord } from '@/services/api';

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { notes, boxes, addMores, perspectives, addMoreToNote, deleteNote, editNote, regeneratePerspectives, syncWithBackend } = useApp();
  const { plan } = useEntitlements();
  const { triggerHaptic } = useHaptics();

  // Detail tab state
  const [activeTab, setActiveTab] = useState<'note' | 'receipts' | 'perspectives'>('note');

  // Modals & inputs
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editText, setEditText] = useState('');

  const [showAddMoreModal, setShowAddMoreModal] = useState(false);
  const [addMoreText, setAddMoreText] = useState('');

  const [expandedPerspective, setExpandedPerspective] = useState<'Aligned' | 'Objective' | 'Unfiltered' | null>(null);
  const [selectedIntensity, setSelectedIntensity] = useState<'Mild' | 'Bold' | 'Savage'>('Bold');
  const [showPaywall, setShowPaywall] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [receiptStatus, setReceiptStatus] = useState<Record<string, ReceiptOcrResponse>>({});
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
  const [isGeneratingPerspective, setIsGeneratingPerspective] = useState(false);

  const noteId = Array.isArray(id) ? id[0] : id;
  const note = notes.find(n => n.id === noteId);

  const loadReceipts = useCallback(async () => {
    if (!noteId || noteId.startsWith('local_')) return;
    setIsLoadingReceipts(true);
    try {
      const records = await api.receipts.list(noteId);
      setReceipts(records);
    } catch (error: any) {
      Alert.alert('Receipts unavailable', error?.message || 'Please try again.');
    } finally {
      setIsLoadingReceipts(false);
    }
  }, [noteId]);

  useEffect(() => {
    if (activeTab === 'receipts') void loadReceipts();
  }, [activeTab, loadReceipts]);

  const attachReceipt = async () => {
    if (!noteId || noteId.startsWith('local_')) {
      Alert.alert('Connect to attach', 'This Note must finish syncing before a Receipt can be attached.');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      await api.receipts.upload(noteId, {
        uri: asset.uri,
        contentType: asset.mimeType || 'application/octet-stream',
      });
      await Promise.all([loadReceipts(), syncWithBackend()]);
      triggerHaptic('success');
    } catch (error: any) {
      Alert.alert('Receipt not attached', error?.message || 'Please try again.');
    }
  };

  const requestOcr = async (receiptId: string) => {
    try {
      const status = await api.receipts.requestOcr(receiptId);
      setReceiptStatus((current) => ({ ...current, [receiptId]: status }));
      if (status.status === 'processing') {
        Alert.alert('Security scan in progress', 'Text extraction can begin after this Receipt passes its security scan.');
      } else if (status.status === 'unavailable') {
        Alert.alert('Text extraction unavailable', 'No text was created. The Receipt remains attached.');
      } else if (status.status === 'blocked') {
        Alert.alert('Receipt blocked', 'This Receipt did not pass its security scan.');
      }
    } catch (error: any) {
      Alert.alert('Text not extracted', error?.message || 'Please try again.');
    }
  };

  const removeReceipt = (receiptId: string) => {
    Alert.alert('Delete Receipt', 'Delete this Receipt and any extracted text?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.receipts.delete(receiptId);
            setReceipts((current) => current.filter((receipt) => receipt.id !== receiptId));
            await syncWithBackend();
          } catch (error: any) {
            Alert.alert('Receipt not deleted', error?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  if (!note) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: '#F6F2EF' }]}>
        <ThemedText type="subtitle">Note not found</ThemedText>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: '#B76E79' }} type="link">Go Back</ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  const box = boxes.find(b => b.id === note.boxId);
  const noteAddMores = addMores[note.id] || [];
  const notePerspectives = perspectives[note.id];

  const generatePerspective = async () => {
    if (isGeneratingPerspective) return;
    setIsGeneratingPerspective(true);
    try {
      await regeneratePerspectives(note.id, selectedIntensity.toLowerCase() as 'mild' | 'bold' | 'savage');
      triggerHaptic('success');
    } catch (error: any) {
      Alert.alert('Perspective not generated', error?.message || 'Please try again.');
    } finally {
      setIsGeneratingPerspective(false);
    }
  };

  const handleAddMoreSave = () => {
    if (!addMoreText.trim()) return;
    triggerHaptic('success');
    addMoreToNote(note.id, addMoreText);
    setAddMoreText('');
    setShowAddMoreModal(false);
  };

  const handleDelete = () => {
    triggerHaptic('warning');
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this Note?',
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteNote(note.id);
            setShowMenu(false);
            router.back();
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleCopyText = () => {
    Clipboard.setString(note.body);
    triggerHaptic('success');
    setShowMenu(false);
    Alert.alert('Copied', 'Note text copied to clipboard.');
  };

  const handleExport = async () => {
    try {
      setShowMenu(false);
      await Share.share({ message: note.body });
      triggerHaptic('success');
    } catch (error) {
      console.warn('Export failed', error);
    }
  };

  const handleEditSave = () => {
    if (!editText.trim()) return;
    triggerHaptic('success');
    editNote(note.id, editText);
    setShowEditModal(false);
  };

  const handleIntensityChange = (level: 'Mild' | 'Bold' | 'Savage') => {
    triggerHaptic('micro');
    if (plan === 'free' && level !== 'Bold') {
      setShowPaywall(true);
      return;
    }
    setSelectedIntensity(level);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={[styles.container, { backgroundColor: '#F6F2EF' }]}>
      <SafeAreaView style={styles.safeArea}>

        {/* Header toolbar */}
        <View style={styles.header}>
          <Pressable onPress={() => { triggerHaptic('tick'); router.back(); }} style={styles.backButton}>
            <SymbolView name="chevron.left" size={24} tintColor="#2E2A28" />
          </Pressable>

          <View style={styles.boxChipPill}>
            <ThemedText style={styles.boxChipText}>{box?.name || 'Box'}</ThemedText>
          </View>

          <Pressable onPress={() => { triggerHaptic('micro'); setShowMenu(true); }} style={styles.menuTrigger}>
            <SymbolView name="ellipsis" size={20} tintColor="#2E2A28" />
          </Pressable>
        </View>

        {/* Dynamic Segmented Tabs (Prevent Vertical Scroll) */}
        <View style={styles.segmentedTabsRow}>
          {([
            { key: 'note', label: 'Note' },
            { key: 'receipts', label: 'Receipts' },
            { key: 'perspectives', label: 'Perspectives' }
          ] as const).map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => { triggerHaptic('tick'); setActiveTab(tab.key); }}
                style={[
                  styles.segmentTabBtn,
                  isActive && { backgroundColor: '#F6F2EF' }
                ]}
              >
                <ThemedText style={[styles.segmentTabText, isActive && { color: '#B76E79', fontWeight: '700' }]}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Tab content area (No scroll around card, but inner content can scroll if huge) */}
        <View style={styles.contentCard}>

          {activeTab === 'note' && (
            <View style={styles.tabContentInner}>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <ThemedText style={styles.noteDateHeader}>Saved on {formatDate(note.createdAt)}</ThemedText>
                <ThemedText style={styles.noteBodyText}>{note.body}</ThemedText>

                {/* Add More blocks */}
                {noteAddMores.length > 0 && (
                  <View style={styles.addMoresWrapper}>
                    <ThemedText style={styles.addMoresSectionTitle}>Context Added Later</ThemedText>
                    {noteAddMores.map(block => (
                      <View key={block.id} style={styles.addMoreBlock}>
                        <ThemedText style={styles.addMoreBlockDate}>{formatDate(block.createdAt)}</ThemedText>
                        <ThemedText style={styles.addMoreBlockBody}>{block.body}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              <Pressable
                onPress={() => { triggerHaptic('micro'); setShowAddMoreModal(true); }}
                style={styles.addMoreInlineBtn}
              >
                <ThemedText style={styles.addMoreInlineBtnText}>+ Add More Context</ThemedText>
              </Pressable>
            </View>
          )}

          {activeTab === 'receipts' && (
            <View style={styles.tabContentInner}>
              {isLoadingReceipts ? (
                <View style={styles.emptyTabInner}>
                  <ThemedText style={styles.emptyTabText}>Loading Receipts…</ThemedText>
                </View>
              ) : receipts.length === 0 ? (
                <View style={styles.emptyTabInner}>
                  <SymbolView name="paperclip" size={32} tintColor="#D8CEC7" />
                  <ThemedText style={styles.emptyTabText}>No receipts attached to this Note.</ThemedText>
                  <Pressable onPress={attachReceipt} style={styles.extractBtn}>
                    <ThemedText style={styles.extractBtnText}>Attach Receipt</ThemedText>
                  </Pressable>
                </View>
              ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }}>
                  <View style={styles.receiptSectionHeader}>
                    <ThemedText style={styles.receiptsInfoText}>Attached Receipts ({receipts.length})</ThemedText>
                    <Pressable onPress={attachReceipt} style={styles.extractBtn}>
                      <ThemedText style={styles.extractBtnText}>Add</ThemedText>
                    </Pressable>
                  </View>
                  {receipts.map((receipt) => {
                    const ocr = receiptStatus[receipt.id];
                    return (
                    <View key={receipt.id} style={styles.receiptItemRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <SymbolView name="doc.plaintext" size={20} tintColor="#6F6763" />
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.receiptName}>{receipt.contentType}</ThemedText>
                          <ThemedText style={styles.receiptMeta}>
                            {(Number(receipt.sizeBytes) / 1024).toFixed(1)} KB · Scan {receipt.scanStatus}
                          </ThemedText>
                          {ocr?.status === 'ready' && (
                            <ThemedText style={styles.receiptMeta} numberOfLines={3}>{ocr.text}</ThemedText>
                          )}
                        </View>
                      </View>
                      <View style={styles.receiptActions}>
                        <Pressable onPress={() => requestOcr(receipt.id)} style={styles.extractBtn}>
                          <ThemedText style={styles.extractBtnText}>
                            {ocr?.status === 'ready' ? 'Refresh text' : 'Extract text'}
                          </ThemedText>
                        </Pressable>
                        <Pressable onPress={() => removeReceipt(receipt.id)} style={styles.deleteReceiptBtn}>
                          <ThemedText style={styles.deleteReceiptText}>Delete</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {activeTab === 'perspectives' && (
            <View style={styles.tabContentInner}>
              {!notePerspectives ? (
                <View style={styles.emptyTabInner}>
                  <ThemedText style={styles.emptyTabText}>No Perspective has been generated for this Note.</ThemedText>
                  <Pressable disabled={isGeneratingPerspective} onPress={() => void generatePerspective()} style={styles.regenBtn}>
                    <ThemedText style={styles.regenBtnText}>
                      {isGeneratingPerspective ? 'Generating…' : 'Generate Perspective'}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
                {/* Aligned card */}
                <Pressable
                  onPress={() => { triggerHaptic('micro'); setExpandedPerspective('Aligned'); }}
                  style={styles.perspectiveRowCard}
                >
                  <View style={styles.perspectiveRowHeader}>
                    <SymbolView name="heart.fill" size={14} tintColor="#B76E79" />
                    <ThemedText style={styles.perspectiveRowTitle}>Aligned</ThemedText>
                  </View>
                  <ThemedText style={styles.perspectiveRowPreview} numberOfLines={2}>
                    {notePerspectives.aligned}
                  </ThemedText>
                </Pressable>

                {/* Objective card */}
                <Pressable
                  onPress={() => { triggerHaptic('micro'); setExpandedPerspective('Objective'); }}
                  style={styles.perspectiveRowCard}
                >
                  <View style={styles.perspectiveRowHeader}>
                    <SymbolView name="scalemass.fill" size={14} tintColor="#6F6763" />
                    <ThemedText style={styles.perspectiveRowTitle}>Objective</ThemedText>
                  </View>
                  <ThemedText style={styles.perspectiveRowPreview} numberOfLines={2}>
                    {notePerspectives.objective}
                  </ThemedText>
                </Pressable>

                {/* Unfiltered card */}
                <Pressable
                  onPress={() => { triggerHaptic('micro'); setExpandedPerspective('Unfiltered'); }}
                  style={styles.perspectiveRowCard}
                >
                  <View style={styles.perspectiveRowHeader}>
                    <SymbolView name="bolt.fill" size={14} tintColor="#B76E79" />
                    <ThemedText style={styles.perspectiveRowTitle}>Unfiltered</ThemedText>
                  </View>
                  <ThemedText style={styles.perspectiveRowPreview} numberOfLines={2}>
                    {notePerspectives.unfiltered}
                  </ThemedText>
                </Pressable>
              </ScrollView>
              )}
            </View>
          )}

        </View>

      </SafeAreaView>

      {/* Note Option Ellipsis Menu */}
      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable onPress={() => setShowMenu(false)} style={styles.modalBackdrop}>
          <View style={styles.menuContent}>
            <Pressable
              onPress={() => {
                setEditText(note.body);
                setShowMenu(false);
                setShowEditModal(true);
                triggerHaptic('micro');
              }}
              style={styles.menuItem}
            >
              <ThemedText style={styles.menuItemText}>✏️ Edit Entry</ThemedText>
            </Pressable>
            <Pressable onPress={handleCopyText} style={styles.menuItem}>
              <ThemedText style={styles.menuItemText}>📋 Copy Text</ThemedText>
            </Pressable>
            <Pressable onPress={handleExport} style={styles.menuItem}>
              <ThemedText style={styles.menuItemText}>📤 Export / Share</ThemedText>
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.menuItem}>
              <ThemedText style={[styles.menuItemText, { color: '#B76E79' }]}>🗑️ Delete Entry</ThemedText>
            </Pressable>
            <Pressable onPress={() => setShowMenu(false)} style={styles.closeMenuItem}>
              <ThemedText style={styles.closeMenuItemText}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Entry Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.compactModalContent}>
            <ThemedText style={styles.compactModalTitle}>Edit Note</ThemedText>
            <TextInput
              multiline
              value={editText}
              onChangeText={setEditText}
              style={[styles.compactModalInput, { height: 120, textAlignVertical: 'top' }]}
            />
            <View style={styles.modalButtonsRow}>
              <Pressable onPress={() => setShowEditModal(false)} style={styles.modalCancelBtn}>
                <ThemedText style={styles.modalCancelBtnText}>Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={handleEditSave} style={styles.modalConfirmBtn}>
                <ThemedText style={styles.modalConfirmBtnText}>Save</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add More Modal */}
      <Modal visible={showAddMoreModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.compactModalContent}>
            <ThemedText style={styles.compactModalTitle}>Add More Context</ThemedText>
            <ThemedText style={styles.compactModalSubtitle}>This keeps the original note intact.</ThemedText>
            <TextInput
              multiline
              placeholder="What happened next? Add details..."
              placeholderTextColor="#6F6763"
              value={addMoreText}
              onChangeText={setAddMoreText}
              style={[styles.compactModalInput, { height: 100, textAlignVertical: 'top' }]}
            />
            <View style={styles.modalButtonsRow}>
              <Pressable onPress={() => setShowAddMoreModal(false)} style={styles.modalCancelBtn}>
                <ThemedText style={styles.modalCancelBtnText}>Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={handleAddMoreSave} style={styles.modalConfirmBtn}>
                <ThemedText style={styles.modalConfirmBtnText}>Add</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Screen 9: Perspective Expanded Modal */}
      <Modal visible={expandedPerspective !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.bottomSheetContent, { height: '80%' }]}>
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>{expandedPerspective} View</ThemedText>
              <Pressable onPress={() => setExpandedPerspective(null)} style={styles.sheetCloseBtn}>
                <SymbolView name="xmark" size={16} tintColor="#6F6763" />
              </Pressable>
            </View>
            <ThemedText style={styles.sheetSubtitle}>
              {expandedPerspective === 'Aligned' ? 'Feel understood, right now.' : expandedPerspective === 'Objective' ? 'Outside analysis.' : 'No holding back.'}
            </ThemedText>

            <ScrollView style={{ flex: 1, marginVertical: Spacing.two }} showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.expandedPerspectiveText}>
                {expandedPerspective === 'Aligned'
                  ? notePerspectives?.aligned || ''
                  : expandedPerspective === 'Objective'
                  ? notePerspectives?.objective || ''
                  : notePerspectives?.unfiltered || ''}
              </ThemedText>
            </ScrollView>

            {/* Unfiltered Intensity controls */}
            {expandedPerspective === 'Unfiltered' && (
              <View style={styles.intensityContainer}>
                <ThemedText style={styles.intensityLabel}>Intensity Level:</ThemedText>
                <View style={styles.intensityPillsRow}>
                  {([
                    { key: 'Mild', label: 'Mild' },
                    { key: 'Bold', label: 'Bold' },
                    { key: 'Savage', label: 'Savage' }
                  ] as const).map(lvl => {
                    const isSelected = selectedIntensity === lvl.key;
                    const isGated = plan === 'free' && lvl.key !== 'Bold';
                    return (
                      <Pressable
                        key={lvl.key}
                        onPress={() => handleIntensityChange(lvl.key)}
                        style={[
                          styles.intensityPill,
                          isSelected ? { backgroundColor: '#B76E79' } : { backgroundColor: '#F6F2EF' }
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <ThemedText style={[styles.intensityPillText, isSelected && { color: '#FFF' }]}>
                            {lvl.label}
                          </ThemedText>
                          {isGated && (
                            <SymbolView name="lock.fill" size={10} tintColor={isSelected ? '#FFF' : '#6F6763'} />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Regen action buttons */}
            <View style={styles.regenButtonsRow}>
              <Pressable
                onPress={() => void generatePerspective()}
                disabled={isGeneratingPerspective}
                style={styles.regenBtn}
              >
                <ThemedText style={styles.regenBtnText}>{isGeneratingPerspective ? 'Generating…' : 'Say it differently'}</ThemedText>
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
  boxChipPill: {
    backgroundColor: '#E9C8C2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  boxChipText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 13,
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
  segmentedTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FBF8F5',
    borderRadius: 20,
    padding: 4,
    marginVertical: Spacing.two,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  segmentTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 16,
  },
  segmentTabText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 13,
    color: '#6F6763',
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#FBF8F5',
    borderRadius: 24,
    padding: Spacing.four,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: Spacing.three,
  },
  tabContentInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  noteDateHeader: {
    fontSize: 11,
    color: '#6F6763',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noteBodyText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Regular',
    fontSize: 15,
    lineHeight: 23,
    color: '#2E2A28',
  },
  addMoresWrapper: {
    marginTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: '#D8CEC7',
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  addMoresSectionTitle: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-SemiBold',
    fontSize: 14,
    color: '#2E2A28',
    marginBottom: 4,
  },
  addMoreBlock: {
    backgroundColor: '#F6F2EF',
    borderRadius: 12,
    padding: 12,
  },
  addMoreBlockDate: {
    fontSize: 10,
    color: '#6F6763',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  addMoreBlockBody: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Regular',
    fontSize: 13,
    color: '#2E2A28',
    lineHeight: 18,
  },
  addMoreInlineBtn: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B76E79',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  addMoreInlineBtnText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Bold',
    color: '#B76E79',
    fontSize: 13,
  },
  emptyTabInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTabText: {
    fontSize: 12,
    color: '#6F6763',
    textAlign: 'center',
  },
  receiptsInfoText: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    fontSize: 15,
    color: '#2E2A28',
    marginBottom: 6,
  },
  receiptSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F6F2EF',
    padding: 12,
    borderRadius: 14,
  },
  receiptName: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 13,
    color: '#2E2A28',
  },
  receiptMeta: {
    fontSize: 11,
    color: '#6F6763',
    marginTop: 2,
  },
  extractBtn: {
    backgroundColor: '#B76E79',
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 22,
  },
  extractBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  receiptActions: {
    alignItems: 'stretch',
    gap: 6,
    marginLeft: 8,
  },
  deleteReceiptBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  deleteReceiptText: {
    color: '#9A3647',
    fontSize: 11,
    fontWeight: 'bold',
  },
  perspectiveRowCard: {
    backgroundColor: '#F6F2EF',
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  perspectiveRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  perspectiveRowTitle: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    fontSize: 14,
    color: '#B76E79',
  },
  perspectiveRowPreview: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#6F6763',
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
  compactModalSubtitle: {
    fontSize: 12,
    color: '#6F6763',
    textAlign: 'center',
    marginBottom: 8,
  },
  compactModalInput: {
    backgroundColor: '#F6F2EF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Regular',
    fontSize: 14,
    color: '#2E2A28',
    marginBottom: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
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
  bottomSheetContent: {
    backgroundColor: '#FBF8F5',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    fontSize: 20,
    color: '#2E2A28',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#6F6763',
    marginBottom: Spacing.three,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F6F2EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedPerspectiveText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Regular',
    fontSize: 15,
    lineHeight: 23,
    color: '#2E2A28',
  },
  intensityContainer: {
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  intensityLabel: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 13,
    color: '#6F6763',
  },
  intensityPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  intensityPill: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  intensityPillText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 12,
    color: '#2E2A28',
  },
  regenButtonsRow: {
    marginTop: Spacing.three,
  },
  regenBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2E2A28',
    justifyContent: 'center',
    alignItems: 'center',
  },
  regenBtnText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Bold',
    color: '#FFF',
    fontSize: 14,
  },
});
