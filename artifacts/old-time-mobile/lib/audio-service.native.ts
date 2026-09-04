import { AudioSession } from '@livekit/react-native';
import { Room, RoomEvent } from 'livekit-client';

export type AudioProvider = 'unconfigured' | 'livekit' | 'agora' | 'daily';
export type AudioSessionState = { provider: AudioProvider; connected: boolean; roomId: number };
type Role = 'host' | 'moderator' | 'speaker' | 'listener';

class LiveKitAudioService {
  readonly available = true;
  private room: Room | null = null;

  async join(roomId: number, _role: Role, credentials?: { url: string; token: string; canPublish: boolean }): Promise<AudioSessionState> {
    if (!credentials) throw new Error('Audio credentials are unavailable.');
    await this.leave();
    await AudioSession.startAudioSession();
    const room = new Room();
    room.on(RoomEvent.Disconnected, () => { if (this.room === room) this.room = null; });
    try {
      await room.connect(credentials.url, credentials.token);
      this.room = room;
      await room.localParticipant.setMicrophoneEnabled(credentials.canPublish);
      return { provider: 'livekit', connected: true, roomId };
    } catch (error) {
      await room.disconnect();
      await AudioSession.stopAudioSession();
      throw error;
    }
  }

  async leave() {
    const room = this.room;
    this.room = null;
    if (room) await room.disconnect();
    await AudioSession.stopAudioSession();
  }

  async setMuted(muted: boolean) {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(!muted);
  }

  async setSpeaker(speaker: boolean) {
    // This is supported by the native audio session; keep it deliberately
    // best-effort because some Android devices do not expose an earpiece.
    await (AudioSession as any).configureAudio({ android: { preferredOutputList: speaker ? ['speaker'] : ['earpiece'] } });
  }
}

export const audioService = new LiveKitAudioService();