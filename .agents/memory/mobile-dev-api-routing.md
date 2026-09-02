---
name: Mobile development API routing
description: Development mobile previews can inherit a stale production API domain, and repeated local OTP tests can be blocked by resend throttling.
---

Use the active preview origin for web development API calls instead of trusting a production `EXPO_PUBLIC_DOMAIN`; exempt only the clearly identified development test phone from local OTP resend throttles.

**Why:** The development environment can expose a production domain while the preview router serves the API locally, and repeated verification attempts are common during UI testing.

**How to apply:** When debugging mobile auth or preview-only API failures, compare the requested domain with the active preview route and inspect 429 responses before changing authentication logic.