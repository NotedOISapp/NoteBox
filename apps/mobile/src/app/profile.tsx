import React, { useState, useEffect } from 'react';
import { StyleSheet, Pressable, Alert, View, Platform, Switch, Linking, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useEntitlements } from '@/context/EntitlementContext';
import { useHaptics } from '@/hooks/use-haptics';
import { useApp } from '@/context/AppContext';
import { useAIConsent } from '@/components/ai-consent-modal';
import { PaywallModal } from '@/components/paywall';
import { api } from '@/services/api';
import { requestAppleReauthentication } from '@/services/apple-auth';
import {
  authenticatePrivacyLock,
  getPrivacyLockEnabled,
  setPrivacyLockEnabled,
  triggerPanicHide,
} from '@/services/privacy-lock';
import { getEncryptedItem, removeEncryptedItem, setEncryptedItem } from '@/services/secure-local-storage';
import { Directory, File, Paths } from 'expo-file-system';

const EXPORT_TICKET_KEY = 'notebox_export_ticket';
const EXPORT_DOWNLOAD_URL_KEY = 'notebox_export_download_url';

export default function ProfileScreen() {
  const router = useRouter();
  const { plan, refresh: refreshEntitlements } = useEntitlements();
  const { triggerHaptic } = useHaptics();
  const { hapticSetting, setHapticSetting, deleteAccount, logout } = useApp();
  const { isConsentGranted, grantAIConsent, revokeAIConsent } = useAIConsent();

  const [activeSection, setActiveSection] = useState<'membership' | 'privacy' | 'data'>('membership');
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);
  const [doNotSellEnabled, setDoNotSellEnabled] = useState(true);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [exportTicketId, setExportTicketId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    getPrivacyLockEnabled().then(setFaceIdEnabled);
    getEncryptedItem('notebox_do_not_sell_opt_out').then((val) => {
      if (val !== null) setDoNotSellEnabled(val === 'true');
    });
    getEncryptedItem(EXPORT_DOWNLOAD_URL_KEY).then((downloadUrl) => {
      if (downloadUrl) {
        setExportDownloadUrl(downloadUrl);
        setExportStatus('ready');
      }
    });
    getEncryptedItem(EXPORT_TICKET_KEY).then((storedTicketId) => {
      setExportTicketId((currentTicketId) => currentTicketId ?? storedTicketId);
    });
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (!exportTicketId || !active) return;
      try {
        const response = await api.compliance.getDataExportStatus(exportTicketId);
        if (!active) return;
        setExportStatus(response.status);
        if (response.status === 'ready' && response.downloadUrl) {
          setExportDownloadUrl(response.downloadUrl);
          await setEncryptedItem(EXPORT_DOWNLOAD_URL_KEY, response.downloadUrl);
        }
        if (response.status === 'pending' || response.status === 'processing') {
          timer = setTimeout(() => void poll(), 5000);
        } else if (response.status === 'failed' || response.status === 'expired') {
          setExportTicketId(null);
          setExportDownloadUrl(null);
          await Promise.all([
            removeEncryptedItem(EXPORT_TICKET_KEY),
            removeEncryptedItem(EXPORT_DOWNLOAD_URL_KEY),
          ]);
        }
      } catch {
        if (active) {
          setExportStatus('status temporarily unavailable');
          timer = setTimeout(() => void poll(), 10000);
        }
      }
    };

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [exportTicketId]);

  const handleHapticChange = (setting: 'Off' | 'Light' | 'Standard') => {
    setHapticSetting(setting);
    if (setting !== 'Off') {
      triggerHaptic(setting === 'Standard' ? 'micro' : 'tick');
    }
  };

  const toggleFaceId = async () => {
    triggerHaptic('micro');
    const nextState = !faceIdEnabled;
    if (nextState && !await authenticatePrivacyLock('Enable NoteBox Privacy Lock')) {
      Alert.alert('Security Lock Unavailable', 'Set up Face ID, Touch ID, or a device passcode before enabling the NoteBox privacy lock.');
      return;
    }
    await setPrivacyLockEnabled(nextState);
    setFaceIdEnabled(nextState);
  };

  const toggleDoNotSell = async () => {
    triggerHaptic('micro');
    const nextState = !doNotSellEnabled;
    try {
      if (nextState) {
        await api.compliance.optOut();
      } else {
        await api.compliance.updatePreferences({
          targetedAdsAllowed: true,
          saleOrShareAllowed: true,
        });
      }
      await setEncryptedItem('notebox_do_not_sell_opt_out', nextState ? 'true' : 'false');
      setDoNotSellEnabled(nextState);
      Alert.alert(
        'Privacy Update',
        nextState
          ? 'Sale, sharing, and targeted advertising are disabled for your account.'
          : 'You allowed sale, sharing, and targeted advertising for your account.',
      );
    } catch (error) {
      console.warn('Backend privacy preference update failed:', error);
      Alert.alert('Privacy update failed', 'Your existing privacy preference was not changed. Please try again.');
    }
  };

  const toggleAIConsent = async () => {
    triggerHaptic('micro');
    if (isConsentGranted) {
      await revokeAIConsent();
    } else {
      await grantAIConsent();
    }
  };

  const handleRefreshMembership = async () => {
    triggerHaptic('micro');
    try {
      await refreshEntitlements();
      Alert.alert('Membership Refreshed', 'Your access now matches the latest status verified by NoteBox.');
    } catch (error) {
      console.warn('Membership refresh failed:', error);
      Alert.alert('Refresh Failed', 'We could not verify your membership status. Your access was not changed.');
    }
  };

  const handleOpenLink = async (url: string) => {
    triggerHaptic('micro');
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      console.warn('Failed to open WebBrowser link:', err);
    }
  };

  const handleDownloadExport = async () => {
    if (!exportDownloadUrl) {
      Alert.alert('Download unavailable', 'The ZIP download location is not available yet. Refresh the archive status and try again.');
      return;
    }
    triggerHaptic('micro');
    try {
      await api.auth.reauthenticate('data_export', requestAppleReauthentication);
      const bytes = await api.compliance.downloadDataExport(exportDownloadUrl);
      if (Platform.OS === 'web') {
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = 'NoteBox-data-export.zip';
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      } else {
        const directory = new Directory(Paths.document, 'notebox-exports');
        directory.create({ intermediates: true, idempotent: true });
        const file = new File(directory, 'NoteBox-data-export.zip');
        file.create({ overwrite: true, intermediates: true });
        file.write(bytes);
        if (Platform.OS === 'ios') {
          await Share.share({ title: 'NoteBox data export', url: file.uri });
        } else {
          await Linking.openURL(file.contentUri);
        }
      }
      triggerHaptic('success');
    } catch (error: any) {
      Alert.alert('ZIP download failed', error?.message || 'The archive could not be downloaded or opened. Please try again.');
    }
  };

  const handleRequestData = () => {
    triggerHaptic('micro');
    Alert.alert(
      'Request My Data (DSAR)',
      'Under data privacy laws (CCPA/CPRA), you have the right to request a copy of your personal data.\n\nNoteBox will prepare a ZIP archive available through an authenticated download.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Export',
          onPress: async () => {
            triggerHaptic('success');
            try {
              await api.auth.reauthenticate('data_export', requestAppleReauthentication);
              const exportRequest = await api.compliance.requestDataExport();
              await Promise.all([
                setEncryptedItem(EXPORT_TICKET_KEY, exportRequest.ticketId),
                removeEncryptedItem(EXPORT_DOWNLOAD_URL_KEY),
              ]);
              setExportDownloadUrl(null);
              setExportStatus('pending');
              setExportTicketId(exportRequest.ticketId);
              Alert.alert(
                'Export Queued',
                `Your ZIP archive is being prepared. Request ID: ${exportRequest.ticketId}`
              );
            } catch (err) {
              console.warn('Data export submission failed:', err);
              Alert.alert('Export Failed', 'We could not connect to the server to package your data. Please check your network connection.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    triggerHaptic('critical');
    Alert.alert(
      'Delete NoteBox Account?',
      'Your Boxes, Notes, Receipts, Perspectives, People tags, and all associated data will be permanently deleted.\n\nThis action cannot be undone.\n\nNote: Deleting your NoteBox account does not cancel your subscription.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic('success');
            try {
              await deleteAccount();
              Alert.alert('Deletion Scheduled', 'Your deletion request was accepted. NoteBox has signed you out and retained only the status token needed to track completion.', [
                {
                  text: 'Exit',
                  onPress: () => {
                    if (Platform.OS === 'web') {
                      window.location.reload();
                    } else {
                      router.replace('/');
                    }
                  },
                },
              ]);
            } catch (err) {
              console.warn('Account deletion request failed:', err);
              Alert.alert('Deletion Failed', 'Failed to connect to the server to delete your account. Please try again later.');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    triggerHaptic('warning');
    try {
      await logout();
      Alert.alert('Signed Out', 'You have been signed out successfully.', [
        {
          text: 'OK',
          onPress: () => {
            if (Platform.OS === 'web') {
              window.location.reload();
            } else {
              router.replace('/');
            }
          }
        }
      ]);
    } catch (error) {
      Alert.alert('Cleanup Needed', error instanceof Error ? error.message : 'Some local data could not be removed.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#F6F2EF' }]}>
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => { triggerHaptic('tick'); router.back(); }} style={styles.backButton}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } as any}
              size={24}
              tintColor="#2E2A28"
            />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Profile</ThemedText>
          <View style={{ width: 44 }} />
        </View>

        {/* Section Navigation Tabs */}
        <View style={styles.tabsRow}>
          {([
            { key: 'membership', label: 'Membership' },
            { key: 'privacy', label: 'Privacy & Security' },
            { key: 'data', label: 'Data & Export' }
          ] as const).map(tab => {
            const isActive = activeSection === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => { triggerHaptic('tick'); setActiveSection(tab.key); }}
                style={[
                  styles.tabButton,
                  isActive && styles.activeTabButton
                ]}
              >
                <ThemedText
                  style={[
                    styles.tabButtonText,
                    isActive ? { color: '#B76E79', fontWeight: '700' } : { color: '#6F6763' }
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Dynamic Section Content Box (Strictly No-Scroll) */}
        <View style={styles.contentBox}>

          {activeSection === 'membership' && (
            <View style={styles.sectionInner}>
              <LinearGradient
                colors={['#B76E79', '#D98D78', '#E8B4B8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <View style={styles.membershipCard}>
                  <ThemedText style={styles.membershipLevel}>
                    {plan === 'paid' ? 'NoteBox Pro Member' : plan === 'trial' ? 'Pro Trial Access' : 'NoteBox Free'}
                  </ThemedText>
                  <ThemedText style={styles.membershipTagline}>
                    {plan === 'paid' ? 'Continuity fully unlocked.' : plan === 'trial' ? 'Test all visual perspectives and patterns.' : 'Upgrade to build patterns and edit entries.'}
                  </ThemedText>
                </View>
              </LinearGradient>

              <Pressable
                onPress={() => { triggerHaptic('micro'); setPaywallVisible(true); }}
                style={styles.upgradeCTA}
              >
                <ThemedText style={styles.upgradeCTAText}>View Premium Details</ThemedText>
              </Pressable>

              <View style={styles.subRowsContainer}>
                <Pressable onPress={handleRefreshMembership} style={styles.subRowItem}>
                  <ThemedText style={styles.subRowText}>Refresh Membership Status</ThemedText>
                  <SymbolView name="arrow.clockwise" size={14} tintColor="#6F6763" />
                </Pressable>
                <Pressable onPress={() => handleOpenLink('https://apps.apple.com/account/subscriptions')} style={styles.subRowItem}>
                  <ThemedText style={styles.subRowText}>Manage Subscriptions</ThemedText>
                  <SymbolView name="arrow.up.right" size={14} tintColor="#6F6763" />
                </Pressable>
              </View>
            </View>
          )}

          {activeSection === 'privacy' && (
            <View style={styles.sectionInner}>
              <View style={styles.rowsWrapper}>
                <View style={styles.settingsToggleRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.toggleRowTitle}>Face ID / Security Lock</ThemedText>
                    <ThemedText style={styles.toggleRowSubtitle}>Require biometric check on app return</ThemedText>
                  </View>
                  <Switch
                    value={faceIdEnabled}
                    onValueChange={toggleFaceId}
                    trackColor={{ false: '#D8CEC7', true: '#E8B4B8' }}
                    thumbColor={faceIdEnabled ? '#B76E79' : '#F6F2EF'}
                  />
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Panic Hide"
                  onPress={() => {
                    triggerHaptic('critical');
                    triggerPanicHide();
                  }}
                  style={styles.subRowItem}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.subRowText}>Panic Hide</ThemedText>
                    <ThemedText style={styles.toggleRowSubtitle}>Immediately cover all private content</ThemedText>
                  </View>
                  <SymbolView name="eye.slash.fill" size={16} tintColor="#B76E79" />
                </Pressable>

                <View style={styles.settingsToggleRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.toggleRowTitle}>AI Perspectives Analysis</ThemedText>
                    <ThemedText style={styles.toggleRowSubtitle}>Consent to secure third-party summarization</ThemedText>
                  </View>
                  <Switch
                    value={isConsentGranted ?? false}
                    onValueChange={toggleAIConsent}
                    trackColor={{ false: '#D8CEC7', true: '#E8B4B8' }}
                    thumbColor={isConsentGranted ? '#B76E79' : '#F6F2EF'}
                  />
                </View>

                <View style={styles.settingsToggleRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.toggleRowTitle}>Do Not Sell or Share (CCPA)</ThemedText>
                    <ThemedText style={styles.toggleRowSubtitle}>Opt out of analytics data sharing</ThemedText>
                  </View>
                  <Switch
                    value={doNotSellEnabled}
                    onValueChange={toggleDoNotSell}
                    trackColor={{ false: '#D8CEC7', true: '#E8B4B8' }}
                    thumbColor={doNotSellEnabled ? '#B76E79' : '#F6F2EF'}
                  />
                </View>
              </View>
            </View>
          )}

          {activeSection === 'data' && (
            <View style={styles.sectionInner}>
              <View style={styles.rowsWrapper}>
                <View style={styles.hapticControlSection}>
                  <ThemedText style={styles.toggleRowTitle}>Tactile Feedback (Haptics)</ThemedText>
                  <View style={styles.simButtonsRow}>
                    {(['Off', 'Light', 'Standard'] as const).map(mode => {
                      const isSelected = hapticSetting === mode;
                      return (
                        <Pressable
                          key={mode}
                          onPress={() => handleHapticChange(mode)}
                          style={[
                            styles.simButton,
                            isSelected ? { backgroundColor: '#B76E79' } : { backgroundColor: '#FBF8F5', borderWidth: 1, borderColor: '#D8CEC7' }
                          ]}
                        >
                          <ThemedText style={[styles.simButtonText, isSelected ? { color: '#FFF' } : { color: '#2E2A28' }]}>
                            {mode}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <Pressable onPress={handleRequestData} style={styles.subRowItem}>
                  <ThemedText style={styles.subRowText}>Request Data Archive (ZIP)</ThemedText>
                  <SymbolView name="square.and.arrow.up" size={14} tintColor="#6F6763" />
                </Pressable>

                {exportStatus && (
                  <View style={styles.settingsToggleRow} accessibilityRole="summary">
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.toggleRowTitle}>Data archive status</ThemedText>
                      <ThemedText style={styles.toggleRowSubtitle}>
                        {exportStatus === 'ready'
                          ? exportDownloadUrl
                            ? 'Your ZIP archive is ready for an authenticated download.'
                            : 'Your ZIP archive is ready, but its download location is unavailable.'
                          : exportStatus}
                      </ThemedText>
                    </View>
                    {exportStatus === 'ready' && exportDownloadUrl && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Download and open NoteBox ZIP data archive"
                        onPress={() => void handleDownloadExport()}
                        style={styles.downloadArchiveButton}
                      >
                        <ThemedText style={styles.downloadArchiveButtonText}>Download ZIP</ThemedText>
                      </Pressable>
                    )}
                  </View>
                )}

                <Pressable onPress={() => handleOpenLink('https://notebox.app/privacy')} style={styles.subRowItem}>
                  <ThemedText style={styles.subRowText}>Privacy Policy</ThemedText>
                  <SymbolView name="arrow.up.right" size={14} tintColor="#6F6763" />
                </Pressable>

                <Pressable onPress={() => handleOpenLink('https://notebox.app/terms')} style={styles.subRowItem}>
                  <ThemedText style={styles.subRowText}>Terms of Service</ThemedText>
                  <SymbolView name="arrow.up.right" size={14} tintColor="#6F6763" />
                </Pressable>

                <Pressable
                  onPress={() => Alert.alert('US Support Hotlines (National)', 'National Domestic Violence Hotline:\n1-800-799-7233\n\nCrisis Text Line:\nText HOME to 741741')}
                  style={styles.subRowItem}
                >
                  <ThemedText style={styles.subRowText}>Helpline & Support Resources</ThemedText>
                  <SymbolView name="phone.fill" size={14} tintColor="#6F6763" />
                </Pressable>

                <Pressable onPress={handleDeleteAccount} style={[styles.subRowItem, { borderBottomWidth: 0, marginTop: Spacing.two }]}>
                  <ThemedText style={[styles.subRowText, { color: '#B76E79', fontWeight: 'bold' }]}>Delete Account Permanently</ThemedText>
                  <SymbolView name="trash.fill" size={14} tintColor="#B76E79" />
                </Pressable>
              </View>
            </View>
          )}

        </View>

        {/* Footer info/Sign out */}
        <View style={styles.footerContainer}>
          <Pressable
            onPress={handleSignOut}
            style={styles.signOutButton}
          >
            <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
          </Pressable>
          <ThemedText style={styles.versionText}>NoteBox v2.0.0 (EAS Build)</ThemedText>
        </View>

        <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#FBF8F5',
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-SemiBold',
    fontSize: 22,
    color: '#2E2A28',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FBF8F5',
    borderRadius: 22,
    padding: 4,
    marginBottom: Spacing.four,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 18,
  },
  activeTabButton: {
    backgroundColor: '#F6F2EF',
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  tabButtonText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 13,
  },
  contentBox: {
    flex: 1,
    backgroundColor: '#FBF8F5',
    borderRadius: 28,
    padding: Spacing.four,
    shadowColor: '#2E2A28',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    justifyContent: 'center',
    minHeight: 380,
  },
  sectionInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardGradient: {
    borderRadius: 18,
    padding: 1,
  },
  membershipCard: {
    backgroundColor: '#FBF8F5',
    borderRadius: 17,
    padding: Spacing.three,
    alignItems: 'center',
    gap: 6,
  },
  membershipLevel: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    fontSize: 18,
    color: '#B76E79',
  },
  membershipTagline: {
    fontSize: 12,
    color: '#6F6763',
    textAlign: 'center',
    lineHeight: 16,
  },
  simContainer: {
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  simLabel: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 13,
    color: '#6F6763',
  },
  simButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  simButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simButtonText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 12,
  },
  upgradeCTA: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#B76E79',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#B76E79',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  upgradeCTAText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Bold',
    color: '#FFF',
    fontSize: 14,
  },
  subRowsContainer: {
    marginTop: Spacing.two,
  },
  subRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D8CEC7',
  },
  subRowText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Regular',
    fontSize: 14,
    color: '#2E2A28',
  },
  rowsWrapper: {
    gap: Spacing.three,
  },
  settingsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D8CEC7',
  },
  toggleRowTitle: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    fontSize: 14,
    color: '#2E2A28',
  },
  toggleRowSubtitle: {
    fontSize: 11,
    color: '#6F6763',
    marginTop: 2,
  },
  downloadArchiveButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginLeft: 8,
    borderRadius: 22,
    backgroundColor: '#B76E79',
  },
  downloadArchiveButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  hapticControlSection: {
    gap: Spacing.two,
  },
  footerContainer: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  signOutButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#2E2A28',
  },
  signOutText: {
    fontFamily: Platform.OS === 'web' ? 'Outfit' : 'Outfit-Medium',
    color: '#FFF',
    fontSize: 12,
  },
  versionText: {
    fontSize: 10,
    color: '#6F6763',
  },
});
