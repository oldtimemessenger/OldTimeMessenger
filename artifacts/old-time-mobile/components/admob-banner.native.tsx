import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { adManager } from '@/lib/ad-manager';

export function AdMobBanner() {
  const unitId = adManager.unitId('banner');
  if (!unitId) return null;

  return (
    <View style={styles.container} accessibilityLabel="Advertisement">
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
});