export type AudioProvider = 'unconfigured' | 'livekit' | 'agora' | 'daily';

export type AudioSession = {
  provider: AudioProvider;
  connected: boolean;
  roomId: number;
};

export interface AudioService {
  readonly available: boolean;
  join(roomId: number, role: 'host' | 'moderator' | 'speaker' | 'listener', credentials?: { url: string; token: string; canPublish: boolean }): Promise<AudioSession>;
  leave(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setSpeaker?(speaker: boolean): Promise<void>;
}

class UnconfiguredAudioService implements AudioService {
  readonly available = false;

  async join(roomId: number): Promise<AudioSession> {
    return { provider: 'unconfigured', connected: false, roomId };
  }

  async leave() {}

  async setMuted(_muted: boolean) {}
}

export const audioService: AudioService = new UnconfiguredAudioService();