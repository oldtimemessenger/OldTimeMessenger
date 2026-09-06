import {
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  type RemoteVideoTrack,
} from 'livekit-client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { CallVideoSurfaceHandle, CallVideoSurfaceProps } from './call-video-surface';

export type { CallVideoSurfaceHandle, CallVideoSurfaceProps } from './call-video-surface';

type RemoteTrackPublication = {
  source: Track.Source;
};

function attachVideoTrack(track: RemoteVideoTrack | LocalVideoTrack | null, element: HTMLVideoElement | null) {
  if (!track || !element) return;
  track.attach(element);
  element.autoplay = true;
  element.playsInline = true;
}

function detachVideoTrack(track: RemoteVideoTrack | LocalVideoTrack | null, element: HTMLVideoElement | null) {
  if (track && element) track.detach(element);
}

export const CallVideoSurface = forwardRef<CallVideoSurfaceHandle, CallVideoSurfaceProps>(function CallVideoSurface({
  serverUrl,
  token,
  muted,
  cameraEnabled,
  onError,
  onConnectionChange,
  onScreenShareChange,
}, ref) {
  const colors = useColors();
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioElements = useRef<HTMLMediaElement[]>([]);
  const [localCameraTrack, setLocalCameraTrack] = useState<LocalVideoTrack | null>(null);
  const [localScreenTrack, setLocalScreenTrack] = useState<LocalVideoTrack | null>(null);
  const [remoteCameraTrack, setRemoteCameraTrack] = useState<RemoteVideoTrack | null>(null);
  const [remoteScreenTrack, setRemoteScreenTrack] = useState<RemoteVideoTrack | null>(null);
  const [connected, setConnected] = useState(false);
  const initialMediaState = useRef({ muted, cameraEnabled });

  const syncLocalTracks = (room: Room) => {
    const camera = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
    const screen = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack;
    setLocalCameraTrack(camera instanceof LocalVideoTrack ? camera : null);
    setLocalScreenTrack(screen instanceof LocalVideoTrack ? screen : null);
    onScreenShareChange?.(Boolean(screen));
  };

  useEffect(() => {
    let active = true;
    const room = new Room();
    roomRef.current = room;

    const handleTrackSubscribed = (track: Parameters<Room['on']>[1] extends never ? never : any, publication: RemoteTrackPublication, _participant: unknown) => {
      if (track.kind === Track.Kind.Audio && typeof document !== 'undefined') {
        const element = track.attach();
        element.autoplay = true;
        element.setAttribute('playsinline', 'true');
        element.style.display = 'none';
        document.body.appendChild(element);
        remoteAudioElements.current.push(element);
      } else if (track.kind === Track.Kind.Video) {
        if (publication.source === Track.Source.ScreenShare) setRemoteScreenTrack(track as RemoteVideoTrack);
        else setRemoteCameraTrack(track as RemoteVideoTrack);
      }
    };
    const handleTrackUnsubscribed = (track: any, publication: RemoteTrackPublication) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach().forEach((element: HTMLMediaElement) => element.remove());
      } else if (publication.source === Track.Source.ScreenShare) {
        setRemoteScreenTrack(null);
      } else {
        setRemoteCameraTrack(null);
      }
    };
    const handleLocalTrackPublished = () => syncLocalTracks(room);
    const handleLocalTrackUnpublished = () => syncLocalTracks(room);
    const handleDisconnected = () => {
      if (active) {
        setConnected(false);
        onConnectionChange?.(false);
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
    room.on(RoomEvent.Disconnected, handleDisconnected);

    void (async () => {
      try {
        await room.connect(serverUrl, token);
        await room.localParticipant.setMicrophoneEnabled(!initialMediaState.current.muted);
        await room.localParticipant.setCameraEnabled(initialMediaState.current.cameraEnabled);
        syncLocalTracks(room);
        if (active) {
          setConnected(true);
          onConnectionChange?.(true);
        }
      } catch (error) {
        if (active) onError(error instanceof Error ? error.message : 'Video call could not connect.');
      }
    })();

    return () => {
      active = false;
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      remoteAudioElements.current.forEach((element) => element.remove());
      remoteAudioElements.current = [];
      setConnected(false);
      onConnectionChange?.(false);
      void room.disconnect();
      roomRef.current = null;
    };
  }, [onConnectionChange, onError, onScreenShareChange, serverUrl, token]);

  useEffect(() => {
    const room = roomRef.current;
    if (room) void room.localParticipant.setMicrophoneEnabled(!muted).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : 'Microphone could not be enabled.');
    });
  }, [muted, onError]);

  useEffect(() => {
    const room = roomRef.current;
    if (room) {
      void room.localParticipant.setCameraEnabled(cameraEnabled)
        .then(() => syncLocalTracks(room))
        .catch((error: unknown) => onError(error instanceof Error ? error.message : 'Camera could not be enabled.'));
    }
  }, [cameraEnabled, onError]);

  useEffect(() => {
    attachVideoTrack(localScreenTrack ?? localCameraTrack, localVideoRef.current);
    return () => detachVideoTrack(localScreenTrack ?? localCameraTrack, localVideoRef.current);
  }, [localCameraTrack, localScreenTrack]);

  useEffect(() => {
    attachVideoTrack(remoteScreenTrack ?? remoteCameraTrack, remoteVideoRef.current);
    return () => detachVideoTrack(remoteScreenTrack ?? remoteCameraTrack, remoteVideoRef.current);
  }, [remoteCameraTrack, remoteScreenTrack]);

  useImperativeHandle(ref, () => ({
    async setMuted(nextMuted) {
      const room = roomRef.current;
      if (!room) throw new Error('Video call is not connected.');
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
    },
    async setSpeaker(_speaker) {
      // Browser audio output follows the selected browser/device route.
    },
    async setCameraEnabled(enabled) {
      const room = roomRef.current;
      if (!room) throw new Error('Video call is not connected.');
      await room.localParticipant.setCameraEnabled(enabled);
      syncLocalTracks(room);
    },
    async switchCamera() {
      const camera = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
      if (!camera) throw new Error('Turn on your camera before switching it.');
      await camera.mediaStreamTrack.applyConstraints({
        facingMode: camera.mediaStreamTrack.getSettings().facingMode === 'environment' ? 'user' : 'environment',
      });
    },
    async setScreenShareEnabled(enabled) {
      const room = roomRef.current;
      if (!room) throw new Error('Video call is not connected.');
      await room.localParticipant.setScreenShareEnabled(enabled);
      syncLocalTracks(room);
    },
  }), []);

  const mainTrack = remoteScreenTrack ?? remoteCameraTrack;
  const localTrack = localScreenTrack ?? localCameraTrack;

  return (
    <View style={styles.stage}>
      {mainTrack ? (
        <video ref={remoteVideoRef} muted playsInline autoPlay style={styles.mainVideo} />
      ) : (
        <View style={[styles.waiting, { backgroundColor: colors.card }]}>
          <Text style={[styles.waitingTitle, { color: colors.foreground }]}>
            {connected ? 'Waiting for video' : 'Connecting video…'}
          </Text>
          <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>
            {connected ? 'The other person will appear here when they join.' : 'Allow camera and microphone access to continue.'}
          </Text>
        </View>
      )}
      {localTrack ? <video ref={localVideoRef} muted playsInline autoPlay style={styles.localVideo} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 280, overflow: 'hidden', borderRadius: 24, backgroundColor: '#111827' },
  mainVideo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', objectFit: 'cover' } as never,
  localVideo: { position: 'absolute', top: 14, right: 14, width: 104, height: 148, objectFit: 'cover', borderRadius: 16, borderWidth: 2, borderColor: '#fff' } as never,
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  waitingTitle: { fontSize: 18, fontWeight: '800' },
  waitingText: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
});