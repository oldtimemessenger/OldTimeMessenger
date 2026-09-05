export type AtmosphereKind = "route" | "motivation" | "world" | "hub" | "pace" | "map" | "external";
export type AtmosphereCard = {
  id: string; kind: AtmosphereKind; origin: "generated" | "legitimate"; label: string;
  title: string; description: string; category: string | null; locationLabel: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  cta: { label: string; action: "map" | "hub" | "pace" | "external" | "none"; value: string | null } | null;
};
export type Interaction = { itemId: string; interaction: "impression" | "open" | "dismiss" | "complete"; createdAt: number };
export type EngineInput = {
  userId: number; sessionId?: string; seed: string; now: number; limit: number; realContentCount: number;
  cooldownHours: number; mutedCategories?: string[]; interests?: string[]; candidates: AtmosphereCard[];
  interactions?: Interaction[]; globalFrequency?: number;
  origin?: { latitude: number; longitude: number };
};
export type RankedCard = AtmosphereCard & { score: number; reasons: string[]; cooldownStatus: string };

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
function shuffle<T>(values: readonly T[], seed: string) {
  return values.map((value, index) => ({ value, n: hash(`${seed}:${index}`) }))
    .sort((a, b) => a.n - b.n).map(({ value }) => value);
}
const cities = [
  ["Miami", 25.7617, -80.1918], ["Atlanta", 33.749, -84.388], ["Tokyo", 35.6762, 139.6503],
  ["Kyoto", 35.0116, 135.7681], ["Barcelona", 41.3874, 2.1686], ["Madrid", 40.4168, -3.7038],
  ["Los Angeles", 34.0522, -118.2437], ["San Diego", 32.7157, -117.1611], ["Lisbon", 38.7223, -9.1393],
  ["Melbourne", -37.8136, 144.9631], ["Nairobi", -1.2921, 36.8219], ["Montreal", 45.5017, -73.5673],
  ["Seoul", 37.5665, 126.978], ["Mexico City", 19.4326, -99.1332], ["Cape Town", -33.9249, 18.4241],
  ["New York", 40.7128, -74.006], ["Paris", 48.8566, 2.3522], ["Accra", 5.6037, -0.187],
] as const;
const promptStarts = [
  "Keep moving", "Make room to reset", "Follow your curiosity", "Choose a gentler pace",
  "Notice one new detail", "Take the scenic turn", "Start smaller than yesterday", "Let today surprise you",
] as const;
const promptEnds = [
  "Your next step matters.", "Small progress still counts.", "A new view can change the whole day.",
  "You do not need the entire route yet.", "Give yourself time to discover what fits.",
  "Consistency can be quiet and still be real.", "One thoughtful choice can change your direction.",
] as const;
const hubTopics = [
  "nursing", "student nurses", "doctors", "fitness", "truck drivers", "travel", "technology",
  "business", "photography", "cooking", "music", "gaming", "running", "cycling", "art", "students",
] as const;

function distanceKm(left: { latitude: number; longitude: number }, right: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const a = Math.sin(radians(right.latitude - left.latitude) / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude))
    * Math.sin(radians(right.longitude - left.longitude) / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Catalog cards are explicitly discovery prompts, never people, posts, rooms, or live activity. */
export function generatedCatalog(seed: string): AtmosphereCard[] {
  const routeCards = cities.flatMap(([originName, originLat, originLon], originIndex) =>
    cities
      .filter((_, destinationIndex) => destinationIndex !== originIndex)
      .map(([destinationName, destinationLat, destinationLon]) => {
        const distance = Math.round(distanceKm(
          { latitude: originLat, longitude: originLon },
          { latitude: destinationLat, longitude: destinationLon },
        ));
        const routeId = `${originName}-${destinationName}`.toLowerCase().replace(/\s/g, "-");
        return {
          id: `generated:route:${routeId}`,
          kind: "route" as const,
          origin: "generated" as const,
          label: "DISCOVERY • ROUTE",
          title: `${originName} → ${destinationName}`,
          description: `Route discovery spanning approximately ${distance.toLocaleString("en-US")} km. Explore the geography and plan it your way.`,
          category: "travel",
          locationLabel: `${originName} to ${destinationName}`,
          coordinates: { latitude: destinationLat, longitude: destinationLon },
          cta: { label: "Explore route", action: "map" as const, value: `${destinationLat},${destinationLon}` },
        };
      }),
  );
  const worldCards = cities.map(([city, latitude, longitude]) => ({
    id: `generated:world:${city.toLowerCase().replace(/\s/g, "-")}`,
    kind: "world" as const,
    origin: "generated" as const,
    label: "DISCOVERY • WORLD",
    title: `Discover something new in ${city}`,
    description: "A world discovery prompt based on a real place—not a claim about a person or confirmed event.",
    category: "world",
    locationLabel: city,
    coordinates: { latitude, longitude },
    cta: { label: "View on map", action: "map" as const, value: `${latitude},${longitude}` },
  }));
  const motivationCards = promptStarts.flatMap((start, startIndex) =>
    promptEnds.map((ending, endingIndex) => ({
      id: `generated:motivation:${startIndex}:${endingIndex}`,
      kind: "motivation" as const,
      origin: "generated" as const,
      label: "DISCOVERY • PROMPT",
      title: `${start}.`,
      description: ending,
      category: "motivation",
      locationLabel: null,
      coordinates: null,
      cta: null,
    })),
  );
  const hubCards = hubTopics.map((topic) => ({
    id: `generated:hub:${topic.replace(/\s/g, "-")}`,
    kind: "hub" as const,
    origin: "generated" as const,
    label: "DISCOVERY • HUB",
    title: `Explore ${topic}`,
    description: `Search public Hubs related to ${topic}. This is a discovery suggestion, not a member or activity claim.`,
    category: topic,
    locationLabel: null,
    coordinates: null,
    cta: { label: "Browse Hubs", action: "hub" as const, value: topic },
  }));
  const paceCards = cities.map(([city, latitude, longitude]) => ({
    id: `generated:pace:${city.toLowerCase().replace(/\s/g, "-")}`,
    kind: "pace" as const,
    origin: "generated" as const,
    label: "DISCOVERY • PACE IDEA",
    title: `Find a route pulse in ${city}`,
    description: "Route inspiration only. No workout, distance, pace, or achievement is being attributed to a person.",
    category: "fitness",
    locationLabel: city,
    coordinates: { latitude, longitude },
    cta: { label: "Open Pace", action: "pace" as const, value: city },
  }));
  return shuffle([...routeCards, ...worldCards, ...motivationCards, ...hubCards, ...paceCards], seed);
}

export function rankAtmosphere(input: EngineInput): RankedCard[] {
  const cooldownMs = input.cooldownHours * 3_600_000;
  const muted = new Set((input.mutedCategories ?? []).map((x) => x.toLowerCase()));
  const history = input.interactions ?? [];
  const cards = [...input.candidates, ...generatedCatalog(input.seed)]
    .filter((card) => (!card.category || !muted.has(card.category.toLowerCase()))
      && (card.kind !== "world" || hash(`${input.seed}:${card.id}:global`) <= (input.globalFrequency ?? 1)));
  const ranked = cards.map((card) => {
    const events = history.filter((event) => event.itemId === card.id);
    const latest = events.reduce((latest, event) => Math.max(latest, event.createdAt), 0);
    const dismissed = events.filter((event) => event.interaction === "dismiss").length;
    const impressions = events.filter((event) => event.interaction === "impression").length;
    const opened = events.filter((event) => event.interaction === "open").length;
    const completed = events.filter((event) => event.interaction === "complete").length;
    const cooling = latest > 0 && input.now - latest < cooldownMs;
    const interest = input.interests?.some((interest) =>
      `${card.category ?? ""} ${card.title}`.toLowerCase().includes(interest.toLowerCase())) ?? false;
    let score = card.origin === "legitimate" ? 40 : 20;
    score += hash(`${input.seed}:${input.userId}:${input.sessionId ?? ""}:${card.id}`) * 12;
    if (interest) score += 18;
    score += completed * 8 - opened * 2 - impressions * 7 - dismissed * 60;
    if (input.origin && card.coordinates) {
      const distance = distanceKm(input.origin, card.coordinates);
      score += Math.max(0, 12 - distance / 50);
    }
    const hour = new Date(input.now).getUTCHours();
    const day = new Date(input.now).getUTCDay();
    if (card.kind === "pace" && hour >= 6 && hour <= 20) score += 4;
    if (card.kind === "motivation" && (hour < 10 || hour > 18)) score += 3;
    if (card.kind === "world" && (day === 0 || day === 6)) score += 3;
    if (cooling) score -= 35;
    return { ...card, score, reasons: [card.origin === "legitimate" ? "legitimate discovery source" : "generated discovery catalog", ...(interest ? ["matches interest"] : []), ...(impressions ? ["repetition penalty"] : []), ...(dismissed ? ["dismissal penalty"] : []), ...(cooling ? ["cooldown active"] : [])], cooldownStatus: cooling ? "active" : "ready" };
  }).sort((a, b) => b.score - a.score);
  // Alternate kinds where possible, so one source cannot dominate the feed.
  const selected: RankedCard[] = [];
  const used = new Set<string>();
  while (selected.length < input.limit && ranked.length) {
    const next = ranked.find((card) => !used.has(card.kind)) ?? ranked[0];
    selected.push(next); used.add(next.kind); ranked.splice(ranked.indexOf(next), 1);
  }
  return selected;
}

export function discoveryTarget(realContentCount: number, configuredTargetRatio: number, maxCards: number) {
  if (maxCards <= 0 || configuredTargetRatio <= 0) return 0;
  if (realContentCount <= 0) return maxCards;
  const maturityCeiling = realContentCount < 5 ? 0.65 : realContentCount < 20 ? 0.4 : realContentCount < 50 ? 0.2 : 0.08;
  const ratio = Math.max(0, Math.min(0.95, configuredTargetRatio, maturityCeiling));
  return Math.max(1, Math.min(maxCards, Math.ceil(realContentCount * ratio / (1 - ratio))));
}