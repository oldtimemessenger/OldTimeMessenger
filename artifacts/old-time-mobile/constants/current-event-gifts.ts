export const currentEventGifts = [
  { key: 'coffee', label: 'Coffee', icon: 'cafe-outline' as const, cost: 25, image: require('../assets/gifts/coffee.jpg') },
  { key: 'idea', label: 'Idea', icon: 'bulb-outline' as const, cost: 100, image: require('../assets/gifts/idea.jpg') },
  { key: 'heart', label: 'Heart', icon: 'heart-outline' as const, cost: 200, image: require('../assets/gifts/heart.jpg') },
  { key: 'gem', label: 'Gem', icon: 'diamond-outline' as const, cost: 500, image: require('../assets/gifts/gem.jpg') },
  { key: 'studio', label: 'Studio', icon: 'radio-outline' as const, cost: 1000, image: require('../assets/gifts/studio.jpg') },
] as const;
