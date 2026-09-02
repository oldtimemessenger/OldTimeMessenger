import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const chatScreen = readFileSync(resolve(appRoot, 'app/(tabs)/index.tsx'), 'utf8');
const updatesScreen = readFileSync(resolve(appRoot, 'app/(tabs)/updates-screen.tsx'), 'utf8');
const sharedStory = readFileSync(resolve(appRoot, 'app/story/[id].tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Private navigation regression: ${message}`);
}

assert(!chatScreen.includes('/(tabs)/updates-screen'), 'Chat must not open the hidden Updates route.');
assert(chatScreen.includes('ServerStoryViewer'), 'Chat Stories must use the standalone Story viewer.');
assert(chatScreen.includes('userStoryViewerItemId'), 'Chat Story viewer must use the shared Story item identity.');
assert(chatScreen.includes('setStoryOpen'), 'Chat must keep Story viewing in its own modal state.');
assert(!updatesScreen.includes('name="play-circle-outline"'), 'Updates must not show the play shortcut in the header.');
assert(!updatesScreen.includes('name="location-outline" label="Open map"'), 'Updates must not show the Map shortcut in the header.');
assert(updatesScreen.includes('storyTextPanResponder'), 'Story text must support direct dragging.');
assert(updatesScreen.includes('Tap the text to edit'), 'Story text must remain directly editable.');
assert(chatScreen.includes("pathname: '/(tabs)/updates', params: { composeType: 'status' }"), 'Chat Story creation must open the social Updates composer.');
assert(!sharedStory.includes('USER_STORY:'), 'Shared Stories must use the canonical Story item identity.');

console.log('Private navigation regression checks passed.');