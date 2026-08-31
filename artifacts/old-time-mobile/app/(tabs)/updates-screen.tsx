import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import {
  Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  FlatList, Dimensions, Platform, Share
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, EmptyState, IconButton, Screen, SectionLabel } from '@/components/ui';
import { useApp, type StatusItem, type UpdatePost } from '@/context/app-state';
import { INTEREST_OPTIONS, rankForYou } from '@/lib/for-you';
import { useColors } from '@/hooks/useColors';
import { VideoSurface } from '@/components/video-surface';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const postColors = ['#3B8FD6', '#5F91B8', '#447AA4', '#6388A6', '#3E6D91', '#6A94B2'];
const creatorTags = ['comedy', 'music', 'food', 'fitness', 'travel', 'technology', 'art', 'sports'];
type FeedTab = 'for-you' | 'following' | 'interests';

function timeAgo(createdAt: number) {
  const hours = Math.floor((Date.now() - createdAt) / 3600000);
  if (hours < 1) return 'Just now';
  return `${hours}h ago`;
}

type StatusUserGroup = {
  author: string;
  items: StatusItem[];
  seen: boolean;
};

export default function UpdatesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { mediaUri, mediaType } = useLocalSearchParams<{
    mediaUri?: string;
    mediaType?: 'photo' | 'video';
  }>();
  const { statuses, posts, interests, interestWeights, followedCreators, hiddenPostIds, addStatus, markStatusViewed, addPost, togglePostLike, togglePostSaved, addPostComment, recordPostInteraction, toggleInterest, toggleFollow, hidePost: persistHiddenPost } = useApp();

  const [viewMode, setViewMode] = useState<'landing' | 'feed' | 'status'>('landing');
  const [tab, setTab] = useState<FeedTab>('for-you');
  const [feedIndex, setFeedIndex] = useState(0);
  const [storyGroupOpen, setStoryGroupOpen] = useState<StatusUserGroup | null>(null);
  const [compose, setCompose] = useState<'status' | 'post' | null>(null);
  const [commentPost, setCommentPost] = useState<UpdatePost | null>(null);
  const [profileOpen, setProfileOpen] = useState<string | null>(null);
  const [capturedStatusMedia, setCapturedStatusMedia] = useState<{
    uri: string;
    type: 'photo' | 'video';
  } | null>(null);

  useEffect(() => {
    if (!mediaUri) return;
    setCapturedStatusMedia({
      uri: mediaUri,
      type: mediaType === 'video' ? 'video' : 'photo',
    });
    setCompose('status');
    router.setParams({ mediaUri: undefined, mediaType: undefined });
  }, [mediaUri]);

  const now = Date.now();
  const activeStatuses = statuses.filter(s => now - s.createdAt < 86400000);
  const statusGroups = useMemo(() => {
    const groups: Record<string, StatusUserGroup> = {};
    activeStatuses.forEach(s => {
      if (!groups[s.author]) {
        groups[s.author] = { author: s.author, items: [], seen: true };
      }
      groups[s.author].items.push(s);
      if (!s.viewed) groups[s.author].seen = false;
    });

    Object.values(groups).forEach(g => g.items.sort((a, b) => a.createdAt - b.createdAt));

    return Object.values(groups).sort((a, b) => {
      if (a.author === 'You') return -1;
      if (b.author === 'You') return 1;
      if (a.seen !== b.seen) return a.seen ? 1 : -1;
      return b.items[b.items.length -1].createdAt - a.items[a.items.length -1].createdAt;
    });
  }, [activeStatuses]);

  const myGroup = statusGroups.find(g => g.author === 'You');
  const otherGroups = statusGroups.filter(g => g.author !== 'You');

  const forYouPosts = useMemo(() => rankForYou(posts.filter((post) => !hiddenPostIds.includes(post.id)), interests, interestWeights), [posts, interests, interestWeights, hiddenPostIds]);
  const followingPosts = useMemo(() => posts.filter((post) => followedCreators.includes(post.handle) && !hiddenPostIds.includes(post.id)), [posts, followedCreators, hiddenPostIds]);
  const visiblePosts = tab === 'following' ? followingPosts : forYouPosts;

  function hidePost(post: UpdatePost) {
    persistHiddenPost(post.id);
    recordPostInteraction(post.id, 'hide');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="updates-screen">
      <Screen title="Updates" right={<IconButton name="camera-outline" label="Create update" onPress={() => setCompose('status')} />}>
         <FlatList
           testID="landing-grid"
           data={tab === 'interests' ? [] : visiblePosts}
           numColumns={3}
           keyExtractor={item => item.id}
           columnWrapperStyle={{ gap: 2 }}
           ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
           contentContainerStyle={{ paddingHorizontal: 2, paddingBottom: 100 }}
           showsVerticalScrollIndicator={false}
           ListHeaderComponent={<>
              <StatusRail myGroup={myGroup} otherGroups={otherGroups} colors={colors} onCreate={() => setCompose('status')} onOpenGroup={g => { setStoryGroupOpen(g); setViewMode('status'); }} />

              <View style={[styles.feedTabs, { borderBottomColor: colors.border }]}>
                {(['for-you', 'following', 'interests'] as FeedTab[]).map(item => (
                  <Pressable key={item} testID={`tab-${item}`} onPress={() => setTab(item)} style={[styles.feedTab, tab === item && { borderBottomColor: colors.primary }]}>
                    <Text style={[styles.feedTabText, { color: tab === item ? colors.primary : colors.mutedForeground }]}>{item === 'for-you' ? 'For You' : item === 'following' ? 'Following' : 'Interests'}</Text>
                  </Pressable>
                ))}
              </View>

              {tab === 'interests' && <InterestPanel interests={interests} interestWeights={interestWeights} onToggle={toggleInterest} onBack={() => setTab('for-you')} colors={colors} />}

              {tab !== 'interests' && visiblePosts.length === 0 && (
                <EmptyState icon="people-outline" title={tab === 'following' ? 'Follow a creator' : 'Choose some interests'} description={tab === 'following' ? 'Follow creators from a story to build your Following feed.' : 'Choose topics so For You knows what to prioritize.'} action={<Pressable onPress={() => setTab(tab === 'following' ? 'for-you' : 'interests')}><Text style={{ color: colors.primary, fontWeight: '700' }}>{tab === 'following' ? 'Open For You' : 'Set interests'}</Text></Pressable>} />
              )}
           </>}
           renderItem={({ item, index }) => (
             <Pressable testID={`grid-item-${item.id}`} onPress={() => { setFeedIndex(index); setViewMode('feed'); }} style={{ width: (WINDOW_WIDTH - 8) / 3, aspectRatio: 3/4, backgroundColor: item.color, justifyContent: 'flex-end', padding: 8 }}>
               {(item as any).uri ? (
                 <Image source={{ uri: (item as any).uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
               ) : null}
               <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="play-outline" size={12} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{item.likes}</Text>
               </View>
             </Pressable>
           )}
         />
      </Screen>

      <Modal visible={viewMode === 'feed'} transparent animationType="slide" onRequestClose={() => setViewMode('landing')}>
        {viewMode === 'feed' ? (
         <FeedPager
            posts={visiblePosts}
            initialIndex={feedIndex}
            onClose={() => setViewMode('landing')}
            colors={colors}
            onLike={(id: string) => { togglePostLike(id); recordPostInteraction(id, 'like'); }}
            onSave={(id: string) => { togglePostSaved(id); recordPostInteraction(id, 'save'); }}
            onComment={(post: UpdatePost) => { recordPostInteraction(post.id, 'comment'); setCommentPost(post); }}
            onShare={(id: string) => {
              const post = posts.find((item) => item.id === id);
              if (!post) return;
              recordPostInteraction(id, 'share');
              void Share.share({ message: `${post.author} on Old Time:\n\n${post.caption}` });
            }}
            onOpenProfile={(handle: string) => setProfileOpen(handle)}
            onFollow={(handle: string) => toggleFollow(handle)}
            followedCreators={followedCreators}
            onHide={(post: UpdatePost) => hidePost(post)}
            onOpen={(id: string) => recordPostInteraction(id, 'open')}
         />
        ) : null}
      </Modal>

      <Modal visible={viewMode === 'status'} transparent animationType="fade" onRequestClose={() => setViewMode('landing')}>
        {storyGroupOpen && (
          <StatusViewer
             initialGroup={storyGroupOpen}
             allGroups={statusGroups}
             onClose={() => { setStoryGroupOpen(null); setViewMode('landing'); }}
             colors={colors}
             onMarkViewed={(id: string) => markStatusViewed(id, 'You')}
          />
        )}
      </Modal>

      <Modal visible={compose !== null} transparent animationType="slide" onRequestClose={() => setCompose(null)}>
        {compose && (
          <ComposeModal
             type={compose}
              initialMediaUri={capturedStatusMedia?.uri}
              initialMediaType={capturedStatusMedia?.type}
             onClose={() => setCompose(null)}
             colors={colors}
             onPublish={(data: any) => {
               if (compose === 'status') {
                 addStatus(data.caption, data.color, data.type as any, data.uri, data.audience as any);
               } else {
                 addPost(data.caption, data.tag!, data.color);
               }
                setCapturedStatusMedia(null);
               setCompose(null);
             }}
          />
        )}
      </Modal>

      <Modal visible={commentPost !== null} transparent animationType="slide" onRequestClose={() => setCommentPost(null)}>
        {commentPost ? (
          <CommentSheet post={commentPost} onClose={() => setCommentPost(null)} colors={colors} onAdd={(text: string) => { addPostComment(commentPost.id, text); }} />
        ) : null}
      </Modal>

      <Modal visible={profileOpen !== null} transparent animationType="slide" onRequestClose={() => setProfileOpen(null)}>
        {profileOpen ? (
          <ProfileSheet handle={profileOpen} onClose={() => setProfileOpen(null)} colors={colors} followed={followedCreators.includes(profileOpen)} onFollow={() => toggleFollow(profileOpen)} />
        ) : null}
      </Modal>

    </View>
  );
}

function StatusRail({ myGroup, otherGroups, colors, onCreate, onOpenGroup }: { myGroup?: StatusUserGroup; otherGroups: StatusUserGroup[]; colors: any; onCreate: () => void; onOpenGroup: (g: StatusUserGroup) => void }) {
  return (
    <View style={{ paddingVertical: 12 }} testID="status-rail">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
        <Pressable onPress={myGroup ? () => onOpenGroup(myGroup) : onCreate} style={{ alignItems: 'center', width: 68 }} testID="my-status">
           <View style={{ width: 64, height: 64, borderRadius: 32, padding: 2, borderWidth: 2, borderColor: myGroup ? (myGroup.seen ? colors.border : colors.primary) : 'transparent' }}>
             <Avatar name="You" size={56} color={myGroup ? myGroup.items[0].color : colors.muted} />
             <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background }}>
               <Ionicons name="add" size={16} color="#fff" />
             </View>
           </View>
           <Text style={{ fontSize: 11, marginTop: 6, color: colors.foreground, fontWeight: '500' }}>Your status</Text>
        </Pressable>

        {otherGroups.map(group => (
           <Pressable key={group.author} onPress={() => onOpenGroup(group)} style={{ alignItems: 'center', width: 68 }} testID={`status-group-${group.author}`}>
             <View style={{ width: 64, height: 64, borderRadius: 32, padding: 2, borderWidth: 2, borderColor: group.seen ? colors.border : colors.primary }}>
               <Avatar name={group.author} size={56} color={group.items[0].color} />
             </View>
             <Text style={{ fontSize: 11, marginTop: 6, color: colors.foreground, fontWeight: '500' }} numberOfLines={1}>{group.author}</Text>
           </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function FeedPager({ posts, initialIndex, onClose, colors, onLike, onSave, onComment, onShare, onFollow, followedCreators, onHide, onOpen, onOpenProfile }: any) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const firstVisible = viewableItems.find((entry: any) => entry?.item?.id);
    if (firstVisible) {
      setCurrentIndex(firstVisible.index ?? 0);
      onOpen(firstVisible.item.id);
    }
  }).current;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="feed-pager">
      <Pressable onPress={onClose} style={{ position: 'absolute', top: Math.max(insets.top, 20) + 10, left: 16, zIndex: 50, padding: 8 }}>
        <Ionicons name="chevron-back" size={30} color="#fff" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 }} />
      </Pressable>

      <FlatList
        data={posts}
        keyExtractor={(item: any) => item.id}
        pagingEnabled
        snapToInterval={WINDOW_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(data, index) => ({ length: WINDOW_HEIGHT, offset: WINDOW_HEIGHT * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index }) => (
           <FeedPost
             post={item}
             active={index === currentIndex}
             colors={colors}
             onLike={() => onLike(item.id)}
             onSave={() => onSave(item.id)}
             onComment={() => onComment(item)}
             onShare={() => onShare(item.id)}
             onFollow={() => onFollow(item.handle)}
             followed={followedCreators.includes(item.handle)}
             onHide={() => { onHide(item); onClose(); }}
             onOpenProfile={() => { onOpenProfile(item.handle); onClose(); }}
           />
        )}
      />
    </View>
  );
}

function FeedPost({ post, active, followed, onLike, onSave, onComment, onShare, onFollow, onHide, onOpenProfile, colors }: any) {
  const [muted, setMuted] = useState(true);
  const [showHeart, setShowHeart] = useState(false);

  function doubleTap() {
    if (!post.liked) onLike();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 700);
  }

  return (
    <View style={{ width: WINDOW_WIDTH, height: WINDOW_HEIGHT, backgroundColor: post.color }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={doubleTap} />

      {post.uri && (post as UpdatePost & { type?: string }).type === 'video' ? (
        <VideoSurface source={post.uri} style={StyleSheet.absoluteFill} muted paused />
      ) : post.uri ? (
        <Image source={{ uri: post.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: post.color, justifyContent: 'center', alignItems: 'center' }]}>
           <View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,255,255,0.08)', right: -100, top: -50 }} />
        </View>
      )}

      {showHeart && (
         <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }]}>
           <Ionicons name="heart" size={120} color="#fff" style={{ opacity: 0.8 }} />
         </View>
      )}

      <Pressable onPress={() => setMuted(!muted)} style={{ position: 'absolute', top: 60, right: 16, backgroundColor: 'rgba(0,0,0,0.3)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={muted ? "volume-mute" : "volume-medium"} size={20} color="#fff" />
      </Pressable>

      <View style={{ position: 'absolute', right: 12, bottom: 120, alignItems: 'center', gap: 20 }}>
         <View style={{ alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#fff', overflow: 'hidden' }}>
              <Avatar name={post.author} size={44} color={post.color} />
            </View>
            {!followed && (
               <Pressable onPress={onFollow} style={{ position: 'absolute', bottom: -10, backgroundColor: colors.primary, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                 <Ionicons name="add" size={16} color="#fff" />
               </Pressable>
            )}
         </View>

         <Pressable onPress={onLike} style={{ alignItems: 'center' }}>
           <Ionicons name={post.liked ? "heart" : "heart-outline"} size={36} color={post.liked ? "#FFD54A" : "#fff"} />
           <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 }}>{post.likes}</Text>
         </Pressable>

         <Pressable onPress={onComment} style={{ alignItems: 'center' }}>
           <Ionicons name="chatbubble-ellipses-outline" size={34} color="#fff" />
           <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 }}>{post.comments.length}</Text>
         </Pressable>

         <Pressable onPress={onSave} style={{ alignItems: 'center' }}>
           <Ionicons name={post.saved ? "bookmark" : "bookmark-outline"} size={32} color={post.saved ? "#FFD54A" : "#fff"} />
           <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 }}>Save</Text>
         </Pressable>

         <Pressable onPress={onShare} style={{ alignItems: 'center' }}>
           <Ionicons name="arrow-redo-outline" size={34} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
           <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 }}>Share</Text>
         </Pressable>

         <Pressable onPress={onHide} style={{ alignItems: 'center', marginTop: 10 }}>
           <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
         </Pressable>
      </View>

      <View style={{ position: 'absolute', left: 16, right: 80, bottom: 40 }}>
         <Pressable onPress={onOpenProfile}>
           <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>@{post.handle}</Text>
         </Pressable>
         <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22, marginBottom: 8 }}>{post.caption}</Text>
         <Text style={{ color: '#FFD54A', fontSize: 14, fontWeight: '600', marginBottom: 12 }}>#{post.tag}</Text>
         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
           <Ionicons name="musical-note" size={14} color="#fff" />
           <Text style={{ color: '#fff', fontSize: 13, opacity: 0.9 }}>{post.author} · Original sound</Text>
         </View>
      </View>
    </View>
  );
}

function StatusViewer({ initialGroup, allGroups, onClose, colors, onMarkViewed }: any) {
  const insets = useSafeAreaInsets();
  const [groupIndex, setGroupIndex] = useState(() => allGroups.findIndex((g: any) => g.author === initialGroup.author));
  const [itemIndex, setItemIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);

  const group = allGroups[groupIndex] || allGroups[0];
  const item = group?.items[itemIndex];

  useEffect(() => {
    if (item && !item.viewed) {
      onMarkViewed(item.id);
    }
  }, [item?.id, item?.viewed, onMarkViewed]);

  const DURATION = 5000;

  useEffect(() => {
    if (paused || !group) return;
    let start = Date.now() - progress * DURATION;
    let frame: number;
    function tick() {
      const now = Date.now();
      const p = (now - start) / DURATION;
      if (p >= 1) {
         handleNext();
      } else {
         setProgress(p);
         frame = requestAnimationFrame(tick);
      }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [groupIndex, itemIndex, paused, progress, group]);

  function handleNext() {
    if (!group) return;
    if (itemIndex < group.items.length - 1) {
      setItemIndex(i => i + 1);
      setProgress(0);
    } else if (groupIndex < allGroups.length - 1) {
      setGroupIndex((i: number) => i + 1);
      setItemIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }

  function handlePrev() {
    if (!group) return;
    if (itemIndex > 0) {
      setItemIndex(i => i - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex((i: number) => i - 1);
      setItemIndex(allGroups[groupIndex - 1].items.length - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  }

  if (!group || !item) return null;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: item.color }} testID="status-viewer">
       {item.uri && item.type === 'video' ? (
         <VideoSurface source={item.uri} style={StyleSheet.absoluteFill} muted={muted} paused={paused} />
       ) : item.uri ? (
         <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
       ) : null}
       <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />

       <View style={{ flexDirection: 'row', gap: 4, position: 'absolute', top: Math.max(insets.top, 20) + 10, left: 16, right: 16, zIndex: 10 }}>
         {group.items.map((_: any, idx: number) => (
           <View key={idx} style={{ flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
             <View style={{ height: '100%', backgroundColor: '#fff', width: idx < itemIndex ? '100%' : idx === itemIndex ? `${progress * 100}%` : '0%' }} />
           </View>
         ))}
       </View>

       <View style={{ flexDirection: 'row', alignItems: 'center', position: 'absolute', top: Math.max(insets.top, 20) + 24, left: 16, right: 16, zIndex: 10, gap: 10 }}>
         <Avatar name={group.author} size={36} color="rgba(255,255,255,0.2)" />
         <View style={{ flex: 1 }}>
           <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{group.author}</Text>
           <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{timeAgo(item.createdAt)}</Text>
         </View>
         {group.author === 'You' && (
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
             <Ionicons name="eye" size={14} color="#fff" />
             <Text style={{ color: '#fff', fontSize: 12 }}>{item.viewers?.length || 0}</Text>
           </View>
         )}
         <Pressable onPress={() => setPaused(!paused)} style={{ padding: 4 }}>
           <Ionicons name={paused ? "play" : "pause"} size={22} color="#fff" />
         </Pressable>
         {item.type === 'video' ? (
           <Pressable onPress={() => setMuted((value) => !value)} style={{ padding: 4 }}>
             <Ionicons name={muted ? "volume-mute" : "volume-medium"} size={22} color="#fff" />
           </Pressable>
         ) : null}
         <Pressable onPress={onClose} style={{ padding: 4 }}>
           <Ionicons name="close" size={26} color="#fff" />
         </Pressable>
       </View>

       <Pressable style={{ position: 'absolute', left: 0, top: 100, bottom: 100, width: '30%', zIndex: 5 }} onPress={handlePrev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
       <Pressable style={{ position: 'absolute', right: 0, top: 100, bottom: 100, width: '70%', zIndex: 5 }} onPress={handleNext} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />

       {!item.uri || item.type === 'text' ? (
         <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, pointerEvents: 'none' }}>
           <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 }}>{item.caption}</Text>
         </View>
       ) : (
         <View style={{ flex: 1, pointerEvents: 'none', justifyContent: 'flex-end', padding: 20, paddingBottom: 100 }}>
           {item.caption ? <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 }}>{item.caption}</Text> : null}
         </View>
       )}

    </KeyboardAvoidingView>
  );
}

function ComposeModal({ type, onClose, onPublish, colors, initialMediaUri, initialMediaType }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [selectedColor, setSelectedColor] = useState(postColors[0]);
  const [tag, setTag] = useState(creatorTags[0]);
  const [audience, setAudience] = useState<'everyone' | 'close_friends'>('everyone');
  const [mediaUri, setMediaUri] = useState<string | null>(initialMediaUri ?? null);
  const [selectedMediaType, setSelectedMediaType] = useState<'photo' | 'video'>(
    initialMediaType === 'video' ? 'video' : 'photo',
  );

  async function pickMedia() {
    const ImagePicker = await import('expo-image-picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setMediaUri(result.assets[0].uri);
      setSelectedMediaType(result.assets[0].type === 'video' ? 'video' : 'photo');
    }
  }

  function handlePublish() {
    if (!draft.trim() && !mediaUri) return;
    if (type === 'status') {
       onPublish({ caption: draft.trim(), color: selectedColor, type: mediaUri ? selectedMediaType : 'text', uri: mediaUri, audience });
    } else {
       onPublish({ caption: draft.trim(), tag, color: selectedColor, uri: mediaUri });
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: selectedColor }} testID="compose-modal">
      {mediaUri && (
        <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: mediaUri ? 'rgba(0,0,0,0.4)' : 'transparent' }]} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Math.max(insets.top, 20) + 10 }}>
        <IconButton name="close" color="#fff" onPress={onClose} />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{type === 'status' ? 'New status' : 'New post'}</Text>
        <Pressable onPress={handlePublish} style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
          <Text style={{ color: '#000', fontWeight: '800', fontSize: 14 }}>Post</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
         <TextInput
           autoFocus
           value={draft}
           onChangeText={setDraft}
           placeholder={type === 'status' ? 'Type a status...' : 'Write a caption...'}
           placeholderTextColor="rgba(255,255,255,0.7)"
           multiline
           style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 }}
         />
      </View>

      <View style={{ paddingBottom: Math.max(insets.bottom, 20) + 20, paddingHorizontal: 16, gap: 20 }}>
         {type === 'status' && (
           <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
             <Pressable onPress={() => setAudience('everyone')} style={{ backgroundColor: audience === 'everyone' ? '#fff' : 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
               <Text style={{ color: audience === 'everyone' ? '#000' : '#fff', fontWeight: '700', fontSize: 13 }}>Everyone</Text>
             </Pressable>
             <Pressable onPress={() => setAudience('close_friends')} style={{ backgroundColor: audience === 'close_friends' ? '#26A69A' : 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
               <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Close Friends</Text>
             </Pressable>
           </View>
         )}

         {type === 'post' && (
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
             {creatorTags.map(item => (
               <Pressable key={item} onPress={() => setTag(item)} style={{ backgroundColor: tag === item ? '#fff' : 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                 <Text style={{ color: tag === item ? '#000' : '#fff', fontWeight: '700', fontSize: 13 }}>#{item}</Text>
               </Pressable>
             ))}
           </ScrollView>
         )}

         <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
             <Pressable onPress={() => { onClose(); router.push({ pathname: '/camera', params: { returnTo: 'status' } }); }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="camera" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={pickMedia} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Ionicons name="image" size={22} color="#fff" />
            </Pressable>
            {postColors.map(c => (
              <Pressable key={c} onPress={() => setSelectedColor(c)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 3, borderColor: selectedColor === c ? '#fff' : 'transparent' }} />
            ))}
         </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentSheet({ post, onClose, colors, onAdd }: any) {
  const [text, setText] = useState('');
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: WINDOW_HEIGHT * 0.7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>{post?.comments.length || 0} comments</Text>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <ScrollView style={{ maxHeight: 300 }}>
           {post?.comments.map((c: string, i: number) => (
             <View key={i} style={{ paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
               <Text style={{ color: colors.foreground, fontSize: 15 }}>{c}</Text>
             </View>
           ))}
           {!post?.comments.length && (
             <EmptyState icon="chatbubbles-outline" title="No comments" description="Be the first to comment!" />
           )}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
           <TextInput
             value={text}
             onChangeText={setText}
             placeholder="Add a comment..."
             placeholderTextColor={colors.mutedForeground}
             style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: colors.secondary, paddingHorizontal: 16, color: colors.foreground }}
             onSubmitEditing={() => { if(text.trim()) { onAdd(text.trim()); setText(''); } }}
           />
           <Pressable onPress={() => { if(text.trim()) { onAdd(text.trim()); setText(''); } }}>
             <Ionicons name="send" size={24} color={colors.primary} />
           </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function InterestPanel({ interests, interestWeights, onToggle, onBack, colors }: any) {
  const [locationEnabled, setLocationEnabled] = useState(false);
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((permission) => setLocationEnabled(permission.granted)).catch(() => setLocationEnabled(false));
  }, []);

  async function handleToggle(interest: string) {
    if (interest !== 'nearby' || interests.includes(interest)) {
      onToggle(interest);
      return;
    }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Location permission needed', 'Allow location access to personalize stories around you. You can still use every other interest without it.');
      return;
    }
    setLocationEnabled(true);
    onToggle(interest);
  }

  return (
    <ScrollView contentContainerStyle={styles.interestContent} showsVerticalScrollIndicator={false}>
      <View style={styles.interestHeading}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.interestTitle, { color: colors.foreground }]}>Interests</Text>
          <Text style={[styles.interestSubtitle, { color: colors.mutedForeground }]}>Choose what Old Time should prioritize in For You.</Text>
        </View>
        <Ionicons name="options-outline" size={25} color={colors.primary} />
      </View>
      <View style={styles.interestGrid}>{INTEREST_OPTIONS.map((interest) => {
        const selected = interests.includes(interest.id);
        const description = interest.id === 'nearby' && !locationEnabled ? 'Enable location for nearby stories when permission is not granted' : interest.description;
        return (
          <Pressable key={interest.id} onPress={() => void handleToggle(interest.id)} style={[styles.interestChip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}>
            <View style={[styles.check, { backgroundColor: selected ? '#fff' : colors.muted }]}>{selected ? <Ionicons name="checkmark" size={13} color={colors.primary} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.interestLabel, { color: selected ? '#fff' : colors.foreground }]}>{interest.label}</Text>
              <Text style={[styles.interestDescription, { color: selected ? 'rgba(255,255,255,0.8)' : colors.mutedForeground }]}>{description}</Text>
            </View>
            {interest.id === 'nearby' ? <Ionicons name="location-outline" size={17} color={selected ? '#fff' : colors.primary} /> : null}
          </Pressable>
        );
      })}</View>
      <View style={[styles.learningCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.learningHeader}>
          <Ionicons name="analytics-outline" size={19} color={colors.primary} />
          <Text style={[styles.learningTitle, { color: colors.foreground }]}>Learning from your activity</Text>
        </View>
        <Text style={[styles.learningText, { color: colors.mutedForeground }]}>Likes, saves, comments, shares, opens, and hides shape your For You ranking on this device.</Text>
        {Object.keys(interestWeights).length ? (
          <View style={styles.weightRow}>
            {Object.entries(interestWeights).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 4).map(([key, value]) => (
              <View key={key} style={[styles.weightPill, { backgroundColor: colors.secondary }]}>
                <Text style={{ color: colors.foreground, fontSize: 12 }}>{key} {(value as number) > 0 ? `+${value}` : String(value)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.noSignals, { color: colors.mutedForeground }]}>Your activity signals will appear here as you use Updates.</Text>
        )}
      </View>
      <Pressable onPress={onBack} style={[styles.backButton, { borderColor: colors.primary }]}>
        <Ionicons name="arrow-back" size={17} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Back to For You</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  feedTabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  feedTab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2 },
  feedTabText: { fontWeight: '700', fontSize: 14 },
  interestContent: { paddingBottom: 100 },
  interestHeading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  interestTitle: { fontSize: 23, fontWeight: '800' },
  interestSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  interestGrid: { gap: 8 },
  interestChip: { borderWidth: 1, borderRadius: 11, minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  interestLabel: { fontSize: 14, fontWeight: '700' },
  interestDescription: { fontSize: 11, marginTop: 3 },
  learningCard: { borderWidth: 1, borderRadius: 11, padding: 14, marginTop: 18 },
  learningHeader: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  learningTitle: { fontSize: 14, fontWeight: '800' },
  learningText: { fontSize: 12, lineHeight: 17, marginTop: 7 },
  weightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  weightPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14 },
  noSignals: { fontSize: 11, marginTop: 10 },
  pipelineCard: { borderWidth: 1, borderRadius: 11, padding: 14, marginTop: 12 },
  pipelineTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  pipelineNumber: { width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pipelineStep: { fontSize: 12, flex: 1 },
  pipelineStatus: { fontSize: 10, fontWeight: '700' },
  pipelineFootnote: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  backButton: { minHeight: 44, borderWidth: 1, borderRadius: 10, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
});

function ProfileSheet({ handle, onClose, colors, followed, onFollow }: any) {
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 250, alignItems: 'center' }}>
        <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end' }}>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <View style={{ alignItems: 'center', marginTop: -10 }}>
          <Avatar name={handle} size={80} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: 'bold', marginTop: 12 }}>@{handle}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>Creator on Old Time</Text>
          <Pressable onPress={onFollow} style={{ marginTop: 20, backgroundColor: followed ? colors.secondary : colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}>
            <Text style={{ color: followed ? colors.foreground : '#fff', fontWeight: 'bold' }}>{followed ? 'Following' : 'Follow'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
