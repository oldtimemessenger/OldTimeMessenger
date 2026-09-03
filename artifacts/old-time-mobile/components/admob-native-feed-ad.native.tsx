import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaAspectRatio,
  NativeMediaView,
} from 'react-native-google-mobile-ads';
import { adManager } from '@/lib/ad-manager';
import type { AdSurface } from '@/lib/ad-policy';

export function AdMobNativeFeedAd({
  surface,
  placement,
  fullScreen = false,
}: {
  surface: AdSurface;
  placement: string;
  fullScreen?: boolean;
}) {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const unitId = adManager.unitId('native');

  useEffect(() => {
    if (!unitId) return;
    let mounted = true;
    let loadedAd: NativeAd | null = null;
    void NativeAd.createForAdRequest(unitId, {
      aspectRatio: fullScreen ? NativeMediaAspectRatio.PORTRAIT : NativeMediaAspectRatio.LANDSCAPE,
      startVideoMuted: true,
      requestNonPersonalizedAdsOnly: true,
      requestAgent: `OldTime-${surface}-${placement}`,
    }).then((ad) => {
      loadedAd = ad;
      if (mounted) setNativeAd(ad);
      else ad.destroy();
    }).catch(() => undefined);

    return () => {
      mounted = false;
      loadedAd?.destroy();
    };
  }, [fullScreen, placement, surface, unitId]);

  if (!nativeAd) {
    return (
      <View style={[styles.loading, fullScreen && styles.loadingFull]}>
        <ActivityIndicator color="#FFFFFF" />
        <Text style={styles.loadingText}>Sponsored</Text>
      </View>
    );
  }

  return (
    <NativeAdView nativeAd={nativeAd} style={[styles.card, fullScreen && styles.fullScreen]}>
      <NativeMediaView resizeMode="cover" style={fullScreen ? styles.fullMedia : styles.cardMedia} />
      <View style={styles.shade} pointerEvents="none" />
      <View style={styles.sponsoredBadge} pointerEvents="none">
        <Text style={styles.sponsoredText}>Sponsored</Text>
      </View>
      <View style={styles.details}>
        <View style={styles.identity}>
          {nativeAd.icon ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
            </NativeAsset>
          ) : null}
          <View style={styles.copy}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline} numberOfLines={2}>{nativeAd.headline}</Text>
            </NativeAsset>
            {nativeAd.advertiser ? (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser} numberOfLines={1}>{nativeAd.advertiser}</Text>
              </NativeAsset>
            ) : null}
          </View>
        </View>
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text style={styles.body} numberOfLines={fullScreen ? 3 : 2}>{nativeAd.body}</Text>
        </NativeAsset>
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{nativeAd.callToAction}</Text>
          </View>
        </NativeAsset>
      </View>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 390,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#18283A',
  },
  fullScreen: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    backgroundColor: '#000000',
  },
  cardMedia: {
    width: '100%',
    height: 245,
  },
  fullMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: 52,
    left: 16,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sponsoredText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  details: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    gap: 10,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  advertiser: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
  },
  body: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 19,
  },
  cta: {
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  ctaText: {
    color: '#18283A',
    fontSize: 14,
    fontWeight: '800',
  },
  loading: {
    minHeight: 390,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#18283A',
  },
  loadingFull: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
  },
});