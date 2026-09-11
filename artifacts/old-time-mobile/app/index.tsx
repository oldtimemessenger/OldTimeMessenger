import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const launchLogo = require('../assets/images/old-time-feather-logo.png');

export default function GetStartedScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const introProgress = useRef(new Animated.Value(1)).current;
  const ambientProgress = useRef(new Animated.Value(0.5)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      introProgress.setValue(1);
      ambientProgress.setValue(0.5);
      return;
    }

    Animated.spring(introProgress, {
      toValue: 1,
      damping: 16,
      stiffness: 105,
      mass: 0.75,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    const ambient = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientProgress, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ambientProgress, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    ambient.start();
    return () => ambient.stop();
  }, [ambientProgress, introProgress, reduceMotion]);

  const logoTranslateY = introProgress.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  const logoScale = introProgress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.72, 1.04, 1] });
  const logoOpacity = introProgress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.8, 1] });
  const copyTranslateY = introProgress.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const copyOpacity = introProgress.interpolate({ inputRange: [0, 0.42, 1], outputRange: [0, 0, 1] });
  const buttonTranslateY = introProgress.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const buttonOpacity = introProgress.interpolate({ inputRange: [0, 0.62, 1], outputRange: [0, 0, 1] });
  const buttonScale = ambientProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.99, 1.015, 0.99] });
  const haloScale = ambientProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.96, 1.04, 0.96] });
  const haloOpacity = ambientProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.42, 0.8, 0.42] });
  const ringRotate = ambientProgress.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] });
  const redDrift = ambientProgress.interpolate({ inputRange: [0, 1], outputRange: [-18, 22] });
  const deepRedDrift = ambientProgress.interpolate({ inputRange: [0, 1], outputRange: [18, -16] });

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.authGradientStart, colors.authGradientMiddle, colors.authGradientEnd]}
        locations={[0, 0.47, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.launchGlow, styles.launchGlowRed, { transform: [{ translateX: redDrift }] }]} />
      <Animated.View style={[styles.launchGlow, styles.launchGlowDeepRed, { transform: [{ translateX: deepRedDrift }] }]} />
      <Animated.View style={[styles.backgroundRing, { transform: [{ rotate: ringRotate }] }]} />

      <View style={[styles.content, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 24 : 0) + 168 }]}>
        <Animated.View style={[styles.logoStage, { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }, { scale: logoScale }] }]}>
          <View style={styles.logoStageRing} />
          <Animated.View style={[styles.logoPulse, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
          <View style={[styles.logoHalo, { backgroundColor: colors.authNavy }]}>
            <Image source={launchLogo} style={styles.logo} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.copy, { opacity: copyOpacity, transform: [{ translateY: copyTranslateY }] }]}>
          <Text style={styles.brand}>Old Time<Text style={styles.brandDot}>.</Text></Text>
          <Text style={styles.tagline}>Private conversations. Real connections.</Text>
          <Text style={styles.subline}>Make room for what matters.</Text>
        </Animated.View>
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 20) }]}>
        <Animated.View style={[styles.buttonAnimation, { opacity: buttonOpacity, transform: [{ translateY: buttonTranslateY }, { scale: buttonScale }] }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started with Old Time"
            onPress={() => router.replace('/(auth)/sign-in' as never)}
            style={({ pressed }) => [styles.getStarted, pressed && styles.pressed]}
          >
            <Text style={styles.getStartedText}>Get started</Text>
            <View style={styles.arrowCircle}>
              <Ionicons name="arrow-forward" size={20} color={colors.authNavy} />
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, alignItems: 'center' },
  launchGlow: { position: 'absolute', width: 290, height: 290, borderRadius: 145, opacity: 0.28 },
  launchGlowRed: { backgroundColor: '#FF6B73', top: '31%', left: -150 },
  launchGlowDeepRed: { backgroundColor: '#5C0711', top: '10%', right: -175 },
  backgroundRing: { position: 'absolute', width: 460, height: 460, borderRadius: 230, borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)', top: '12%', right: -260 },
  logoStage: { width: 320, height: 320, marginTop: 25, alignItems: 'center', justifyContent: 'center' },
  logoStageRing: { position: 'absolute', width: 310, height: 310, borderRadius: 155, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  logoPulse: { position: 'absolute', width: 282, height: 282, borderRadius: 141, borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)', backgroundColor: 'rgba(255,255,255,0.07)' },
  logoHalo: {
    width: 242,
    height: 242,
    borderRadius: 121,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
     shadowColor: '#4A050C',
    shadowOpacity: 0.38,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 13 },
    elevation: 12,
  },
  logo: { width: 224, height: 224, borderRadius: 56 },
  copy: { alignItems: 'center', marginTop: 0 },
  brand: { color: '#FDFBF7', fontFamily: 'Fraunces_900Black', fontSize: 44, lineHeight: 52, letterSpacing: -1.5, marginTop: 0 },
  brandDot: { color: '#FFB3B7' },
  tagline: { color: 'rgba(253,251,247,0.9)', fontFamily: 'Outfit_500Medium', fontSize: 18, marginTop: 8 },
  subline: { color: 'rgba(253,251,247,0.64)', fontFamily: 'Outfit_400Regular', fontSize: 14, marginTop: 10 },
  bottom: { paddingHorizontal: 27, alignItems: 'center' },
  buttonAnimation: { width: '100%' },
  getStarted: { width: '100%', minHeight: 64, borderRadius: 32, backgroundColor: '#D71920', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  getStartedText: { color: '#FFFFFF', fontFamily: 'Outfit_700Bold', fontSize: 18 },
  arrowCircle: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  footer: { color: 'rgba(253,251,247,0.62)', fontFamily: 'Outfit_400Regular', fontSize: 14, marginTop: 20 },
});