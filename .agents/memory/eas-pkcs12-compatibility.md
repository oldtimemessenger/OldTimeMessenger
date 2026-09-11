---
name: EAS PKCS#12 compatibility
description: Compatibility rule for distribution certificates assembled with OpenSSL and imported by EAS.
---

When a valid Apple Distribution certificate is assembled into a `.p12` outside macOS and EAS reports that the distribution certificate was not imported successfully, regenerate the same certificate/private-key bundle with legacy PKCS#12 encryption before replacing the remote credential.

**Why:** EAS can decrypt or fingerprint the certificate while the macOS build keychain still rejects the OpenSSL 3 default PKCS#12 encryption format.

**How to apply:** Reuse the existing Apple `.cer`, matching private key, and provisioning profiles; only repackage the `.p12` with legacy-compatible encryption and upload it through the secure credential flow.