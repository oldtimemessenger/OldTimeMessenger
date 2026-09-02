import type { Story } from '@/lib/social-api';
import { userStoryViewerItem, type SponsoredStoryViewerItem, type StoryViewerItem } from '@/components/story-viewer-content';

export type StoryAdPlacement = {
  afterUserStories: number;
  item: SponsoredStoryViewerItem;
};

/**
 * Builds the shared Story queue for Updates and Map.
 *
 * Ads are intentionally supplied as typed sponsored items by a future ad
 * adapter. With no placements, this is exactly the existing user Story queue.
 */
export function buildStoryViewerItems(stories: Story[], placements: StoryAdPlacement[] = []): StoryViewerItem[] {
  const items: StoryViewerItem[] = [];
  const sortedPlacements = [...placements].sort((left, right) => left.afterUserStories - right.afterUserStories);
  let placementIndex = 0;

  stories.forEach((story, index) => {
    items.push(userStoryViewerItem(story));
    while (placementIndex < sortedPlacements.length && sortedPlacements[placementIndex].afterUserStories <= index + 1) {
      items.push(sortedPlacements[placementIndex].item);
      placementIndex += 1;
    }
  });
  while (placementIndex < sortedPlacements.length) {
    items.push(sortedPlacements[placementIndex].item);
    placementIndex += 1;
  }
  return items;
}