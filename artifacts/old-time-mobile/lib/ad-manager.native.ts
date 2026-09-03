import mobileAds, {
  AdEventType,
  AdsConsent,
  AppOpenAd,
  InterstitialAd,
  TestIds,
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import {
  AD_POLICY,
  buildNativeAdFeed,
  isAdAllowed,
  type AdFormat,
  type AdSurface,
} from '@/lib/ad-policy';
import type { AdManager } from '@/lib/ad-manager';

const productionUnitIds: Record<AdFormat, Partial<Record<'ios' | 'android', string | undefined>>> = {
  native: {
    ios: process.env.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID_IOS ?? 'ca-app-pub-7063228070009280/5176449797',
    android: process.env.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID_ANDROID,
  },
  banner: {
    ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_IOS ?? 'ca-app-pub-7063228070009280/4671007160',
    android: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_ANDROID,
  },
  interstitial: {
    ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_IOS ?? 'ca-app-pub-7063228070009280/8225390160',
    android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_ANDROID,
  },
  'app-open': {
    ios: process.env.EXPO_PUBLIC_ADMOB_APP_OPEN_UNIT_ID_IOS ?? 'ca-app-pub-7063228070009280/2602257343',
    android: process.env.EXPO_PUBLIC_ADMOB_APP_OPEN_UNIT_ID_ANDROID,
  },
};

const testUnitIds: Record<AdFormat, string> = {
  native: TestIds.NATIVE,
  banner: TestIds.ADAPTIVE_BANNER,
  interstitial: TestIds.INTERSTITIAL,
  'app-open': TestIds.APP_OPEN,
};

const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_TEST_MODE === 'true';

const sessionStartedAt = Date.now();
const seenContent = new Set<string>();
const shownCount: Record<AdFormat, number> = { native: 0, banner: 0, interstitial: 0, 'app-open': 0 };
const lastShownAt: Partial<Record<AdFormat, number>> = {};
let lastAnyAdAt = 0;
let activeSurface: AdSurface = 'unknown';
let backgroundedAt: number | null = null;
let appOpenAd: ReturnType<typeof AppOpenAd.createForAdRequest> | null = null;
let appOpenLoaded = false;
let interstitialAd: ReturnType<typeof InterstitialAd.createForAdRequest> | null = null;
let interstitialLoaded = false;

function unitId(format: AdFormat) {
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;
  if (!platform) return null;
  return useTestAds ? testUnitIds[format] : productionUnitIds[format][platform] ?? null;
}

function releasePlatformIsConfigured() {
  if (useTestAds) return true;
  return Boolean(unitId('native') && unitId('banner') && unitId('interstitial') && unitId('app-open'));
}

function hasGlobalSpacing(now: number) {
  return now - lastAnyAdAt >= AD_POLICY.global.minimumGapMs;
}

function recordShown(format: AdFormat, now = Date.now()) {
  shownCount[format] += 1;
  lastShownAt[format] = now;
  lastAnyAdAt = now;
}

function prepareAppOpen() {
  const id = unitId('app-open');
  if (!id || appOpenAd) return;
  appOpenAd = AppOpenAd.createForAdRequest(id, { requestNonPersonalizedAdsOnly: true });
  appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
    appOpenLoaded = true;
  });
  appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
    appOpenLoaded = false;
    appOpenAd = null;
    prepareAppOpen();
  });
  appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
    appOpenLoaded = false;
    appOpenAd = null;
  });
  appOpenAd.load();
}

function prepareInterstitial() {
  const id = unitId('interstitial');
  if (!id || interstitialAd) return;
  interstitialAd = InterstitialAd.createForAdRequest(id, { requestNonPersonalizedAdsOnly: true });
  interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });
  interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    interstitialAd = null;
    seenContent.clear();
    prepareInterstitial();
  });
  interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
    interstitialAd = null;
  });
  interstitialAd.load();
}

export const adManager: AdManager = {
  async initialize() {
    if (!releasePlatformIsConfigured()) return;
    try {
      await AdsConsent.requestInfoUpdate();
      await AdsConsent.loadAndShowConsentFormIfRequired();
    } catch {
      return;
    }
    await mobileAds().initialize();
    prepareAppOpen();
    prepareInterstitial();
  },
  setActiveSurface(surface) {
    activeSurface = surface;
  },
  handleAppBackground() {
    backgroundedAt = Date.now();
  },
  async handleAppForeground() {
    const now = Date.now();
    const backgroundDuration = backgroundedAt ? now - backgroundedAt : 0;
    backgroundedAt = null;
    if (
      !appOpenAd ||
      !appOpenLoaded ||
      !isAdAllowed(activeSurface, 'app-open') ||
      shownCount['app-open'] >= AD_POLICY.appOpen.maxPerSession ||
      now - sessionStartedAt < AD_POLICY.appOpen.minimumSessionAgeMs ||
      backgroundDuration < AD_POLICY.appOpen.minimumBackgroundMs ||
      now - (lastShownAt['app-open'] ?? 0) < AD_POLICY.appOpen.cooldownMs ||
      !hasGlobalSpacing(now)
    ) return;

    recordShown('app-open', now);
    await appOpenAd.show();
  },
  recordContentView(surface, contentId) {
    if (!isAdAllowed(surface, 'interstitial')) return;
    seenContent.add(`${surface}:${contentId}`);
  },
  async showInterstitialAtTransition(surface) {
    const now = Date.now();
    if (
      !interstitialAd ||
      !interstitialLoaded ||
      !isAdAllowed(surface, 'interstitial') ||
      seenContent.size < AD_POLICY.interstitial.minimumContentViews ||
      shownCount.interstitial >= AD_POLICY.interstitial.maxPerSession ||
      now - (lastShownAt.interstitial ?? 0) < AD_POLICY.interstitial.cooldownMs ||
      !hasGlobalSpacing(now)
    ) return false;

    recordShown('interstitial', now);
    await interstitialAd.show();
    return true;
  },
  unitId,
  blendNativeAds(surface, items, keyForItem) {
    return buildNativeAdFeed(surface, items, keyForItem, Boolean(unitId('native')));
  },
};