export const currentEventGifts = [
  { key: 'coffee', label: 'Coffee', icon: 'cafe-outline' as const, cost: 25, image: require('../assets/gifts/coffee.png') },
  { key: 'idea', label: 'Idea', icon: 'bulb-outline' as const, cost: 100, image: require('../assets/gifts/idea.png') },
  { key: 'heart', label: 'Heart', icon: 'heart-outline' as const, cost: 200, image: require('../assets/gifts/heart.png') },
  { key: 'gem', label: 'Gem', icon: 'diamond-outline' as const, cost: 500, image: require('../assets/gifts/gem.png') },
  { key: 'studio', label: 'Studio', icon: 'radio-outline' as const, cost: 1000, image: require('../assets/gifts/studio.png') },
] as const;
