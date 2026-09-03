import { buildNativeAdFeed, type AdFeedItem, type AdFormat, type AdSurface } from '@/lib/ad-policy';

export type AdManager = {
  initialize: () => Promise<void>;
  setActiveSurface: (surface: AdSurface) => void;
  handleAppBackground: () => void;
  handleAppForeground: () => Promise<void>;
  recordContentView: (surface: AdSurface, contentId: string) => void;
  showInterstitialAtTransition: (surface: AdSurface) => Promise<boolean>;
  unitId: (format: AdFormat) => string | null;
  blendNativeAds: <T>(surface: AdSurface, items: T[], keyForItem: (item: T) => string) => AdFeedItem<T>[];
};

export const adManager: AdManager = {
  async initialize() {},
  setActiveSurface() {},
  handleAppBackground() {},
  async handleAppForeground() {},
  recordContentView() {},
  async showInterstitialAtTransition() {
    return false;
  },
  unitId() {
    return null;
  },
  blendNativeAds(surface, items, keyForItem) {
    return buildNativeAdFeed(surface, items, keyForItem, false);
  },
};