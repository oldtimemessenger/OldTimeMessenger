import type { UpdatePost } from '@/context/app-state';

export const INTEREST_OPTIONS = [
  { id: 'nba', label: 'NBA', description: 'Scores, teams, and league news' },
  { id: 'nearby', label: 'Near you', description: 'Stories and events based on your location' },
  { id: 'technology', label: 'Technology', description: 'Products, startups, and science' },
  { id: 'music', label: 'Music', description: 'New releases and live sessions' },
  { id: 'food', label: 'Food', description: 'Recipes, restaurants, and chefs' },
  { id: 'fitness', label: 'Fitness', description: 'Training, wellness, and movement' },
  { id: 'travel', label: 'Travel', description: 'Places, guides, and getaways' },
  { id: 'business', label: 'Business', description: 'Money, work, and the economy' },
  { id: 'culture', label: 'Culture', description: 'People, ideas, and community' },
  { id: 'kreyol', label: 'Kreyòl', description: 'Kreyòl-language stories and creators' },
] as const;

export type InterestId = typeof INTEREST_OPTIONS[number]['id'];
export type InteractionKind = 'open' | 'like' | 'save' | 'comment' | 'share' | 'hide';

export function rankForYou(posts: UpdatePost[], interests: string[], weights: Record<string, number>) {
  const now = Date.now();
  return posts
    .map((post) => {
      const interestBoost = interests.includes(post.tag.toLowerCase()) ? 40 : 0;
      const behaviorBoost = weights[post.tag.toLowerCase()] ?? 0;
      const ageHours = Math.max(1, (now - post.createdAt) / 3600000);
      const freshnessBoost = Math.max(0, 12 - ageHours);
      return { post, score: interestBoost + behaviorBoost + freshnessBoost };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
}