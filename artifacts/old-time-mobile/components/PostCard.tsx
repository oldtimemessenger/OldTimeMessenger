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
    <View style={[styles.postCard, { backgroundColor: colors.background }]}>
      <View style={styles.postHeader}>
        <Avatar source={post.avatar} name={post.author} size={40} accent={author?.accent} />
        <View style={styles.authorText}>
          <View style={styles.nameLine}>
            <Text style={[styles.authorName, { color: colors.foreground }]}>{post.author}</Text>
            {author?.verificationBadge && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
          </View>
          <Text style={[styles.authorHandle, { color: colors.mutedForeground }]}>@{post.handle}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Post options" onPress={onReport} style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>
      
      {post.mediaType === 'quote' ? (
        <View style={[styles.quoteCard, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.quoteMark, { color: colors.mutedForeground }]}>“</Text>
          <Text style={[styles.quoteText, { color: colors.foreground }]}>{post.caption}</Text>
        </View>
      ) : (
        <View style={styles.mediaWrap}>
          {post.mediaType === 'video' && typeof post.imageUri === 'string' ? (
            <InlineVideo uri={post.imageUri} />
          ) : (
            <Image source={resolveMediaSource(post.imageUri)} style={styles.postImage} resizeMode="cover" />
          )}
          {post.mediaType === 'video' && (
            <View style={styles.playBadge}>
              <Ionicons name="play" size={16} color="#fff" />
            </View>
          )}
        </View>
      )}

      <View style={styles.postBody}>
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={post.likedByMe ? 'Unlike post' : 'Like post'} onPress={() => toggleLike(post.id)} style={styles.actionButton}>
            <Ionicons name={post.likedByMe ? 'heart' : 'heart-outline'} size={26} color={post.likedByMe ? colors.action : colors.foreground} />
            <Text style={[styles.actionCount, { color: colors.foreground }]}>{post.likes.toLocaleString()}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="View comments" onPress={onComments} style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.foreground} />
            <Text style={[styles.actionCount, { color: colors.foreground }]}>{post.comments.length}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Share post" onPress={onShare} style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" size={24} color={colors.foreground} />
          </Pressable>
          <View style={styles.spacer} />
        </View>
        {post.mediaType !== 'quote' && post.caption ? (
          <Text style={[styles.caption, { color: colors.foreground }]}>
            <Text style={styles.captionName}>{post.author} </Text>
            {post.caption}
          </Text>
        ) : null}
        <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{post.createdAt}</Text>
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
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Comments <Text style={{ color: colors.mutedForeground, fontFamily: 'NunitoSans_400Regular' }}>{post.comments.length}</Text>
            </Text>
            <IconButton icon="close" onPress={onClose} accessibilityLabel="Close comments" />
          </View>
          <ScrollView contentContainerStyle={styles.commentsList}>
            {post.comments.map((item) => (
              <View key={item.id} style={styles.commentRow}>
                <Avatar name={item.author} size={36} />
                <View style={[styles.commentBubble, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.commentAuthor, { color: colors.foreground }]}>
                    {item.author} <Text style={{ color: colors.mutedForeground, fontFamily: 'NunitoSans_400Regular' }}>@{item.handle}</Text>
                  </Text>
                  <Text style={[styles.commentText, { color: colors.foreground }]}>{item.text}</Text>
                  <Text style={[styles.commentTime, { color: colors.mutedForeground }]}>{item.createdAt}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.commentInputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput value={comment} onChangeText={setComment} onSubmitEditing={submit} placeholder="Add a comment..." placeholderTextColor={colors.mutedForeground} style={[styles.commentInput, { color: colors.foreground }]} returnKeyType="send" />
            <Pressable onPress={submit} style={[styles.sendButton, { backgroundColor: comment.trim() ? colors.action : colors.muted }]}>
              <Ionicons name="arrow-up" size={18} color={comment.trim() ? '#fff' : colors.mutedForeground} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  postCard: { marginBottom: 20 }, // Edge-to-edge container
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  authorText: { flex: 1, marginLeft: 10 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorName: { fontFamily: 'NunitoSans_700Bold', fontSize: 15 },
  authorHandle: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, marginTop: 1 },
  moreButton: { width: 40, alignItems: 'flex-end', justifyContent: 'center' },
  mediaWrap: { width: '100%', aspectRatio: 0.85, backgroundColor: '#111', position: 'relative' },
  postImage: { width: '100%', height: '100%' },
  quoteCard: { aspectRatio: 0.85, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  quoteMark: { fontFamily: 'NunitoSans_900Black', fontSize: 80, position: 'absolute', top: 20, left: 24, opacity: 0.15 },
  quoteText: { fontFamily: 'NunitoSans_700Bold', fontSize: 26, lineHeight: 36, textAlign: 'center' },
  playBadge: { position: 'absolute', right: 16, top: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  postBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
  spacer: { flex: 1 },
  caption: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 20 },
  captionName: { fontFamily: 'NunitoSans_700Bold' },
  timeText: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, marginTop: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  commentSheet: { minHeight: '65%', maxHeight: '86%', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20 },
  sheetHandle: { alignSelf: 'center', marginTop: 12, marginBottom: 8, width: 48, height: 5, borderRadius: 3 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontFamily: 'NunitoSans_900Black', fontSize: 22, marginLeft: 4 },
  commentsList: { paddingVertical: 12, gap: 16 },
  commentRow: { flexDirection: 'row', gap: 12 },
  commentBubble: { flex: 1, borderRadius: 20, padding: 14 },
  commentAuthor: { fontFamily: 'NunitoSans_700Bold', fontSize: 14, marginBottom: 4 },
  commentText: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 21 },
  commentTime: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, marginTop: 8 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 26, minHeight: 52, paddingLeft: 18, paddingRight: 6, marginTop: 12 },
  commentInput: { flex: 1, fontFamily: 'NunitoSans_400Regular', fontSize: 15, paddingVertical: 14 },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
