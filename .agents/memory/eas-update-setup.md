---
name: EAS update setup
description: Durable setup requirements and CLI behavior for publishing Old Time JavaScript updates over the air.
---

EAS Update cannot publish an app that has no Expo Updates runtime configured. The first publish may install `expo-updates` and add the project update URL plus an app-version runtime policy automatically. The CLI can also rewrite unrelated generated platform entries while normalizing config, so review the diff and keep only intentional update configuration before committing.

**Why:** The installed phone bundle can receive JavaScript fixes without a new native build only when its embedded runtime is configured for EAS Updates. Automatic config normalization is broader than the actual requirement and should not silently become product configuration.

**How to apply:** Before publishing, confirm `expo-updates` is in the mobile workspace and the Expo config contains the matching EAS project URL and runtime policy. After publishing, verify the target branch, runtime version, platforms, and update group in EAS, then commit the reviewed config and lockfile changes.