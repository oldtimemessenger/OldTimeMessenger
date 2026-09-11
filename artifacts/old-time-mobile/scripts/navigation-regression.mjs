import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const homeScreen = readFileSync(resolve(appRoot, 'app/(tabs)/index.tsx'), 'utf8');
const storyScreen = readFileSync(resolve(appRoot, 'app/story/[storyId].tsx'), 'utf8');
const notificationsScreen = readFileSync(resolve(appRoot, 'app/notifications.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Private navigation regression: ${message}`);
}

assert(!homeScreen.includes('/(tabs)/updates-screen'), 'Home must not open the removed hidden Updates route.');
assert(homeScreen.includes('function StoryViewer'), 'Home Stories must use the standalone modal viewer.');
assert(homeScreen.includes('selectedStoryIndex'), 'Home must keep Story viewing in its own modal state.');
assert(homeScreen.includes('<MapExperience />'), 'Map content must render inside the visible Home Map tab.');
assert(homeScreen.includes("router.push('/(tabs)/create')"), 'Story creation must open the visible Create tab.');
assert(storyScreen.includes('getStory(id)'), 'Story deep links must load the exact server Story.');
assert(storyScreen.includes('viewStory(id)'), 'Opening a Story deep link must record the view.');
assert(notificationsScreen.includes("pathname: '/story/[storyId]'"), 'Story notifications must open the exact Story route.');
assert(!storyScreen.includes('USER_STORY:'), 'Shared Stories must use the canonical Story identity.');

console.log('Private navigation regression checks passed.');