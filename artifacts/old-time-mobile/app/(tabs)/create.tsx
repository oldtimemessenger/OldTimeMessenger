import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Avatar, IconButton } from '@/components/OldTimeUi';
import { MediaType, useOldTime } from '@/context/OldTimeContext';
import { useCreatorApprovals, useCreatorHubMe } from '@/hooks/useCreatorHub';
import { CreatorHubApi } from '@/lib/api-creator-hub';
import { useAuth } from '@/lib/auth';

const createModes = ['HUBS', 'ROUTES', 'ACCESS', 'PHOTO', 'TEXT'] as const;

function SelectedVideoPreview({ uri, contentFit }: { uri: string; contentFit: 'cover' | 'contain' }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.muted = true;
    instance.loop = true;
    instance.play();
  });
  return <VideoView player={player} style={styles.preview} contentFit={contentFit} nativeControls={false} />;
}

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createPost, createStory, profile } = useOldTime();
  const { getToken } = useAuth();
  const { data: me } = useCreatorHubMe();
  const { data: approvals } = useCreatorApprovals();
  const isCreator = me?.profile?.role === 'creator' && me?.profile?.verificationState === 'approved';

  const { hubId, hubName } = useLocalSearchParams<{ hubId?: string; hubName?: string }>();
  const [postKind, setPostKind] = useState<'media' | 'quote'>('media');
  const [media, setMedia] = useState<{ uri: string; type: MediaType; name: string; mimeType: string; size?: number; width?: number; height?: number; duration?: number } | null>(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [shareMode, setShareMode] = useState<'story' | 'post'>('post');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [captureMode, setCaptureMode] = useState<'picture' | 'video'>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const isTextMode = postKind === 'quote';
  const cameraForeground = isTextMode ? colors.homeForeground : colors.homeBackground;

  const chooseMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access is off', 'Allow photo access in Settings to choose something for your post.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9, videoMaxDuration: 600 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const nextType = asset.type === 'video' ? 'video' : 'image';
      setMedia({
        uri: asset.uri,
        type: nextType,
        name: asset.fileName ?? `old-time.${nextType === 'video' ? 'mp4' : 'jpg'}`,
        mimeType: asset.mimeType ?? (nextType === 'video' ? 'video/mp4' : 'image/jpeg'),
        size: asset.fileSize,
        width: asset.width,
        height: asset.height,
        duration: asset.duration ? asset.duration / 1000 : undefined,
      });
    }
  };

  const openCamera = async (kind: 'photo' | 'video' = 'photo') => {
    try {
      const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert('Camera access is off', 'Allow camera access in Settings to capture a moment.');
        return;
      }
      setPostKind('media');
      setMedia(null);
      setCameraOpen(true);
      setCaptureMode(kind === 'video' ? 'video' : 'picture');
    } catch (error) {
      setIsRecording(false);
      Alert.alert('Could not open camera', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || !cameraOpen || isRecording) return;
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!result?.uri) return;
      setPostKind('media');
      setMedia({
        uri: result.uri,
        type: 'image',
        name: 'old-time-photo.jpg',
        mimeType: 'image/jpeg',
        width: result.width,
        height: result.height,
      });
    } catch (error) {
      Alert.alert('Could not capture photo', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const openHubs = () => router.push('/(tabs)/discover' as never);
  const openAccess = () => router.push('/access' as never);
  const openRoutes = () => router.push('/routes' as never);

  const useCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location stays off', 'You can type a location instead, or leave it blank.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(position.coords);
      const label = [place?.city, place?.region].filter(Boolean).join(', ');
      if (!label) throw new Error('We could not find a place name for your location.');
      setLocation(label);
    } catch (error) {
      Alert.alert('Could not add location', error instanceof Error ? error.message : 'You can type it instead.');
    } finally {
      setIsLocating(false);
    }
  };

  const publish = async () => {
    if (isPublishing) return;
    if (postKind === 'media' && !media) {
      Alert.alert('Choose something first', 'Pick a photo or video to start your post.');
      return;
    }
    if (postKind === 'quote' && !caption.trim()) {
      Alert.alert('Write your quote first', 'Add the words you want to share.');
      return;
    }
    setIsPublishing(true);
    try {
      if (shareMode === 'story') {
        await createStory({
          imageUri: media?.uri,
          mediaType: postKind === 'quote' || (media?.type !== 'image' && media?.type !== 'video') ? undefined : media.type,
          name: media?.name,
          contentType: media?.mimeType,
          size: media?.size,
          width: media?.width,
          height: media?.height,
          duration: media?.duration,
          caption: caption.trim(),
        });
      } else {
        const postIdStr = await createPost({
          imageUri: media?.uri ?? '',
          mediaType: postKind === 'quote' ? 'quote' : media!.type,
          name: media?.name,
          contentType: media?.mimeType,
          size: media?.size,
          caption: caption.trim(),
          location: location.trim(),
          hubIds: hubId ? [hubId] : undefined,
        });

        if (postIdStr && selectedProductId && postKind === 'media') {
          const postIdNum = Number(postIdStr);
          if (!isNaN(postIdNum)) {
            try {
              await CreatorHubApi.attachProductToPost(getToken, postIdNum, selectedProductId);
            } catch (err) {
              console.warn('Could not attach product to post', err);
            }
          }
        }
      }
      setMedia(null);
      setCaption('');
      setLocation('');
      setSelectedProductId(null);
      setDetailsOpen(false);
      Alert.alert(shareMode === 'story' ? 'Story posted' : 'Post published', shareMode === 'story' ? 'Your story is live for 24 hours.' : 'Your post is now on Old Time.');
    } catch (error) {
      Alert.alert('Could not post', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: '#090909' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.cameraStage, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8), paddingBottom: Platform.OS === 'web' ? 34 : 0 }]}>
          <View style={styles.cameraHeader}>
            <IconButton icon="close" onPress={() => router.back()} accessibilityLabel="Close Create" color={cameraForeground} size={29} />
            <IconButton icon="camera-reverse-outline" onPress={() => setCameraFacing((current) => current === 'back' ? 'front' : 'back')} accessibilityLabel={`Switch to ${cameraFacing === 'back' ? 'front' : 'back'} camera`} color={cameraForeground} size={24} />
          </View>
          <View style={styles.cameraBody}>
            <Pressable onPress={() => postKind === 'media' && !cameraOpen ? void openCamera('photo') : postKind === 'quote' ? setDetailsOpen(true) : undefined} style={styles.previewFrame} accessibilityRole="button" accessibilityLabel={media ? 'Change selected media' : 'Open full screen camera'}>
               {postKind === 'quote' ? <View style={[styles.textCanvas, { backgroundColor: colors.secondary }]}><Text style={[styles.textCanvasMark, { color: colors.foreground }]}>“</Text><Text style={[styles.textCanvasHint, { color: colors.foreground }]}>{caption.trim() || 'Write something worth keeping.'}</Text><Text style={[styles.textCanvasAuthor, { color: colors.foreground }]}>@{profile?.handle ?? 'you'}</Text></View> : media ? <View style={styles.cameraMediaPreview}>{media.type === 'video' ? <SelectedVideoPreview uri={media.uri} contentFit="cover" /> : <Image source={{ uri: media.uri }} style={styles.preview} resizeMode="cover" />}</View> : cameraOpen ? <View style={styles.cameraMediaPreview}><CameraView ref={cameraRef} style={styles.preview} facing={cameraFacing} flash="off" mode={captureMode} mute={false} /></View> : <View style={styles.emptyCamera} />}
              {isRecording ? <View style={styles.recordingBadge}><View style={styles.recordingDot} /><Text style={styles.recordingText}>Recording</Text></View> : null}
            </Pressable>
          </View>
           <View style={styles.cameraFormats}>
             {createModes.map((mode) => {
               const active = mode === 'PHOTO' ? postKind === 'media' && !media?.type?.includes('video') : mode === 'TEXT' ? postKind === 'quote' : false;
                const onPress = mode === 'HUBS' ? openHubs : mode === 'ROUTES' ? openRoutes : mode === 'ACCESS' ? openAccess : mode === 'PHOTO' ? () => void openCamera('photo') : () => setPostKind('quote');
                 return <Pressable key={mode} onPress={onPress} style={[styles.formatPill, active && styles.formatActive]} accessibilityRole="button" accessibilityLabel={mode === 'HUBS' ? 'Open Hubs' : mode === 'ROUTES' ? 'Open Routes' : mode === 'ACCESS' ? 'Open Access' : mode === 'PHOTO' ? 'Start photo' : 'Create text post'}><Text style={[styles.formatText, { color: isTextMode ? colors.homeForeground : colors.homeBackground }, active && styles.formatTextActive]}>{mode}</Text></Pressable>;
             })}
           </View>
           <View style={styles.shutterRow}>
            <Pressable onPress={() => void chooseMedia()} style={styles.albumThumb} accessibilityRole="button" accessibilityLabel="Choose from album">
              {media?.type === 'image' ? <Image source={{ uri: media.uri }} style={styles.albumThumbImage} /> : <Ionicons name="albums-outline" size={25} color="#fff" />}
            </Pressable>
             <Pressable onPress={() => postKind === 'quote' ? setDetailsOpen(true) : void openCamera('photo')} style={[styles.shutter, { borderColor: cameraForeground }]} accessibilityRole="button" accessibilityLabel={postKind === 'quote' ? 'Write text post' : 'Open camera'}><View style={[styles.shutterInner, { backgroundColor: cameraForeground }]} /></Pressable>
             <Pressable onPress={() => void publish()} disabled={isPublishing} style={[styles.cameraPostButton, { opacity: isPublishing ? 0.45 : 1 }]} accessibilityRole="button" accessibilityLabel="Post moment"><Text style={[styles.cameraPostText, { color: cameraForeground }]}>{isPublishing ? '...' : 'Post'}</Text></Pressable>
          </View>
           <Pressable onPress={() => setDetailsOpen((current) => !current)} style={styles.drawerHandle} accessibilityRole="button" accessibilityLabel={detailsOpen ? 'Close create options' : 'Open create options'}><Ionicons name={detailsOpen ? 'chevron-down' : 'chevron-up'} size={20} color="#fff" /></Pressable>
         </View>

           {detailsOpen ? <View style={[styles.detailsDrawer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
           <View style={styles.detailsPanel}>
             <View style={styles.detailsHeader}><View><Text style={[styles.detailsEyebrow, { color: colors.foreground }]}>OLD TIME CREATE</Text><Text style={[styles.detailsTitle, { color: colors.foreground }]}>{hubName ? `Post to ${hubName}` : 'Make it yours'}</Text></View><Pressable onPress={() => setDetailsOpen((current) => !current)} style={[styles.detailsToggle, { borderColor: colors.border, backgroundColor: colors.card }]}><Ionicons name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={17} color={colors.foreground} /><Text style={[styles.detailsToggleText, { color: colors.foreground }]}>{detailsOpen ? 'Hide' : 'Details'}</Text></Pressable></View>
              <View style={[styles.kindSwitch, { backgroundColor: colors.muted, borderColor: colors.border }]}><Pressable onPress={() => setPostKind('media')} style={[styles.kindOption, { borderColor: colors.border }, postKind === 'media' && { backgroundColor: colors.card }]}><Ionicons name="images-outline" size={17} color={colors.foreground} /><Text style={[styles.kindText, { color: colors.foreground }]}>Photo / Video</Text></Pressable><Pressable onPress={() => setPostKind('quote')} style={[styles.kindOption, { borderColor: colors.border }, postKind === 'quote' && { backgroundColor: colors.card }]}><Ionicons name="chatbox-ellipses-outline" size={17} color={colors.foreground} /><Text style={[styles.kindText, { color: colors.foreground }]}>Quote</Text></Pressable></View>
             <View style={styles.shareModeSwitch}>
                <Pressable onPress={() => setShareMode('story')} style={[styles.shareModeOption, { borderColor: colors.border }, shareMode === 'story' ? { backgroundColor: colors.primary } : { backgroundColor: colors.card }]}><Text style={[styles.shareModeText, { color: shareMode === 'story' ? colors.primaryForeground : colors.foreground }]}>Story</Text></Pressable>
                <Pressable onPress={() => setShareMode('post')} style={[styles.shareModeOption, { borderColor: colors.border }, shareMode === 'post' ? { backgroundColor: colors.primary } : { backgroundColor: colors.card }]}><Text style={[styles.shareModeText, { color: shareMode === 'post' ? colors.primaryForeground : colors.foreground }]}>Post</Text></Pressable>
             </View>
             <View style={styles.fieldGroup}><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{postKind === 'quote' ? 'Quote' : 'Caption'}{postKind === 'media' ? <Text style={{ color: colors.foreground, fontWeight: '500' }}> optional</Text> : null}</Text><TextInput value={caption} onChangeText={setCaption} multiline placeholder={postKind === 'quote' ? 'Write the words you want to share…' : 'Tell the story behind it…'} placeholderTextColor={colors.mutedForeground} style={[styles.captionInput, postKind === 'quote' && styles.quoteInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} maxLength={180} /><Text style={[styles.counter, { color: colors.foreground }]}>{caption.length}/180</Text></View>
              {shareMode === 'post' ? <View style={styles.fieldGroup}><View style={styles.locationLabelRow}><Text style={[styles.fieldLabel, { color: colors.foreground, marginBottom: 0 }]}>Location <Text style={{ color: colors.foreground, fontWeight: '500' }}>optional</Text></Text><Pressable onPress={useCurrentLocation} disabled={isLocating} style={styles.useLocationButton}><Ionicons name="navigate-outline" size={14} color={colors.foreground} /><Text style={[styles.useLocationText, { color: colors.foreground }]}>{isLocating ? 'Finding…' : 'Use current'}</Text></Pressable></View><View style={[styles.locationInput, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="location-outline" size={18} color={colors.foreground} /><TextInput value={location} onChangeText={setLocation} placeholder="Leave blank or add a place" placeholderTextColor={colors.mutedForeground} style={[styles.locationTextInput, { color: colors.foreground }]} /></View></View> : null}

             {isCreator && postKind === 'media' && shareMode === 'post' && approvals && approvals.length > 0 && (
               <View style={styles.fieldGroup}>
                 <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Tag Product <Text style={{ color: colors.foreground, fontWeight: '500' }}>optional</Text></Text>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagProductsScroll}>
                    {approvals.map(approval => (
                      <Pressable
                        key={approval.productId}
                       onPress={() => setSelectedProductId(current => current === approval.productId ? null : approval.productId)}
                       style={[styles.tagProductCard, { backgroundColor: colors.card, borderColor: selectedProductId === approval.productId ? colors.action : colors.border }]}
                     >
                       <Text numberOfLines={1} style={[styles.tagProductName, { color: selectedProductId === approval.productId ? colors.action : colors.foreground }]}>{approval.product.name}</Text>
                     </Pressable>
                   ))}
                 </ScrollView>
               </View>
              )}

             <Pressable onPress={() => void publish()} disabled={isPublishing} style={[styles.shareButton, { backgroundColor: colors.primary, opacity: isPublishing ? 0.5 : 1 }]}><Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>{isPublishing ? 'Posting…' : shareMode === 'story' ? 'Post Story' : 'Post'}</Text></Pressable>
           </View>
          </View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  cameraStage: { backgroundColor: '#090909', flex: 1, position: 'relative' },
  cameraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 2 },
  cameraBody: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', zIndex: 0 },
  previewFrame: { flex: 1, minHeight: 0, marginHorizontal: 0, borderRadius: 0, overflow: 'hidden', backgroundColor: '#111', justifyContent: 'center' },
  preview: { width: '100%', height: '100%' },
  cameraMediaPreview: { width: '100%', height: '100%', position: 'relative' },
  recordingBadge: { position: 'absolute', top: 15, left: 15, borderRadius: 15, paddingHorizontal: 10, height: 30, backgroundColor: 'rgba(0,0,0,0.65)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff3b30' },
  recordingText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  emptyCamera: { alignItems: 'center', paddingHorizontal: 34 },
  emptyCameraTitle: { color: '#fff', fontFamily: 'Fraunces_700Bold', fontSize: 18, marginTop: 16 },
  textCanvas: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#241b18' },
  textCanvasMark: { color: '#D71920', fontFamily: 'Fraunces_900Black', fontSize: 64, lineHeight: 56 },
  textCanvasHint: { color: '#fff', fontFamily: 'Fraunces_700Bold', fontSize: 26, lineHeight: 36 },
  textCanvasAuthor: { fontFamily: 'Outfit_700Bold', fontSize: 14, marginTop: 24 },
  cameraFormats: { position: 'absolute', left: 0, right: 0, bottom: 142, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, zIndex: 2 },
  formatText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  formatTextActive: { color: '#111' },
  formatPill: { backgroundColor: 'transparent', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  formatActive: { backgroundColor: '#fff' },
  shutterRow: { position: 'absolute', left: 0, right: 0, bottom: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 2 },
  albumThumb: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#262626' },
  albumThumbImage: { width: '100%', height: '100%' },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#fff' },
  cameraPostButton: { minWidth: 48, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  cameraPostText: { color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 15 },
  drawerHandle: { position: 'absolute', alignSelf: 'center', bottom: 0, width: 48, height: 32, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  detailsDrawer: { maxHeight: '58%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, overflow: 'hidden' },
  detailsPanel: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsEyebrow: { fontFamily: 'Outfit_700Bold', fontSize: 10, letterSpacing: 1.1 },
  detailsTitle: { fontFamily: 'Fraunces_900Black', fontSize: 23, marginTop: 2 },
  detailsToggle: { minHeight: 34, borderWidth: 1, borderRadius: 17, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailsToggleText: { fontFamily: 'Outfit_700Bold', fontSize: 12 },
  kindSwitch: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 3, marginTop: 12 },
  kindOption: { flex: 1, minHeight: 40, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  kindText: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  shareModeSwitch: { flexDirection: 'row', gap: 8, marginTop: 10 },
  shareModeOption: { flex: 1, minHeight: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  shareModeText: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  fieldGroup: { marginTop: 10 },
  fieldLabel: { fontFamily: 'Outfit_700Bold', fontSize: 13, marginBottom: 5 },
  captionInput: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingTop: 10, minHeight: 64, fontFamily: 'Outfit_400Regular', fontSize: 14, textAlignVertical: 'top' },
  quoteInput: { minHeight: 86, fontFamily: 'Fraunces_700Bold', fontSize: 20, lineHeight: 28 },
  counter: { fontFamily: 'Outfit_500Medium', fontSize: 11, textAlign: 'right', marginTop: 2 },
  locationInput: { height: 44, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13 },
  locationLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  useLocationButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5 },
  useLocationText: { fontFamily: 'Outfit_700Bold', fontSize: 12 },
  locationTextInput: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 15 },
  note: { flexDirection: 'row', borderRadius: 18, padding: 15, gap: 10, alignItems: 'flex-start', marginTop: 26 },
  noteText: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 19 },
  shareButton: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  tagProductsScroll: { gap: 10, paddingVertical: 4 },
  tagProductCard: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 16, maxWidth: 160 },
  tagProductName: { fontFamily: 'Outfit_600SemiBold', fontSize: 13 },
});