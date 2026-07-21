import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useApp } from '@/context/AppContext';

export function useHaptics() {
  let hapticSetting: 'Standard' | 'Light' | 'Off' = 'Standard';
  try {
    const app = useApp();
    hapticSetting = app.hapticSetting;
  } catch {
    // Avoid crash if hook is used outside AppProvider
  }

  const triggerHaptic = async (type: 'tick' | 'micro' | 'success' | 'milestone' | 'warning' | 'critical') => {
    if (hapticSetting === 'Off') {
      return;
    }

    if (Platform.OS === 'web') {
      const isTouchCapable = typeof window !== 'undefined' && (
        'ontouchstart' in window ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
      );
      if (isTouchCapable && typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          if (hapticSetting === 'Light') {
            switch (type) {
              case 'tick':
                navigator.vibrate(5);
                break;
              case 'micro':
                navigator.vibrate(10);
                break;
              case 'success':
                navigator.vibrate([10, 30, 10]);
                break;
              case 'milestone':
                navigator.vibrate(15);
                break;
              case 'warning':
                navigator.vibrate([15, 30, 15]);
                break;
              case 'critical':
                navigator.vibrate([20, 30, 20]);
                break;
            }
          } else {
            // Standard
            switch (type) {
              case 'tick':
                navigator.vibrate(10);
                break;
              case 'micro':
                navigator.vibrate(15);
                break;
              case 'success':
                navigator.vibrate([20, 40, 20]);
                break;
              case 'milestone':
                navigator.vibrate(30);
                break;
              case 'warning':
                navigator.vibrate([30, 40, 30]);
                break;
              case 'critical':
                navigator.vibrate([50, 50, 50]);
                break;
            }
          }
        } catch {
          // Fail silently or log
        }
      }
      console.log(`[Haptic Simulator] Triggered: ${type} (Setting: ${hapticSetting})`);
      return;
    }

    try {
      if (hapticSetting === 'Light') {
        switch (type) {
          case 'tick':
            await Haptics.selectionAsync();
            break;
          case 'micro':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'success':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'milestone':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'warning':
            await Haptics.selectionAsync();
            break;
          case 'critical':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
        }
      } else {
        // Standard
        switch (type) {
          case 'tick':
            await Haptics.selectionAsync();
            break;
          case 'micro':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'success':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'milestone':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'warning':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case 'critical':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
        }
      }
    } catch (error) {
      console.warn('Failed to trigger haptic feedback:', error);
    }
  };

  return { triggerHaptic };
}
