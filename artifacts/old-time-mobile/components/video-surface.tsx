import React, { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';

export function VideoSurface({
  source,
  style,
  muted = false,
  paused = false,
  controls = false,
  loop = true,
  contentFit = 'cover',
}: {
  source: VideoSource;
  style: StyleProp<ViewStyle>;
  muted?: boolean;
  paused?: boolean;
  controls?: boolean;
  loop?: boolean;
  contentFit?: 'contain' | 'cover' | 'fill';
}) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = loop;
    instance.muted = muted;
    if (!paused) instance.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (paused) {
      player.pause();
    } else {
      player.play();
    }
  }, [paused, player]);

  return (
    <VideoView
      player={player}
      style={style}
      nativeControls={controls}
      contentFit={contentFit}
      allowsFullscreen={controls}
    />
  );
}