import { AndroidAudioTypePresets, AudioSession } from '@livekit/react-native';
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
    await AudioSession.configureAudio({
      android: {
        preferredOutputList: ['speaker', 'earpiece'],
        audioTypeOptions: AndroidAudioTypePresets.communication,
      },
      ios: { defaultOutput: 'speaker' },
    });
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
    const requestedOutput = speaker ? 'speaker' : 'earpiece';
    const outputs = await AudioSession.getAudioOutputs();
    // iOS exposes "default" and "force_speaker"; the default route lets iOS
    // correctly choose an earpiece, wired device, or Bluetooth device.
    const output = speaker
      ? (outputs.includes('force_speaker') ? 'force_speaker' : requestedOutput)
      : (outputs.includes('default') ? 'default' : requestedOutput);
    if (!outputs.includes(output)) {
      throw new Error(speaker ? 'The speaker is not available on this device.' : 'An earpiece route is not available on this device.');
    }
    await AudioSession.selectAudioOutput(output);
  }
}

export const audioService = new LiveKitAudioService();