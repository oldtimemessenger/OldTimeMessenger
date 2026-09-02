export type AudioProvider = 'unconfigured' | 'livekit' | 'agora' | 'daily';

export type AudioSession = {
  provider: AudioProvider;
  connected: boolean;
  roomId: number;
};

export interface AudioService {
  join(roomId: number, role: 'host' | 'moderator' | 'speaker' | 'listener'): Promise<AudioSession>;
  leave(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
}

class UnconfiguredAudioService implements AudioService {
  private session: AudioSession | null = null;

  async join(roomId: number): Promise<AudioSession> {
    this.session = { provider: 'unconfigured', connected: false, roomId };
    return this.session;
  }

  async leave() {
    this.session = null;
  }

  async setMuted() {
    // The provider adapter will own the real microphone once configured.
  }
}

export const audioService: AudioService = new UnconfiguredAudioService();