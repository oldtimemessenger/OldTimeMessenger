import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/OldTimeUi';
import { Post, useOldTime } from '@/context/OldTimeContext';
import { useColors } from '@/hooks/useColors';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';
import { CommentsModal, PostCard } from '@/components/PostCard';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { posts, profile, currentUserId, reportPost, updateProfileAvatar } = useOldTime();
  const router = useRouter();
  const [view, setView] = useState<'posts' | 'liked'>('posts');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const ownPosts = useMemo(() => posts.filter((post) => post.authorId === currentUserId), [currentUserId, posts]);
  const visiblePosts = view === 'posts' ? ownPosts : posts.filter((post) => post.likedByMe);
  const selectedPost = posts.find((post) => post.id === selectedPostId);

  const chooseProfilePhoto = async () => {
    Alert.alert('Profile photo', 'Choose a photo source.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take photo',
        onPress: () => void pickFromCamera(),
      },
      {
        text: 'Photo library',
        onPress: () => void pickFromLibrary(),
      },
    ]);
  };

  const savePickedPhoto = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      await updateProfileAvatar({
        uri: asset.uri,
        contentType: asset.mimeType ?? 'image/jpeg',
        size: asset.fileSize,
      });
    } catch (error) {
      Alert.alert('Could not update photo', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to take a profile photo.');
      return;
    }
    await savePickedPhoto(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 }));
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to choose a profile photo.');
      return;
    }
    await savePickedPhoto(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 }));
  };

  const shareProfile = async () => {
    if (!profile) return;
    try {
      await Share.share({ message: `Find @${profile.handle} on Old Time.` });
    } catch {
      Alert.alert('Could not share profile', 'Please try again.');
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: TAB_BAR_CONTENT_CLEARANCE }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Profile</Text>
        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={shareProfile} style={[styles.headerAction, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="arrow-redo-outline" size={19} color={colors.foreground} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings' as never)} style={[styles.headerAction, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="settings-outline" size={19} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      <View style={styles.profileHeader}>
        <Avatar source={profile?.avatar} name={profile?.name} size={104} accent={profile?.accent} onPress={() => void chooseProfilePhoto()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a post"
          onPress={() => router.push('/(tabs)/create' as never)}
          style={[styles.createButton, { backgroundColor: colors.action, borderColor: colors.background }]}
        >
          <Ionicons name="add" size={25} color={colors.primaryForeground} />
        </Pressable>
        <View style={styles.profileIdentity}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>{profile?.name ?? 'Your profile'}</Text>
            {profile?.verificationBadge ? <Ionicons accessibilityLabel="Verified profile" name="checkmark-circle" size={19} color={colors.primary} /> : null}
          </View>
          <Text style={[styles.handle, { color: colors.mutedForeground }]}>{profile ? `@${profile.handle}` : 'Loading profile…'}</Text>
        </View>
      </View>
      <Text style={[styles.bio, { color: colors.foreground }]}>{profile?.bio || 'Add a little about yourself so people know what Old Time means to you.'}</Text>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPress={() => router.push('/edit-profile' as never)}
          style={[styles.editProfileButton, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Ionicons name="create-outline" size={16} color={colors.foreground} />
          <Text style={[styles.editProfileText, { color: colors.foreground }]}>Edit profile</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Creator Hub"
          onPress={() => router.push('/creator-hub' as never)}
          style={[styles.hubButton, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Ionicons name="briefcase-outline" size={16} color={colors.foreground} />
          <Text style={[styles.hubButtonText, { color: colors.foreground }]}>Creator Hub</Text>
        </Pressable>
      </View>
      <View style={styles.stats}>
        <Text style={[styles.statInline, { color: colors.foreground }]}><Text style={styles.statNumber}>{profile?.followers ?? 0}</Text> followers</Text>
        <Text style={[styles.statInline, { color: colors.foreground }]}><Text style={styles.statNumber}>{profile?.following ?? 0}</Text> following</Text>
      </View>

      <View style={[styles.segment, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => setView('posts')} style={styles.segmentItem}><Ionicons name="grid-outline" size={19} color={view === 'posts' ? colors.foreground : colors.mutedForeground} />{view === 'posts' ? <View style={[styles.segmentLine, { backgroundColor: colors.foreground }]} /> : null}</Pressable>
        <Pressable onPress={() => setView('liked')} style={styles.segmentItem}><Ionicons name="heart-outline" size={20} color={view === 'liked' ? colors.foreground : colors.mutedForeground} />{view === 'liked' ? <View style={[styles.segmentLine, { backgroundColor: colors.foreground }]} /> : null}</Pressable>
      </View>

      {visiblePosts.length
        ? <View style={styles.postList}>{visiblePosts.map((post) => <PostCard key={post.id} post={post} onComments={() => setSelectedPostId(post.id)} onShare={() => void Share.share({ message: post.mediaType === 'quote' ? `“${post.caption}”\n— @${post.handle} on Old Time` : `Shared by @${post.handle} on Old Time` })} onReport={() => Alert.alert('Report this post?', 'Choose a reason to send this to the Old Time moderation queue.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Spam', onPress: () => void reportPost(post.id, 'spam') }, { text: 'Harassment', onPress: () => void reportPost(post.id, 'harassment') }, { text: 'Other', onPress: () => void reportPost(post.id, 'other') }])} />)}</View>
         : <View style={styles.likedEmpty}><Ionicons name={view === 'posts' ? 'images-outline' : 'heart-outline'} size={28} color={colors.foreground} /><Text style={[styles.likedTitle, { color: colors.foreground }]}>{view === 'posts' ? 'No posts yet.' : 'No liked posts yet.'}</Text><Text style={[styles.likedBody, { color: colors.mutedForeground }]}>{view === 'posts' ? 'Share your first moment from Create.' : 'Posts you like will appear here.'}</Text></View>}
      {selectedPost ? <CommentsModal post={selectedPost} onClose={() => setSelectedPostId(null)} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  topTitle: { fontFamily: 'Fraunces_900Black', fontSize: 26 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAction: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  createButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginLeft: -18, marginRight: 12, borderWidth: 3 },
  profileIdentity: { marginLeft: 16, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { fontFamily: 'Fraunces_700Bold', fontSize: 24 },
  handle: { fontFamily: 'Outfit_500Medium', fontSize: 14, marginTop: 4 },
  bio: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, minHeight: 22, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  editProfileButton: { minHeight: 38, borderRadius: 19, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  editProfileText: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  hubButton: { minHeight: 38, borderRadius: 19, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  hubButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 20 },
  statInline: { fontFamily: 'Outfit_400Regular', fontSize: 14 },
  statNumber: { fontFamily: 'Outfit_700Bold' },
  segment: { flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  segmentItem: { paddingHorizontal: 24, paddingVertical: 14, position: 'relative' },
  segmentLine: { height: 3, borderRadius: 3, position: 'absolute', bottom: -1, left: 6, right: 6 },
  postList: { marginTop: 0 },
  likedEmpty: { alignItems: 'center', paddingTop: 64 },
  likedTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 20, marginTop: 14 },
  likedBody: { fontFamily: 'Outfit_400Regular', fontSize: 15, marginTop: 6 },
});