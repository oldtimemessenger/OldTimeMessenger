#!/usr/bin/env bash
# Run from repo root on Replit or local machine with git write access.
set -euo pipefail
curl -fsSL "https://raw.githubusercontent.com/oldtimemessenger/OldTimeMessenger/8d75e7dc830e4f4e27f34d4ec1f4b326015c5963/artifacts/api-server/src/routes/chat.ts" \
  -o artifacts/api-server/src/routes/chat.ts

python3 - <<'PY'
from pathlib import Path
path = Path("artifacts/api-server/src/routes/chat.ts")
text = path.read_text()
old = '''  const birthdayInput = typeof body.birthday === "string" ? body.birthday : undefined;
  const birthday = birthdayInput
    ? /^\\d{4}-\\d{2}-\\d{2}$/.test(birthdayInput)
      ? birthdayInput
      : (() => {
          const parsed = new Date(birthdayInput);
          return Number.isNaN(parsed.getTime()) ? birthdayInput : parsed.toISOString().slice(0, 10);
        })()
    : undefined;
  const contactPermission = body.contactPermission;
  const phoneNumber = body.phoneNumber;
  const phoneDiscoveryPermission = body.phoneDiscoveryPermission;
  const chatPresence = body.chatPresence;
  const avatarObjectPath = typeof body.avatarObjectPath === "string" ? body.avatarObjectPath : undefined;
  const validBirthday = birthday === undefined || isValidBirthday(birthday);
  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    (name === undefined && username === undefined && bio === undefined && birthday === undefined && contactPermission === undefined && phoneNumber === undefined && phoneDiscoveryPermission === undefined && chatPresence === undefined && avatarObjectPath === undefined) ||
    (name !== undefined && (name.length < 1 || name.length > 80)) ||
    (username !== undefined && !/^[a-z0-9_]{3,24}$/.test(username)) ||
    (bio !== undefined && bio.length > 150) ||
    (avatarObjectPath !== undefined && !/^\\/objects\\/uploads\\/[0-9a-f-]{36}$/i.test(avatarObjectPath)) ||
    !validBirthday ||
    (contactPermission !== undefined &&
      !["everyone", "followers", "nobody"].includes(contactPermission)) ||
    (chatPresence !== undefined && !["available", "busy", "dnd"].includes(chatPresence)) ||
    (phoneNumber !== undefined && phoneNumber !== null && typeof phoneNumber !== "string") ||
    (phoneDiscoveryPermission !== undefined &&
      !["contacts", "everyone", "nobody"].includes(phoneDiscoveryPermission))
  ) {
    res.status(400).json({ error: "Enter a valid profile value, including a real birthday that is not in the future." });
    return;
  }'''
new = '''  const birthdayInput = typeof body.birthday === "string" ? body.birthday.trim() : undefined;
  // Birthday is optional. Only accept a clean YYYY-MM-DD past/present date.
  let birthday: string | undefined = undefined;
  if (birthdayInput) {
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(birthdayInput) && isValidBirthday(birthdayInput)) {
      birthday = birthdayInput;
    } else if (birthdayInput.length > 0) {
      res.status(400).json({ error: "Enter a real birthday as YYYY-MM-DD that is not in the future, or leave it blank." });
      return;
    }
  }
  const contactPermission = body.contactPermission;
  const phoneNumber = body.phoneNumber;
  const phoneDiscoveryPermission = body.phoneDiscoveryPermission;
  const chatPresence = body.chatPresence;
  const avatarObjectPath = typeof body.avatarObjectPath === "string" ? body.avatarObjectPath : undefined;
  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    (name === undefined && username === undefined && bio === undefined && birthday === undefined && contactPermission === undefined && phoneNumber === undefined && phoneDiscoveryPermission === undefined && chatPresence === undefined && avatarObjectPath === undefined) ||
    (name !== undefined && (name.length < 1 || name.length > 80)) ||
    (username !== undefined && !/^[a-z0-9_]{3,24}$/.test(username)) ||
    (bio !== undefined && bio.length > 150) ||
    (avatarObjectPath !== undefined && !/^\\/objects\\/uploads\\/[0-9a-f-]{36}$/i.test(avatarObjectPath)) ||
    (contactPermission !== undefined &&
      !["everyone", "followers", "nobody"].includes(contactPermission)) ||
    (chatPresence !== undefined && !["available", "busy", "dnd"].includes(chatPresence)) ||
    (phoneNumber !== undefined && phoneNumber !== null && typeof phoneNumber !== "string") ||
    (phoneDiscoveryPermission !== undefined &&
      !["contacts", "everyone", "nobody"].includes(phoneDiscoveryPermission))
  ) {
    res.status(400).json({ error: "Enter a valid profile value." });
    return;
  }'''
if old not in text:
    raise SystemExit("Could not find birthday validation block — file may already be patched or unexpected.")
path.write_text(text.replace(old, new, 1))
print("Restored and patched:", path, "bytes=", path.stat().st_size)
PY

git add artifacts/api-server/src/routes/chat.ts
git commit -m "fix: restore full chat.ts with optional birthday validation" || true
git push origin HEAD
echo "DONE — verify: wc -c artifacts/api-server/src/routes/chat.ts  (expect ~63000+)"
