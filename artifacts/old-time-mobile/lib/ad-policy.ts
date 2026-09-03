export type AdFormat = 'native' | 'banner' | 'interstitial' | 'app-open';

export type AdSurface =
  | 'updates'
  | 'creator-feed'
  | 'community-feed'
  | 'map'
  | 'public-profile'
  | 'story'
  | 'chat'
  | 'message-composer'
  | 'settings'
  | 'auth'
  | 'phone-verification'
  | 'payment'
  | 'calls'
  | 'private-event'
  | 'unknown';

export type AdFeedItem<T> =
  | { kind: 'content'; key: string; content: T }
  | { kind: 'native-ad'; key: string; placement: string };

export const AD_POLICY = {
  native: {
    firstAfterItems: 1,
    intervalItems: 4,
    maxPerFeed: 3,
  },
  interstitial: {
    minimumContentViews: 10,
    cooldownMs: 12 * 60 * 1000,
    maxPerSession: 2,
  },
  appOpen: {
    minimumSessionAgeMs: 2 * 60 * 1000,
    minimumBackgroundMs: 60 * 1000,
    cooldownMs: 4 * 60 * 60 * 1000,
    maxPerSession: 1,
  },
  global: {
    minimumGapMs: 90 * 1000,
  },
} as const;

const AD_FREE_SURFACES = new Set<AdSurface>([
  'chat',
  'message-composer',
  'settings',
  'auth',
  'phone-verification',
  'payment',
  'calls',
  'private-event',
  'unknown',
]);

const FORMAT_SURFACES: Record<AdFormat, ReadonlySet<AdSurface>> = {
  native: new Set(['creator-feed', 'community-feed', 'map']),
  banner: new Set(['updates', 'map', 'public-profile']),
  interstitial: new Set(['creator-feed']),
  'app-open': new Set(['updates', 'creator-feed', 'community-feed', 'map']),
};

const NATIVE_PLACEMENT_OVERRIDES: Partial<Record<AdSurface, { firstAfterItems: number; intervalItems: number; maxPerFeed: number }>> = {
  map: { firstAfterItems: 1, intervalItems: 4, maxPerFeed: 1 },
  'community-feed': { firstAfterItems: 1, intervalItems: 5, maxPerFeed: 2 },
};

export function isAdAllowed(surface: AdSurface, format: AdFormat) {
  return !AD_FREE_SURFACES.has(surface) && FORMAT_SURFACES[format].has(surface);
}

export function buildNativeAdFeed<T>(
  surface: AdSurface,
  items: T[],
  keyForItem: (item: T) => string,
  enabled: boolean,
): AdFeedItem<T>[] {
  const content = items.map((item) => ({ kind: 'content' as const, key: keyForItem(item), content: item }));
  if (!enabled || !isAdAllowed(surface, 'native') || items.length <= AD_POLICY.native.firstAfterItems) return content;

  const placement = NATIVE_PLACEMENT_OVERRIDES[surface] ?? AD_POLICY.native;
  const result: AdFeedItem<T>[] = [];
  let adsInserted = 0;
  let contentSinceAd = 0;

  content.forEach((item, index) => {
    result.push(item);
    contentSinceAd += 1;

    const firstPlacementReady = index + 1 >= placement.firstAfterItems;
    const nextPlacementReady = adsInserted === 0 || contentSinceAd >= placement.intervalItems;
    const hasMoreContent = index < content.length - 1;
    if (firstPlacementReady && nextPlacementReady && hasMoreContent && adsInserted < placement.maxPerFeed) {
      result.push({
        kind: 'native-ad',
        key: `ad:${surface}:${adsInserted + 1}`,
        placement: `${surface}-${adsInserted + 1}`,
      });
      adsInserted += 1;
      contentSinceAd = 0;
    }
  });

  return result;
}

export function surfaceForPath(pathname: string): AdSurface {
  if (pathname.startsWith('/chat/')) return 'chat';
  if (pathname.startsWith('/camera')) return 'message-composer';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/calls')) return 'calls';
  if (pathname.startsWith('/current-event/')) return 'private-event';
  if (pathname.startsWith('/story/')) return 'story';
  if (pathname.startsWith('/map')) return 'map';
  return 'unknown';
}