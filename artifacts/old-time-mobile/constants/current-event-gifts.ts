export const currentEventGifts = [
  { key: 'coffee', label: 'Coffee', icon: 'cafe-outline' as const, cost: 25, image: require('../assets/gifts/coffee.png'), video: null, premium: false },
  { key: 'idea', label: 'Idea', icon: 'bulb-outline' as const, cost: 100, image: require('../assets/gifts/idea.png'), video: null, premium: false },
  { key: 'heart', label: 'Heart', icon: 'heart-outline' as const, cost: 200, image: require('../assets/gifts/heart.png'), video: null, premium: false },
  { key: 'gem', label: 'Gem', icon: 'diamond-outline' as const, cost: 500, image: require('../assets/gifts/gem.png'), video: null, premium: false },
  { key: 'studio', label: 'Studio', icon: 'radio-outline' as const, cost: 1000, image: require('../assets/gifts/studio.png'), video: null, premium: false },
  { key: 'time_is_up', label: 'Time is up', icon: 'hourglass-outline' as const, cost: 10000, image: require('../assets/gifts/time-is-up.png'), video: require('../assets/gifts/time-is-up.mp4'), premium: true },
] as const;
