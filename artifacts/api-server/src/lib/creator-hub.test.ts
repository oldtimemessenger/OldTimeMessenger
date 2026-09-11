import { strict as assert } from "node:assert";
import { commissionCents, isMediaPost, payoutReady, referralAttribution } from "./creator-hub-rules";

assert.equal(commissionCents(1000, 1000), 100);
assert.throws(() => commissionCents(1000, 999));
assert.equal(commissionCents(999, 1250), 124);
assert.equal(isMediaPost([{ type: "image" }]), true);
assert.equal(isMediaPost([{ type: "audio" }]), false);
assert.equal(payoutReady("paid", null, 123), true);
assert.equal(payoutReady("pending", 123, null), false);
assert.equal(referralAttribution("creator-abc", { referralSlug: "creator-abc", creatorUserId: 7 }), 7);
assert.equal(referralAttribution("wrong", { referralSlug: "creator-abc", creatorUserId: 7 }), null);
console.log("CreatorHub pure rules passed");