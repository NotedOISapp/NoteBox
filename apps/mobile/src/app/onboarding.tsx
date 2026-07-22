import React, { useState } from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { useHaptics } from '@/hooks/use-haptics';
import { Spacing, MaxContentWidth, Palette, Fonts } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { GlassView } from 'expo-glass-effect';

interface OnboardingProps {
  onCompleted: () => void;
}

export default function OnboardingScreen({ onCompleted }: OnboardingProps) {
  const { triggerHaptic } = useHaptics();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isButtonPressed, setIsButtonPressed] = useState(false);

  const SLIDES = [
    {
      title: 'Save the note, the screenshot, and the context.',
      description: 'NoteBox keeps notes, screenshots, receipts, people, and perspective together in private Boxes.',
      badge: 'Core Concept',
    },
    {
      title: 'One note. Three ways to see it.',
      description: 'Gain clarity on your experiences: Aligned (feel understood, right now), Objective (outside perspective), and Unfiltered (no holding back).',
      badge: 'Perspective Education',
    },
    {
      title: 'Drafts autosave. Nothing gets deleted.',
      description: 'Free includes 5 Boxes and 5 notes per Box. After that, a Box locks for new notes, but you can still read everything.',
      badge: 'Privacy & Safety',
    }
  ];

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      triggerHaptic('micro');
      setCurrentSlide(currentSlide + 1);
    } else {
      triggerHaptic('success');
      onCompleted();
    }
  };

  const activeSlide = SLIDES[currentSlide];

  return (
    <View style={[styles.outerContainer, { backgroundColor: Palette.alabaster }]}>
      {/* Top half: Landscape Image */}
      <View style={styles.imageContainer}>
        <Image
          source={require('@/assets/images/onboarding_landscape.png')}
          style={styles.onboardingImage}
          contentFit="cover"
        />
      </View>

      {/* Bottom container with refractive glass sheet overlap */}
      <GlassView
        glassEffectStyle="regular"
        style={[
          styles.bottomContainer,
          {
            backgroundColor: 'rgba(250, 249, 246, 0.72)',
            borderColor: 'rgba(255, 255, 255, 0.5)',
            borderTopWidth: 1.5,
            borderLeftWidth: 1.5,
            borderRightWidth: 1.5,
          }
        ]}
      >
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          {/* Slide Text Content */}
          <Animated.View
            key={currentSlide}
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            style={styles.slideContent}
          >
            {/* Badge Indicator */}
            <View style={styles.badgeWrapper}>
              <LinearGradient
                colors={[Palette.roseGoldLight, Palette.roseGoldDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badgeGradient}
              >
                <ThemedText style={styles.badgeText}>
                  {activeSlide.badge}
                </ThemedText>
              </LinearGradient>
            </View>

            {/* Slide Title */}
            <ThemedText style={styles.title}>
              {activeSlide.title}
            </ThemedText>

            {/* Slide Description */}
            <ThemedText style={styles.description}>
              {activeSlide.description}
            </ThemedText>
          </Animated.View>

          {/* Dots Indicator & Navigation Trigger */}
          <View style={styles.footer}>
            <View style={styles.dotsRow}>
              {SLIDES.map((_, index) => {
                const isActive = index === currentSlide;
                return (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isActive ? Palette.roseGoldDark : Palette.espresso + '22',
                        width: isActive ? 20 : 8,
                      }
                    ]}
                  />
                );
              })}
            </View>

            <Pressable
              onPressIn={() => setIsButtonPressed(true)}
              onPressOut={() => setIsButtonPressed(false)}
              onPress={handleNext}
              style={[
                styles.navButtonWrapper,
                isButtonPressed ? styles.navButtonPressed : styles.navButtonNormal
              ]}
              accessibilityLabel={currentSlide === SLIDES.length - 1 ? "Get Started" : "Next page"}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[Palette.roseGoldLight, Palette.roseGoldDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.navButtonGradient}
              >
                <ThemedText style={styles.navButtonText}>
                  {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </View>
        </SafeAreaView>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: '46%',
    overflow: 'hidden',
  },
  onboardingImage: {
    width: '100%',
    height: '100%',
  },
  bottomContainer: {
    flex: 1,
    marginTop: -30,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    shadowColor: Palette.espresso,
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 8,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
      },
      default: {},
    }),
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  slideContent: {
    alignItems: 'center',
    gap: Spacing.four,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  badgeWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: Spacing.one,
  },
  badgeGradient: {
    paddingHorizontal: Spacing.four,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontFamily: Fonts.sans.bold,
    color: '#FFF',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: Platform.OS === 'web' ? 'Playfair Display' : 'PlayfairDisplay-Bold',
    fontSize: 28,
    fontWeight: 'bold',
    color: Palette.espresso,
    textAlign: 'center',
    lineHeight: 34,
    paddingHorizontal: Spacing.two,
  },
  description: {
    fontFamily: Fonts.sans.fontFamily,
    color: Palette.espresso + 'b3',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: Spacing.three,
  },
  footer: {
    gap: Spacing.four,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    width: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.one,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  navButtonWrapper: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: Palette.espresso,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  navButtonNormal: {
    transform: [{ translateY: 0 }],
  },
  navButtonPressed: {
    transform: [{ translateY: 2 }],
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  navButtonGradient: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  navButtonText: {
    fontFamily: Fonts.sans.bold,
    color: '#FFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
