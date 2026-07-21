import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View, Pressable, Modal, ScrollView, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useHaptics } from '@/hooks/use-haptics';
import { Spacing } from '@/constants/theme';
import { useEntitlements } from '@/context/EntitlementContext';
import {
  isStoreKitUserCancellation,
  loadNoteBoxSubscriptionProduct,
  purchaseNoteBoxSubscription,
  restoreNoteBoxSubscription,
  type StoreKitProduct,
  subscriptionPeriodLabel,
} from '@/services/storekit';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
}

export function PaywallModal({ visible, onClose }: PaywallProps) {
  const theme = useTheme();
  const { triggerHaptic } = useHaptics();
  const { refresh, isLoading } = useEntitlements();
  const [storeKitAction, setStoreKitAction] = useState<'purchase' | 'restore' | null>(null);
  const [product, setProduct] = useState<StoreKitProduct | null>(null);
  const [productLoading, setProductLoading] = useState(false);

  useEffect(() => {
    if (!visible || Platform.OS !== 'ios') return;
    let mounted = true;
    setProductLoading(true);
    void loadNoteBoxSubscriptionProduct()
      .then((nextProduct) => {
        if (mounted) setProduct(nextProduct);
      })
      .catch(() => {
        if (mounted) setProduct(null);
      })
      .finally(() => {
        if (mounted) setProductLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [visible]);

  const handlePurchase = async () => {
    triggerHaptic('micro');
    if (Platform.OS !== 'ios') {
      Alert.alert('Available on iPhone', 'NoteBox subscriptions are purchased through the App Store on iOS.');
      return;
    }
    setStoreKitAction('purchase');
    try {
      await purchaseNoteBoxSubscription();
      try {
        await refresh();
        Alert.alert('Welcome to NoteBox Pro', 'Your purchase was verified and your membership is active.');
      } catch {
        Alert.alert(
          'Purchase Verified',
          'Your purchase was verified, but NoteBox could not refresh the membership display. It will retry when the app returns to the foreground.',
        );
      }
      onClose();
    } catch (error) {
      if (!isStoreKitUserCancellation(error)) {
        Alert.alert(
          'Purchase Not Completed',
          'The App Store purchase did not complete or NoteBox could not verify it. No new access was granted.',
        );
      }
    } finally {
      setStoreKitAction(null);
    }
  };

  const handleRestore = async () => {
    triggerHaptic('micro');
    if (Platform.OS !== 'ios') {
      Alert.alert('Available on iPhone', 'Purchase restoration is available through the App Store on iOS.');
      return;
    }
    setStoreKitAction('restore');
    try {
      const result = await restoreNoteBoxSubscription();
      if (result.restoredCount === 0) {
        Alert.alert('No Purchase Found', 'The App Store did not find an active NoteBox Pro purchase for this Apple ID.');
        return;
      }
      try {
        await refresh();
        Alert.alert('Purchases Restored', 'Your App Store purchase was verified and your membership is active.');
      } catch {
        Alert.alert(
          'Purchases Restored',
          'Your purchase was verified, but NoteBox could not refresh the membership display. It will retry when the app returns to the foreground.',
        );
      }
      onClose();
    } catch {
      Alert.alert(
        'Unable to Restore',
        'NoteBox could not complete App Store restoration or verify an active purchase. Your access was not changed.',
      );
    } finally {
      setStoreKitAction(null);
    }
  };

  const openUrl = async (url: string) => {
    triggerHaptic('micro');
    await WebBrowser.openBrowserAsync(url);
  };

  const price = product?.displayPrice ?? 'Price unavailable';
  const period = product ? subscriptionPeriodLabel(product) : 'subscription period shown by Apple';
  const hasFreeTrial = product?.introductoryPricePaymentModeIOS?.toLowerCase() === 'free-trial';
  const purchaseUnavailable = Platform.OS === 'ios' && (productLoading || product === null);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <ThemedView style={styles.container}>
        {/* Header bar */}
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => {
              triggerHaptic('micro');
              onClose();
            }}
            style={styles.closeButton}
            accessibilityLabel="Close paywall"
          >
            <ThemedText type="default" style={styles.closeIcon}>✕</ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <ThemedText type="title" style={styles.heroTitle} themeColor="roseGoldDark">
              NoteBox Pro
            </ThemedText>
            <ThemedText type="default" style={styles.heroSubtitle}>
              More room for your record, full Perspective controls, Patterns, and export.
            </ThemedText>
          </View>

          {/* Pricing cards */}
          <View style={styles.cardContainer}>
            <ThemedView type="backgroundElement" style={styles.planCard}>
              <ThemedText type="smallBold" themeColor="textSecondary">FREE TIER</ThemedText>
              <ThemedText type="subtitle" style={styles.priceText}>$0.00</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Standard note taking</ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={[styles.planCard, { borderColor: theme.roseGoldDark, borderWidth: 2 }]}>
              <View style={styles.badge}>
                <ThemedText type="code" style={styles.badgeText}>POPULAR</ThemedText>
              </View>
              <ThemedText type="smallBold" themeColor="roseGoldDark">
                {(product?.displayName || product?.title || 'NOTEBOX PRO').toUpperCase()}
              </ThemedText>
              <ThemedText type="subtitle" style={styles.priceText}>{price}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {productLoading
                  ? 'Loading App Store details…'
                  : hasFreeTrial
                    ? `Free trial available when Apple confirms eligibility; then ${period}`
                    : period}
              </ThemedText>
            </ThemedView>
          </View>

          {/* Feature Comparison */}
          <View style={styles.comparisonTable}>
            <ThemedText type="smallBold" style={styles.tableHeader}>
              FEATURE COMPARISON
            </ThemedText>

            <View style={styles.tableRow}>
              <ThemedText type="small" style={styles.colLabel}>Boxes & Notes</ThemedText>
              <ThemedText type="small" style={styles.colVal}>5 Boxes / 5 Notes</ThemedText>
              <ThemedText type="smallBold" style={styles.colValPro}>Unlimited</ThemedText>
            </View>

            <View style={styles.tableRow}>
              <ThemedText type="small" style={styles.colLabel}>Receipt Attachments</ThemedText>
              <ThemedText type="small" style={styles.colVal}>3 per Note</ThemedText>
              <ThemedText type="smallBold" style={styles.colValPro}>10 per Note</ThemedText>
            </View>

            <View style={styles.tableRow}>
              <ThemedText type="small" style={styles.colLabel}>AI Perspectives</ThemedText>
              <ThemedText type="small" style={styles.colVal}>Aligned + Objective + Unfiltered</ThemedText>
              <ThemedText type="smallBold" style={styles.colValPro}>Aligned + Objective + Unfiltered</ThemedText>
            </View>

            <View style={styles.tableRow}>
              <ThemedText type="small" style={styles.colLabel}>Context Scope Controls</ThemedText>
              <ThemedText type="small" style={styles.colVal}>Locked</ThemedText>
              <ThemedText type="smallBold" style={styles.colValPro}>This Note, Box History, Tagged People</ThemedText>
            </View>

            <View style={styles.tableRow}>
              <ThemedText type="small" style={styles.colLabel}>Perspective Tones & Intensity</ThemedText>
              <ThemedText type="small" style={styles.colVal}>Bold default</ThemedText>
              <ThemedText type="smallBold" style={styles.colValPro}>Mild, Bold, Savage</ThemedText>
            </View>

            <View style={styles.tableRow}>
              <ThemedText type="small" style={styles.colLabel}>Regeneration</ThemedText>
              <ThemedText type="small" style={styles.colVal}>1 token / Note</ThemedText>
              <ThemedText type="smallBold" style={styles.colValPro}>Unlimited in trial; then 5 per state / Note</ThemedText>
            </View>

            <View style={styles.tableRow}>
              <ThemedText type="small" style={styles.colLabel}>Patterns Detection</ThemedText>
              <ThemedText type="small" style={styles.colVal}>Locked</ThemedText>
              <ThemedText type="smallBold" style={styles.colValPro}>Across Boxes</ThemedText>
            </View>
          </View>

          {/* Trial / Terms Disclosures */}
          <View style={styles.disclosures}>
            <ThemedText type="small" style={styles.disclosureText}>
              Apple charges {price} {period}. Any eligible introductory offer is shown by Apple before confirmation.
            </ThemedText>
            <ThemedText type="small" style={styles.disclosureText}>
              🔒 Subscription Auto-Renewal: NoteBox Pro automatically renews unless canceled at least 24 hours before the end of the current period.
            </ThemedText>
            <Pressable onPress={() => openUrl('https://support.apple.com/HT202039')}>
              <ThemedText type="smallBold" themeColor="roseGoldDark" style={styles.linkText}>
                How to cancel subscription
              </ThemedText>
            </Pressable>
          </View>

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={handlePurchase}
              disabled={isLoading || purchaseUnavailable || storeKitAction !== null}
              style={[styles.button, { backgroundColor: theme.roseGoldDark }]}
            >
              <ThemedText type="smallBold" style={styles.buttonText}>
                {storeKitAction === 'purchase'
                  ? 'Contacting App Store…'
                  : Platform.OS !== 'ios'
                    ? 'Available on iPhone'
                  : productLoading
                      ? 'Loading App Store Price…'
                      : product === null
                        ? 'App Store Product Unavailable'
                        : 'Start App Store Purchase'}
              </ThemedText>
            </Pressable>

            {/* COMPLIANCE RULE: Restore Purchases must have equal tap target weight */}
            <Pressable
              onPress={handleRestore}
              disabled={isLoading || storeKitAction !== null}
              style={[
                styles.button,
                { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.roseGoldDark }
              ]}
            >
              <ThemedText type="smallBold" style={[styles.buttonText, { color: theme.roseGoldDark }]}>
                {storeKitAction === 'restore' ? 'Restoring Purchases…' : 'Restore Purchases'}
              </ThemedText>
            </Pressable>
          </View>

          {/* Policy Links footer */}
          <View style={styles.footer}>
            <Pressable onPress={() => openUrl('https://notebox.app/terms')}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.footerLink}>Terms of Service</ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">|</ThemedText>
            <Pressable onPress={() => openUrl('https://notebox.app/privacy')}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.footerLink}>Privacy Policy</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  headerBar: {
    height: 50,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: Platform.select({ web: '700', default: undefined }),
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  heroSection: {
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: Platform.select({ web: '700', default: undefined }),
    textAlign: 'center',
  },
  heroSubtitle: {
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 22,
    maxWidth: 320,
  },
  cardContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  planCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#B76E79',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: Platform.select({ web: '700', default: undefined }),
  },
  priceText: {
    fontSize: 24,
    fontWeight: Platform.select({ web: '700', default: undefined }),
    marginVertical: Spacing.one,
  },
  comparisonTable: {
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  tableHeader: {
    fontSize: 11,
    letterSpacing: 1,
    opacity: 0.6,
    paddingBottom: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
  },
  colLabel: {
    flex: 2,
  },
  colVal: {
    flex: 1,
    textAlign: 'center',
    opacity: 0.7,
  },
  colValPro: {
    flex: 1,
    textAlign: 'center',
    color: '#B76E79',
  },
  disclosures: {
    gap: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  disclosureText: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.7,
  },
  linkText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    gap: Spacing.two,
  },
  button: {
    height: 50,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44, // 44px min tap target
  },
  buttonText: {
    fontSize: 16,
    color: '#FFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  footerLink: {
    fontSize: 12,
    opacity: 0.6,
  },
});
