import type { UpdatePost } from '@/context/app-state';

export type InterestNode = {
  id: string;
  name: string;
  blurb?: string;
  sub?: readonly InterestNode[];
};

const flat = (names: readonly string[], prefix: string): InterestNode[] =>
  names.map((name) => ({
    id: `${prefix}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
  }));

const NBA_TEAMS = [
  'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls',
  'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors',
  'Houston Rockets', 'Indiana Pacers', 'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies',
  'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
  'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers',
  'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards',
] as const;

const NFL_TEAMS = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills', 'Carolina Panthers',
  'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns', 'Dallas Cowboys', 'Denver Broncos',
  'Detroit Lions', 'Green Bay Packers', 'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars',
  'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants', 'New York Jets',
  'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers', 'Seattle Seahawks',
  'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
] as const;

const MLB_TEAMS = [
  'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox', 'Chicago Cubs',
  'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians', 'Colorado Rockies', 'Detroit Tigers',
  'Houston Astros', 'Kansas City Royals', 'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins',
  'Milwaukee Brewers', 'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
  'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
  'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers', 'Toronto Blue Jays',
  'Washington Nationals',
] as const;

const NHL_TEAMS = [
  'Anaheim Ducks', 'Boston Bruins', 'Buffalo Sabres', 'Calgary Flames', 'Carolina Hurricanes',
  'Chicago Blackhawks', 'Colorado Avalanche', 'Columbus Blue Jackets', 'Dallas Stars', 'Detroit Red Wings',
  'Edmonton Oilers', 'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild', 'Montreal Canadiens',
  'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers', 'Ottawa Senators',
  'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks', 'Seattle Kraken', 'St. Louis Blues',
  'Tampa Bay Lightning', 'Toronto Maple Leafs', 'Utah Hockey Club', 'Vancouver Canucks',
  'Vegas Golden Knights', 'Washington Capitals', 'Winnipeg Jets',
] as const;

const SOCCER: InterestNode[] = [
  { id: 'soccer-epl', name: 'Premier League', sub: flat(['Arsenal', 'Aston Villa', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United', 'Tottenham Hotspur'], 'epl') },
  { id: 'soccer-laliga', name: 'La Liga', sub: flat(['Real Madrid', 'Barcelona', 'Atlético Madrid', 'Athletic Bilbao'], 'laliga') },
  { id: 'soccer-seriea', name: 'Serie A', sub: flat(['Juventus', 'AC Milan', 'Inter Milan', 'Napoli'], 'seriea') },
  { id: 'soccer-bundesliga', name: 'Bundesliga', sub: flat(['Bayern Munich', 'Borussia Dortmund', 'Bayer Leverkusen'], 'bundesliga') },
  { id: 'soccer-ligue1', name: 'Ligue 1', sub: flat(['Paris Saint-Germain', 'Marseille', 'Monaco'], 'ligue1') },
  { id: 'soccer-mls', name: 'MLS', sub: flat(['Inter Miami CF', 'LA Galaxy', 'LAFC', 'Seattle Sounders FC'], 'mls') },
  { id: 'soccer-national', name: 'National Teams', sub: flat(['USA', 'Mexico', 'Brazil', 'Argentina', 'England', 'France', 'Spain', 'Germany'], 'nt') },
];

export const INTEREST_TREE: readonly InterestNode[] = [
  { id: 'news', name: 'News', blurb: 'Breaking stories and daily coverage', sub: flat(['Politics', 'World', 'National', 'Local', 'Climate', 'Elections'], 'news') },
  {
    id: 'sports', name: 'Sports', blurb: 'Scores, teams, and leagues',
    sub: [
      { id: 'nba', name: 'NBA', sub: flat(NBA_TEAMS, 'nba') },
      { id: 'nfl', name: 'NFL', sub: flat(NFL_TEAMS, 'nfl') },
      { id: 'mlb', name: 'MLB', sub: flat(MLB_TEAMS, 'mlb') },
      { id: 'nhl', name: 'NHL', sub: flat(NHL_TEAMS, 'nhl') },
      { id: 'soccer', name: 'Soccer', sub: SOCCER },
      { id: 'ncaaf', name: 'College Football', sub: flat(['SEC', 'Big Ten', 'ACC', 'Big 12', 'American', 'Mountain West'], 'ncaaf') },
      { id: 'ncaab', name: 'College Basketball', sub: flat(['SEC', 'Big Ten', 'ACC', 'Big 12', 'Big East'], 'ncaab') },
      { id: 'tennis', name: 'Tennis', sub: flat(['ATP Tour', 'WTA Tour', 'Grand Slams'], 'tennis') },
      { id: 'golf', name: 'Golf', sub: flat(['PGA Tour', 'LIV Golf', 'LPGA', 'The Majors'], 'golf') },
      { id: 'f1', name: 'Formula 1', sub: flat(['Red Bull Racing', 'Ferrari', 'Mercedes', 'McLaren', 'Aston Martin', 'Williams', 'Alpine'], 'f1') },
      { id: 'mma', name: 'MMA / UFC' },
      { id: 'boxing', name: 'Boxing' },
      { id: 'cricket', name: 'Cricket', sub: flat(['IPL', 'Test Cricket', 'T20 World Cup'], 'cricket') },
      { id: 'rugby', name: 'Rugby', sub: flat(['Six Nations', 'Rugby Championship', 'Rugby World Cup'], 'rugby') },
      { id: 'olympics', name: 'Olympics', sub: flat(['Summer Games', 'Winter Games'], 'olympics') },
    ],
  },
  { id: 'politics', name: 'Politics', blurb: 'Policy, elections, and government', sub: flat(['Local Politics', 'National Politics', 'World Politics', 'Elections', 'Policy & Legislation'], 'politics') },
  { id: 'health', name: 'Health & Wellness', blurb: 'Medicine, fitness, and mental health', sub: flat(['Mental Health', 'Nutrition', 'Fitness', 'Medicine', 'Public Health', 'Sleep'], 'health') },
  { id: 'business', name: 'Business', blurb: 'Money, work, and the economy', sub: flat(['Markets', 'Startups', 'Personal Finance', 'Economy', 'Real Estate', 'Crypto'], 'business') },
  { id: 'technology', name: 'Technology', blurb: 'Products, startups, and science', sub: flat(['AI', 'Gadgets', 'Startups', 'Cybersecurity', 'Space'], 'technology') },
  { id: 'entertainment', name: 'Entertainment', blurb: 'Movies, TV, and celebrity', sub: flat(['Movies', 'TV', 'Celebrity', 'Streaming', 'Awards Shows'], 'entertainment') },
  { id: 'music', name: 'Music', blurb: 'New releases and live sessions', sub: flat(['Pop', 'Hip-Hop', 'Rock', 'Latin', 'Electronic', 'Country'], 'music') },
  { id: 'food', name: 'Food', blurb: 'Recipes, restaurants, and chefs', sub: flat(['Recipes', 'Restaurants', 'Chefs', 'Baking'], 'food') },
  { id: 'travel', name: 'Travel', blurb: 'Places, guides, and getaways' },
  { id: 'culture', name: 'Culture', blurb: 'People, ideas, and community' },
  { id: 'science', name: 'Science', blurb: 'Discovery and research' },
  { id: 'gaming', name: 'Gaming', blurb: 'Esports, releases, and reviews', sub: flat(['Esports', 'PC', 'Console', 'Mobile'], 'gaming') },
  { id: 'fashion', name: 'Fashion', blurb: 'Style, runway, and design' },
];

export const NEARBY_INTEREST: InterestNode = {
  id: 'nearby',
  name: 'Near you',
  blurb: 'Stories and events based on your location',
};

export const INTEREST_ROOTS: readonly InterestNode[] = [NEARBY_INTEREST, ...INTEREST_TREE];

function flatten(nodes: readonly InterestNode[], parent = ''): Array<{ id: string; label: string; description: string }> {
  return nodes.flatMap((node) => {
    const description = node.blurb ?? (parent ? `${parent} coverage` : 'Personalized updates and recommendations');
    const current = [{ id: node.id, label: node.name, description }];
    return node.sub ? current.concat(flatten(node.sub, node.name)) : current;
  });
}

export const INTEREST_OPTIONS = [
  ...flatten(INTEREST_ROOTS),
  { id: 'fitness', label: 'Fitness', description: 'Training, wellness, and movement' },
] as const;

export type InterestId = typeof INTEREST_OPTIONS[number]['id'];
export type InteractionKind = 'open' | 'like' | 'save' | 'comment' | 'share' | 'hide';

function interestMatchesTag(interest: string, tag: string) {
  const selected = interest.toLowerCase();
  const normalizedTag = tag.toLowerCase();
  return selected === normalizedTag
    || selected.endsWith(`-${normalizedTag}`)
    || normalizedTag.endsWith(`-${selected}`)
    || selected.includes(`-${normalizedTag}-`)
    || normalizedTag.includes(`-${selected}-`);
}

export function rankForYou(posts: UpdatePost[], interests: string[], weights: Record<string, number>) {
  const now = Date.now();
  return posts
    .map((post) => {
      const interestBoost = interests.some((interest) => interestMatchesTag(interest, post.tag)) ? 40 : 0;
      const behaviorBoost = weights[post.tag.toLowerCase()] ?? 0;
      const ageHours = Math.max(1, (now - post.createdAt) / 3600000);
      const freshnessBoost = Math.max(0, 12 - ageHours);
      return { post, score: interestBoost + behaviorBoost + freshnessBoost };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
}