#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "app/current-event/[id].tsx");
let source = readFileSync(target, "utf8");
if (source.includes("sendingGiftRef")) {
  console.log("gift double-submit guard already present");
  process.exit(0);
}

const oldFn = `async function sendGift(gift: (typeof gifts)[number]) {
    if (!room || !activeRecipientId) return;
    if (wallet.coins < gift.cost) {
      setGiftOpen(false);
      setStoreOpen(true);
      return;
    }
    try {
      const result = await sendCurrentEventGift(room.id, { gift: gift.key, recipientId: activeRecipientId });
      setWallet((current) => ({ ...current, coins: result.coinsRemaining }));
      setGiftOpen(false);
      setFeedback('Gift sent.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Gift not sent.');
    }
  }`;

const newFn = `const sendingGiftRef = useRef(false);

  async function sendGift(gift: (typeof gifts)[number]) {
    if (!room || !activeRecipientId || sendingGiftRef.current) return;
    if (wallet.coins < gift.cost) {
      setGiftOpen(false);
      setStoreOpen(true);
      return;
    }
    sendingGiftRef.current = true;
    try {
      const result = await sendCurrentEventGift(room.id, { gift: gift.key, recipientId: activeRecipientId });
      setWallet((current) => ({ ...current, coins: result.coinsRemaining }));
      setGiftOpen(false);
      setFeedback('Gift sent.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Gift not sent.');
    } finally {
      sendingGiftRef.current = false;
    }
  }`;

if (!source.includes(oldFn)) {
  console.error("Could not locate sendGift function in current-event/[id].tsx");
  process.exit(1);
}
writeFileSync(target, source.replace(oldFn, newFn));
console.log("Applied gift double-submit guard to current-event/[id].tsx");
