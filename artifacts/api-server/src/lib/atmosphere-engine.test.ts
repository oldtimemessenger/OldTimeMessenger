import assert from "node:assert/strict";
import { discoveryTarget, generatedCatalog, rankAtmosphere } from "./atmosphere-engine";

const candidate = {
  id: "hub:1", kind: "hub" as const, origin: "legitimate" as const, label: "DISCOVERY • HUB",
  title: "Running", description: "A public hub.", category: "fitness", locationLabel: null,
  coordinates: null, cta: { label: "Open discovery", action: "hub" as const, value: "running" },
};
const input = { userId: 7, sessionId: "a", seed: "fixed", now: 1_000_000, limit: 6, realContentCount: 0, cooldownHours: 24, candidates: [candidate] };
const first = rankAtmosphere(input);
assert.deepEqual(rankAtmosphere(input), first, "a fixed seed must be deterministic");
assert.notDeepEqual(rankAtmosphere({ ...input, userId: 8, sessionId: "b" }), first, "viewer/session affects ordering");
const penalized = rankAtmosphere({ ...input, interactions: [{ itemId: "hub:1", interaction: "dismiss" as const, createdAt: input.now }] });
assert.ok((penalized.find((item) => item.id === "hub:1")?.score ?? 0) < (first.find((item) => item.id === "hub:1")?.score ?? 0), "dismissal penalizes score");
assert.ok(discoveryTarget(30, 0.5, 12) < discoveryTarget(0, 0.5, 12), "real activity reduces discovery target");
const catalog = generatedCatalog("catalog-test");
assert.ok(catalog.filter((item) => item.kind === "route").length > 100, "route catalog supports more than 100 combinations");
assert.ok(catalog.length > 400, "composed discovery catalog has broad variety");
assert.ok(first.every((item) => item.label.startsWith("DISCOVERY") && !/live|@/i.test(`${item.label} ${item.title}`)), "cards cannot impersonate people or LIVE");
console.log("atmosphere engine tests passed");