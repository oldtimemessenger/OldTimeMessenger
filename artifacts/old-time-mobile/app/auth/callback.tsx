import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { completeAuthCallback, getSafeAuthError } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

const processedCallbackFingerprints = new Set<string>();

function fingerprintCallback(url: string) {
  let hash = 2166136261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export default function AuthCallbackScreen() {
  const colors = useColors();
  const router = useRouter();
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    const fingerprint = fingerprintCallback(url);
    if (processedCallbackFingerprints.has(fingerprint)) return;
    processedCallbackFingerprints.add(fingerprint);
    if (processedCallbackFingerprints.size > 32) {
      const oldest = processedCallbackFingerprints.values().next().value;
      if (oldest) processedCallbackFingerprints.delete(oldest);
    }
    let active = true;
      void completeAuthCallback(url)
      .then((flow) => {
        if (active) {
          router.replace(flow === 'recovery' ? '/(auth)/sign-in' as never : '/' as never);
        }
      })
      .catch((reason) => {
        if (active) setError(getSafeAuthError(reason, 'Could not finish signing in. Please try again.'));
      });
    return () => {
      active = false;
    };
  }, [router, url]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {error ? (
        <>
          <Text style={[styles.title, { color: colors.foreground }]}>Sign-in could not be completed</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.body, { color: colors.mutedForeground }]}>Finishing your secure sign-in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});