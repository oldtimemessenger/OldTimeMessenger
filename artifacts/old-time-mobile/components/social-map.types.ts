import type { DiscoveryItem, MapPin } from '@/lib/map-api';
import type { Story } from '@/lib/social-api';
import type { CurrentEventRoom } from '@workspace/api-client-react';

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
  discoveryItems?: DiscoveryItem[];
  currentEventRooms?: CurrentEventRoom[];
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
  onSelectDiscoveryItem?: (item: DiscoveryItem) => void;
  onSelectCurrentEventRoom?: (room: CurrentEventRoom) => void;
  onAreaPress: (coordinate: SocialMapCoordinate) => void;
  onRegionChange: (region: SocialMapRegion) => void;
};