#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "app/chat/[id].tsx");
let source = readFileSync(target, "utf8");
if (source.includes("messages.isError")) {
  console.log("chat/[id].tsx already has isError UI");
  process.exit(0);
}
const marker = `  if (!session || messages.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <LoadingState />
      </View>
    );
  }`;
const insert = `${marker}

  if (messages.isError) {
    const message = messages.error instanceof Error ? messages.error.message : "This chat could not be loaded.";
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: 28 }]}>
        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "600", textAlign: "center" }}>
          {/not found/i.test(message) ? "Chat not found" : "Chat unavailable"}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 }}>
          {message}
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 18 }} accessibilityRole="button">
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>Go back</Text>
        </Pressable>
        <Pressable onPress={() => void messages.refetch()} style={{ marginTop: 12 }} accessibilityRole="button">
          <Text style={{ color: colors.mutedForeground, fontWeight: "600", fontSize: 15 }}>Try again</Text>
        </Pressable>
      </View>
    );
  }`;
if (!source.includes(marker)) {
  console.error("Could not locate loading early-return in chat/[id].tsx");
  process.exit(1);
}
writeFileSync(target, source.replace(marker, insert));
console.log("Applied chat isError UI to app/chat/[id].tsx");
