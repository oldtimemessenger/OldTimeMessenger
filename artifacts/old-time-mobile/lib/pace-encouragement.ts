import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaceEncouragement = {
  id: string;
  location: string;
  eyebrow: string;
  headline: string;
  body: string;
  action: string;
  activity: 'run' | 'walk' | 'bike' | 'hike';
};

const STORAGE_KEY = '@old-time/pace-encouragement-history';

const PACE_ENCOURAGEMENTS: PaceEncouragement[] = [
  {
    id: 'sydney-reset',
    location: 'Sydney, Australia',
    eyebrow: 'GLOBAL ROUTE PULSE',
    headline: 'Start where you are.',
    body: 'A fresh route idea is warming up in Sydney. Your Pace journey can begin anywhere.',
    action: 'Start a journey',
    activity: 'run',
  },
  {
    id: 'manchester-loop',
    location: 'Manchester, UK',
    eyebrow: 'GLOBAL ROUTE PULSE',
    headline: 'Take the long way home.',
    body: 'A steady loop just surfaced in Manchester. Make your own version wherever you are.',
    action: 'Find a route',
    activity: 'walk',
  },
  {
    id: 'nairobi-climb',
    location: 'Nairobi, Kenya',
    eyebrow: 'GLOBAL ROUTE PULSE',
    headline: 'Earn the view.',
    body: 'A climb is calling from Nairobi. Pick a hill, set a pace, and make the finish yours.',
    action: 'Start a climb',
    activity: 'hike',
  },
  {
    id: 'tokyo-night',
    location: 'Tokyo, Japan',
    eyebrow: 'GLOBAL ROUTE PULSE',
    headline: 'Move through the noise.',
    body: 'A night route idea just surfaced in Tokyo. Ten focused minutes still count.',
    action: 'Start moving',
    activity: 'run',
  },
  {
    id: 'saopaulo-ride',
    location: 'São Paulo, Brazil',
    eyebrow: 'GLOBAL ROUTE PULSE',
    headline: 'Find your rhythm.',
    body: 'A ride is taking shape in São Paulo. Your next good turn does not need a perfect plan.',
    action: 'Plan a ride',
    activity: 'bike',
  },
  {
    id: 'toronto-recovery',
    location: 'Toronto, Canada',
    eyebrow: 'GLOBAL ROUTE PULSE',
    headline: 'Keep it easy today.',
    body: 'A recovery route is on the board in Toronto. Small efforts build the habit.',
    action: 'Take a walk',
    activity: 'walk',
  },
  {
    id: 'paris-golden-hour',
    location: 'Paris, France',
    eyebrow: 'GLOBAL ROUTE PULSE',
    headline: 'Chase the better hour.',
    body: 'A golden-hour route just appeared in Paris. Step outside before the day gets away.',
    action: 'Start a route',
    activity: 'walk',
  },
  {
    id: 'kingston-sunrise',
    location: 'Kingston, Jamaica',
    eyebrow: 'GLOBAL ROUTE PULSE',
    headline: 'Make some space.',
    body: 'A sunrise route is forming in Kingston. Clear your head with one good mile.',
    action: 'Go for it',
    activity: 'run',
  },
  {
    id: 'newyork-tempo',
    location: 'New York, United States',
    eyebrow: 'GLOBAL ROUTE PULSE',
    headline: 'The city is your route.',
    body: 'A tempo idea is moving through New York. Choose a block, a bridge, or a park and begin.',
    action: 'Start a tempo',
    activity: 'run',
  },
];

function nextIndex(now: number, historyLength: number, availableLength: number) {
  const timeSlot = Math.floor(now / (10 * 60 * 1_000));
  return (timeSlot + historyLength * 3) % Math.max(1, availableLength);
}

export async function getNextPaceEncouragement(now = Date.now()): Promise<PaceEncouragement> {
  let history: string[] = [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    history = raw ? JSON.parse(raw) as string[] : [];
  } catch {
    history = [];
  }

  const available = PACE_ENCOURAGEMENTS.filter((item) => !history.includes(item.id));
  const pool = available.length ? available : PACE_ENCOURAGEMENTS.filter((item) => item.id !== history.at(-1));
  const selected = pool[nextIndex(now, history.length, pool.length)] ?? PACE_ENCOURAGEMENTS[0];
  const nextHistory = [...history.filter((id) => id !== selected.id), selected.id].slice(-5);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
  return selected;
}