import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, IconButton } from '@/components/OldTimeUi';
import { Post, resolveMediaSource, useOldTime } from '@/context/OldTimeContext';
import { useColors } from '@/hooks/useColors';

function InlineVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  return <VideoView player={player} style={styles.postImage} contentFit="cover" nativeControls={false} />;
}

export function PostCard({ post, onComments, onShare, onReport }: { post: Post; onComments: () => void; onShare: () => void; onReport: () => void }) {
  const colors = useColors();
  const { toggleLike, users } = useOldTime();
  const author = users.find((user) => user.id === post.authorId);

  return (
    <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.postHeader}>
        <Avatar source={post.avatar} name={post.author} size={40} accent={author?.accent} />
        <View style={styles.authorText}>
          <View style={styles.nameLine}><Text style={[styles.authorName, { color: colors.foreground }]}>{post.author}</Text><Ionicons name="checkmark-circle" size={14} color={colors.primary} /></View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Post options" onPress={onReport} style={styles.moreButton}><Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} /></Pressable>
      </View>
      {post.mediaType === 'quote' ? <View style={[styles.quoteCard, { backgroundColor: colors.secondary }]}><Text style={[styles.quoteMark, { color: colors.primary }]}>“</Text><Text style={[styles.quoteText, { color: colors.foreground }]}>{post.caption}</Text></View> : <View style={styles.mediaWrap}>
        {post.mediaType === 'video' && typeof post.imageUri === 'string' ? <InlineVideo uri={post.imageUri} /> : <Image source={resolveMediaSource(post.imageUri)} style={styles.postImage} resizeMode="cover" />}
        {post.mediaType === 'video' ? <View style={styles.playBadge}><Ionicons name="play" size={17} color="#fffaf4" /></View> : null}
      </View>}
      <View style={styles.postBody}>
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={post.likedByMe ? 'Unlike post' : 'Like post'} onPress={() => toggleLike(post.id)} style={styles.actionButton}>
            <Ionicons name={post.likedByMe ? 'heart' : 'heart-outline'} size={25} color={post.likedByMe ? colors.softRed : colors.foreground} />
            <Text style={[styles.actionCount, { color: colors.foreground }]}>{post.likes.toLocaleString()}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="View comments" onPress={onComments} style={styles.actionButton}>
            <Ionicons name="chatbubble-ellipses-outline" size={23} color={colors.foreground} />
            <Text style={[styles.actionCount, { color: colors.foreground }]}>{post.comments.length}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Share post" onPress={onShare} style={styles.actionButton}><Ionicons name="arrow-redo-outline" size={24} color={colors.foreground} /></Pressable>
          <View style={styles.spacer} />
        </View>
        {post.mediaType !== 'quote' && post.caption ? <Text style={[styles.caption, { color: colors.foreground }]}><Text style={styles.captionName}>@{post.handle} </Text>{post.caption}</Text> : null}
      </View>
    </View>
  );
}

export function CommentsModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addComment } = useOldTime();
  const [comment, setComment] = useState('');
  const submit = () => {
    if (!comment.trim()) return;
    addComment(post.id, comment.trim());
    setComment('');
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.commentSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Comments <Text style={{ color: colors.mutedForeground, fontWeight: '500' }}>{post.comments.length}</Text></Text><IconButton icon="close" onPress={onClose} accessibilityLabel="Close comments" /></View>
          <ScrollView contentContainerStyle={styles.commentsList}>
            {post.comments.map((item) => <View key={item.id} style={styles.commentRow}><Avatar name={item.author} size={34} /><View style={[styles.commentBubble, { backgroundColor: colors.muted }]}><Text style={[styles.commentAuthor, { color: colors.foreground }]}>{item.author} <Text style={{ color: colors.mutedForeground, fontWeight: '500' }}>@{item.handle}</Text></Text><Text style={[styles.commentText, { color: colors.foreground }]}>{item.text}</Text><Text style={[styles.commentTime, { color: colors.mutedForeground }]}>{item.createdAt}</Text></View></View>)}
          </ScrollView>
          <View style={[styles.commentInputRow, { borderColor: colors.border, backgroundColor: colors.paper }]}><TextInput value={comment} onChangeText={setComment} onSubmitEditing={submit} placeholder="Add a thought..." placeholderTextColor={colors.mutedForeground} style={[styles.commentInput, { color: colors.foreground }]} returnKeyType="send" /><Pressable onPress={submit} style={[styles.sendButton, { backgroundColor: comment.trim() ? colors.primary : colors.muted }]}><Ionicons name="arrow-up" size={18} color={comment.trim() ? colors.primaryForeground : colors.mutedForeground} /></Pressable></View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  postCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  authorText: { flex: 1, marginLeft: 12 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
  moreButton: { width: 40, alignItems: 'center' },
  mediaWrap: { height: 350, backgroundColor: '#2f2522', position: 'relative' },
  postImage: { width: '100%', height: '100%' },
  quoteCard: { minHeight: 300, paddingHorizontal: 36, paddingVertical: 40, justifyContent: 'center' },
  quoteMark: { fontFamily: 'Fraunces_900Black', fontSize: 64, lineHeight: 56 },
  quoteText: { fontFamily: 'Fraunces_700Bold', fontSize: 26, lineHeight: 36 },
  playBadge: { position: 'absolute', left: '50%', top: '50%', marginLeft: -28, marginTop: -28, width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(34,29,26,0.68)', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  postBody: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 46 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  spacer: { flex: 1 },
  caption: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, marginTop: 6 },
  captionName: { fontFamily: 'Outfit_700Bold' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,22,20,0.52)' },
  commentSheet: { minHeight: '58%', maxHeight: '86%', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20 },
  sheetHandle: { alignSelf: 'center', marginTop: 12, marginBottom: 8, width: 48, height: 5, borderRadius: 3, backgroundColor: '#E3DDD1' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 22, marginLeft: 4 },
  commentsList: { paddingVertical: 12, gap: 16 },
  commentRow: { flexDirection: 'row', gap: 12 },
  commentBubble: { flex: 1, borderRadius: 20, padding: 14 },
  commentAuthor: { fontFamily: 'Outfit_700Bold', fontSize: 14, marginBottom: 4 },
  commentText: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 21 },
  commentTime: { fontFamily: 'Outfit_400Regular', fontSize: 12, marginTop: 8 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 24, minHeight: 52, paddingLeft: 16, paddingRight: 6 },
  commentInput: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 15, paddingVertical: 12 },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});