import assert from "node:assert/strict";
import { hasVerificationBadge } from "./verification";

assert.equal(hasVerificationBadge({}), false);
assert.equal(hasVerificationBadge({ verificationPaidAt: null, verificationApprovedAt: null }), false);
assert.equal(hasVerificationBadge({ verificationPaidAt: Date.now(), verificationApprovedAt: null }), true);
assert.equal(hasVerificationBadge({ verificationPaidAt: null, verificationApprovedAt: Date.now() }), true);
assert.equal(hasVerificationBadge({ verificationPaidAt: 0, verificationApprovedAt: null }), false);

console.log("Verification badge state checks passed.");