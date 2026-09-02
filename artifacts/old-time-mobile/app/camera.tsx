import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, Platform, PanResponder, Animated, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { VideoSurface } from '@/components/video-surface';

const ZOOM_STOPS = [
  { label: '5×', value: 1 },
  { label: '3×', value: 0.6 },
  { label: '2×', value: 0.3 },
  { label: '1×', value: 0 },
];

export default function CameraScreen() {
  const router = useRouter();
  const { returnChatId, returnTo } = useLocalSearchParams<{
    returnChatId?: string;
    returnTo?: 'status';
  }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [zoom, setZoom] = useState(0);
  const [captureMode, setCaptureMode] = useState<'picture' | 'video'>('picture');

  const [preview, setPreview] = useState<{ uri: string, type: 'photo' | 'video' } | null>(null);
  const [contentFit, setContentFit] = useState<'contain' | 'cover'>('contain');
  const [shots, setShots] = useState<string[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const pressActiveRef = useRef(false);
  const videoStartingRef = useRef(false);
  const micPermissionRef = useRef(micPermission);
  const requestMicPermissionRef = useRef(requestMicPermission);
  const [recordingTime, setRecordingTime] = useState(0);

  const cameraRef = useRef<CameraView>(null);
  const initialZoom = useRef(0);
  const zoomRef = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    micPermissionRef.current = micPermission;
    requestMicPermissionRef.current = requestMicPermission;
  }, [micPermission, requestMicPermission]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      setRecordingTime(0);
      interval = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  async function takePicture() {
    if (isWeb) return;
    if (cameraRef.current) {
      try {
        setCaptureMode('picture');
        await new Promise((resolve) => setTimeout(resolve, 90));
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        if (photo) {
          setPreview({ uri: photo.uri, type: 'photo' });
          setShots((prev) => [photo.uri, ...prev].slice(0, 12));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function startRecording() {
    if (isWeb || isRecordingRef.current || videoStartingRef.current) return;
    if (cameraRef.current) {
      try {
        videoStartingRef.current = true;
        let microphoneGranted = micPermissionRef.current?.granted;
        if (!microphoneGranted && micPermissionRef.current?.canAskAgain) {
          const result = await requestMicPermissionRef.current();
          microphoneGranted = result.granted;
        }
        if (!microphoneGranted || !pressActiveRef.current) return;
        setCaptureMode('video');
        await new Promise((resolve) => setTimeout(resolve, 120));
        if (!pressActiveRef.current) {
          setCaptureMode('picture');
          return;
        }
        setIsRecording(true);
        isRecordingRef.current = true;
        const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
        if (video) {
          setPreview({ uri: video.uri, type: 'video' });
          setShots((prev) => [video.uri, ...prev].slice(0, 12));
        }
      } catch (e) {
        console.error(e);
      } finally {
        videoStartingRef.current = false;
        setIsRecording(false);
        isRecordingRef.current = false;
        setCaptureMode('picture');
      }
    }
  }

  function stopRecording() {
    if (isWeb) return;
    if (cameraRef.current && isRecordingRef.current) {
      cameraRef.current.stopRecording();
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pressActiveRef.current = true;
        initialZoom.current = zoomRef.current;
        holdTimer.current = setTimeout(() => { void startRecording(); }, 260);
      },
      onPanResponderMove: (_, gestureState) => {
        if (isRecordingRef.current) {
          const nextZoom = Math.max(0, Math.min(1, initialZoom.current - gestureState.dy / 260));
          setZoom(nextZoom);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        pressActiveRef.current = false;
        if (holdTimer.current) clearTimeout(holdTimer.current);
        holdTimer.current = null;
        if (isRecordingRef.current) {
          stopRecording();
        } else if (Math.abs(gestureState.dx) < 12 && Math.abs(gestureState.dy) < 12) {
          void takePicture();
        }
      },
      onPanResponderTerminate: () => {
        pressActiveRef.current = false;
        if (holdTimer.current) clearTimeout(holdTimer.current);
        holdTimer.current = null;
        if (isRecordingRef.current) stopRecording();
      }
    })
  ).current;

  async function openGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.9,
      selectionLimit: 1
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setPreview({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'photo' });
      setShots((items) => [asset.uri, ...items].slice(0, 12));
    }
  }

  const cycleFlash = () => setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'));
  const flipCamera = () => setFacing((f) => f === 'back' ? 'front' : 'back');

  if (permission === null || micPermission === null) {
    return <View style={styles.root} />;
  }

  const hasPermissions = permission.granted;

  if (!hasPermissions && !isWeb) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="camera-outline" size={52} color="rgba(255,255,255,0.7)" style={{ marginBottom: 18 }} />
        <Text style={{ color: '#fff', fontSize: 18, marginBottom: 12, textAlign: 'center', fontWeight: '600' }}>
          Camera access
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 32, textAlign: 'center' }}>
          Allow access to take photos and videos.
        </Text>
        <Pressable
          style={{ backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 }}
          onPress={async () => {
            if (!permission.granted) {
               if (permission.canAskAgain) {
                 await requestPermission();
               } else {
                 if (Platform.OS !== 'web') Linking.openSettings();
                 return;
               }
            }
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>{permission.canAskAgain ? 'Continue' : 'Open Settings'}</Text>
        </Pressable>
      </View>
    );
  }

  if (preview) {
    return (
      <View style={styles.root}>
        <View style={[styles.viewfinder, { paddingTop: insets.top }]}>
          {preview.type === 'video' ? (
             <VideoSurface source={preview.uri} style={styles.previewImage} controls loop contentFit={contentFit} />
          ) : (
             <Image source={{ uri: preview.uri }} style={[styles.previewImage, { resizeMode: contentFit }]} />
          )}
        </View>
        <View style={[styles.previewControls, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Pressable accessibilityLabel="Retake" testID="retake-button" onPress={() => setPreview(null)} style={styles.previewAction}>
              <Ionicons name="arrow-undo" size={24} color="#fff" />
           </Pressable>
           <Pressable onPress={() => setContentFit(f => f === 'cover' ? 'contain' : 'cover')} style={[styles.previewAction, { flexDirection: 'row', width: 'auto', paddingHorizontal: 16, gap: 6 }]}>
              <Ionicons name={contentFit === 'cover' ? "contract" : "expand"} size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{contentFit === 'cover' ? 'Fill' : 'Fit'}</Text>
           </Pressable>
            <Pressable
              testID="use-button"
              onPress={() => {
                if (returnChatId) {
                  router.replace({
                    pathname: '/chat/[id]',
                    params: {
                      id: returnChatId,
                      mediaUri: preview.uri,
                      mediaType: preview.type === 'video' ? 'video' : 'image',
                      mediaFit: contentFit,
                    },
                  });
                  return;
                }
                 if (returnTo === 'status') {
                   router.replace({
                     pathname: '/(tabs)/updates',
                     params: {
                       mediaUri: preview.uri,
                       mediaType: preview.type === 'video' ? 'video' : 'photo',
                       mediaFit: contentFit,
                     },
                   });
                   return;
                 }
                router.back();
              }}
               accessibilityLabel="Use media"
               style={[styles.previewAction, styles.useBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name={returnChatId ? 'paper-plane' : 'checkmark'} size={24} color="#fff" />
           </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.viewfinder, { paddingTop: isWeb ? insets.top + 10 : 0 }]}>
        {isWeb ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Choose a photo or video" onPress={openGallery} style={styles.webGallery}>
            <View style={styles.webGalleryButton}>
              <Ionicons name="images-outline" size={30} color="#fff" />
            </View>
          </Pressable>
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.cameraView}
            facing={facing}
            flash={flash === 'auto' ? 'auto' : flash === 'on' ? 'on' : 'off'}
            zoom={zoom}
            mode={captureMode}
            videoQuality="1080p"
          />
        )}

        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 10) }]}>
          <Pressable onPress={() => router.back()} testID="close-button" style={{ padding: 8 }}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {!isWeb && (
            <View style={styles.topActions}>
              {isRecording && (
                <View style={styles.recordingBadge}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>{formatTime(recordingTime)}</Text>
                </View>
              )}
              <Pressable onPress={cycleFlash} testID="flash-button" style={{ padding: 8 }}>
                <Ionicons
                  name={flash === 'off' ? 'flash-off' : flash === 'auto' ? 'flash' : 'flash'}
                  size={24}
                  color={flash === 'on' ? '#FFD54A' : flash === 'auto' ? '#FFD54A' : '#fff'}
                />
                {flash === 'auto' && (
                  <Text style={styles.autoFlashText}>A</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* Zoom Rail */}
        {!isWeb && (
          <View style={styles.zoomRail}>
            {ZOOM_STOPS.map((stop) => (
              <Pressable key={stop.label} onPress={() => setZoom(stop.value)} style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
                <Text style={[styles.zoomText, Math.abs(zoom - stop.value) < 0.1 && styles.zoomActive]}>
                  {stop.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Bottom Controls */}
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.captureRow}>
            <Pressable onPress={openGallery} style={styles.gallery} testID="gallery-button">
              {shots[0] ? (
                <Image source={{ uri: shots[0] }} style={styles.thumb} />
              ) : (
                <Ionicons name="images-outline" size={22} color="#fff" />
              )}
            </Pressable>

            <View {...panResponder.panHandlers} testID="shutter-button" style={styles.shutterContainer}>
              <View style={styles.shutter}>
                <Animated.View style={[
                  styles.shutterInner,
                  isRecording && styles.recordingInner
                ]} />
              </View>
            </View>

            <Pressable onPress={flipCamera} style={[styles.flip, isWeb && { opacity: 0.5 }]} disabled={isWeb} testID="flip-button">
              <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  viewfinder: { flex: 1, position: 'relative', backgroundColor: '#000' },
  cameraView: { ...StyleSheet.absoluteFillObject },
  previewImage: { flex: 1, resizeMode: 'contain', width: '100%', height: '100%', backgroundColor: '#000' },
  webGallery: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111116' },
  webGalleryButton: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.28)' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, zIndex: 10
  },
  topActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  autoFlashText: { position: 'absolute', bottom: -2, right: 4, color: '#FFD54A', fontSize: 10, fontWeight: '600' },

  recordingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F0537A' },
  recordingText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  zoomRail: { position: 'absolute', right: 16, top: '40%', gap: 12, alignItems: 'center', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.3)', paddingVertical: 12, borderRadius: 24 },
  zoomText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500' },
  zoomActive: { color: '#FFD54A', fontWeight: '600', fontSize: 15 },

  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 18, paddingHorizontal: 0, backgroundColor: 'rgba(0,0,0,0.28)' },
  modeRow: { gap: 30, paddingHorizontal: 30, paddingBottom: 24 },
  mode: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  modeActive: { color: '#FFD54A' },

  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40, paddingBottom: 20 },
  gallery: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  thumb: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },

  shutterContainer: { padding: 10 },
  shutter: { width: 86, height: 86, borderRadius: 43, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff' },
  recordingInner: { width: 32, height: 32, borderRadius: 8 },

  flip: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  previewControls: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 28, paddingTop: 18, backgroundColor: 'rgba(0,0,0,0.72)' },
  previewAction: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.28)' },
  useBtn: { borderWidth: 0 },
});
