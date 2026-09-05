---
name: Photo-to-chat handoff
description: Rules for preserving captured media while routing through recipient selection into an existing or new chat.
---

Captured media must travel through both chat-opening branches: reuse an existing direct chat or create a new one. Opening a chat must not wait for message history before showing the media draft, and API requests need a finite timeout so a slow history request cannot make the screen appear blank.

**Why:** Recipient selection previously dropped media for existing chats, while the chat screen blocked the composer on an indefinitely loading history query.

**How to apply:** When changing camera-to-chat navigation, pass the media route parameters in every branch, keep draft UI independent of message-history loading, and preserve a visible retry/error state.