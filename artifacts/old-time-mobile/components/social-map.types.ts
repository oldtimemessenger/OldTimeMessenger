import type { MapPin } from '@/lib/map-api';
import type { Story } from '@/lib/social-api';

export type SocialMapCoordinate = {
  latitude: number;
  longitude: number;
};

export type SocialMapRegion = SocialMapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type SocialMapProps = {
  center: SocialMapCoordinate | null;
  region: SocialMapRegion | null;
  pins: MapPin[];
  stories: Story[];
  selectedPinId: number | null;
  loading: boolean;
  colors: {
    background: string;
    foreground: string;
    card: string;
    muted: string;
    mutedForeground: string;
    border: string;
    primary: string;
    primaryForeground: string;
    destructive: string;
  };
  onLocate: () => void;
  onCreate: () => void;
  onSelectPin: (pin: MapPin) => void;
  onSelectStory: (story: Story) => void;
  onAreaPress: (coordinate: SocialMapCoordinate) => void;
  onRegionChange: (region: SocialMapRegion) => void;
};