import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

// These mirror the expo-splash-screen config in app.json on purpose: the overlay
// redraws the native splash (same mark, same ground, same size) so handing off
// from it is invisible. Change one, change the other — `animated-icon.test.tsx`
// asserts they stay in sync.
//
// Deliberately not theme-aware: the native splash has a single backgroundColor,
// so tinting this for dark mode would reintroduce the flash it exists to hide.
const SPLASH_BACKGROUND = '#f5f8f7';
const SPLASH_IMAGE_WIDTH = 160;

const DURATION = 600;

export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    100: {
      opacity: 0,
      // A slight bloom as it fades, so the mark hands off to the app rather
      // than just cutting out.
      transform: [{ scale: 1.06 }],
      easing: Easing.out(Easing.quad),
    },
  });

  const image = (
    <Image
      testID="splash-mark"
      style={styles.image}
      source={require('@/assets/images/splash-icon.png')}
      contentFit="contain"
    />
  );

  return animate ? (
    <Animated.View
      testID="splash-overlay"
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {image}
    </Animated.View>
  ) : (
    <View
      testID="splash-overlay"
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.splashOverlay}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    // Square because the mark is; the width matches app.json's `imageWidth`.
    width: SPLASH_IMAGE_WIDTH,
    height: SPLASH_IMAGE_WIDTH,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SPLASH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
