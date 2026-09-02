import { Ionicons } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Story } from '@/lib/social-api';

export type UserStoryViewerItem = {
  type: 'USER_STORY';
  id: string;
  story: Story;
};

export type SponsoredStoryViewerItem = {
  type: 'SPONSORED_STORY';
  id: string;
  advertiserName: string;
  advertiserDescription: string;
  headline: string;
  body?: string;
  ctaLabel: string;
  adSlotId: string;
  expiresAt?: number;
  renderAd?: () => ReactNode;
  onPressCta?: () => void;
};

export type StoryViewerItem = UserStoryViewerItem | SponsoredStoryViewerItem;

export function userStoryViewerItem(story: Story): UserStoryViewerItem {
  return { type: 'USER_STORY', id: userStoryViewerItemId(story.id), story };
}

export function userStoryViewerItemId(storyId: number): string {
  return `user-story:${storyId}`;
}

type AdSlotProps = {
  slotId: string;
  renderAd?: () => ReactNode;
};

/**
 * Deliberately has no ad-network dependency. A future AdMob adapter can be
 * supplied through renderAd without changing the Story viewer or its sequence.
 */
export function AdSlot({ slotId, renderAd }: AdSlotProps) {
  return (
    <View testID={`ad-slot-${slotId}`} accessibilityLabel="Ad slot" style={styles.adSlot} pointerEvents={renderAd ? 'auto' : 'none'}>
      <View style={styles.adLabel}>
        <Ionicons name="megaphone-outline" size={13} color="rgba(255,255,255,0.82)" />
        <Text style={styles.adLabelText}>Ad</Text>
      </View>
      {renderAd ? renderAd() : <Text style={styles.reserved}>Reserved advertiser creative</Text>}
    </View>
  );
}

export function SponsoredStory({
  advertiserName,
  advertiserDescription,
  headline,
  body,
  ctaLabel,
  adSlotId,
  renderAd,
  onPressCta,
}: Omit<SponsoredStoryViewerItem, 'type' | 'id' | 'expiresAt'> & { onPressCta?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={styles.sponsoredRoot}>
      <View pointerEvents="box-none" style={styles.frame}>
        <View pointerEvents="box-none" style={[styles.safeContent, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 18 }]}>
          <View pointerEvents="none" style={styles.sponsoredBadge}>
            <Ionicons name="megaphone-outline" size={13} color="#FFFFFF" />
            <Text style={styles.sponsoredBadgeText}>Sponsored</Text>
          </View>
          <AdSlot slotId={adSlotId} renderAd={renderAd} />
          <View style={styles.advertiserInfo} pointerEvents="none">
            <Text style={styles.advertiserName}>{advertiserName}</Text>
            <Text style={styles.headline}>{headline}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}
            <Text style={styles.advertiserDescription}>{advertiserDescription}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${ctaLabel} from ${advertiserName}`}
            onPress={onPressCta}
            disabled={!onPressCta}
            style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.78 : 1 }]}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color="#1C3550" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sponsoredRoot: { ...StyleSheet.absoluteFillObject, zIndex: 12 },
  frame: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  safeContent: { width: '100%', maxHeight: '100%', aspectRatio: 9 / 16, paddingHorizontal: 20, justifyContent: 'space-between' },
  sponsoredBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)' },
  sponsoredBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  adSlot: { flex: 1, width: '100%', minHeight: 140, marginVertical: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  adLabel: { position: 'absolute', top: 10, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  adLabelText: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '900' },
  reserved: { color: 'rgba(255,255,255,0.76)', fontSize: 12, fontWeight: '700' },
  advertiserInfo: { paddingBottom: 12 },
  advertiserName: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  headline: { color: '#FFFFFF', fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 5 },
  body: { color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 20, marginTop: 6 },
  advertiserDescription: { color: 'rgba(255,255,255,0.76)', fontSize: 11, lineHeight: 15, marginTop: 7 },
  cta: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { color: '#1C3550', fontSize: 14, fontWeight: '900' },
});