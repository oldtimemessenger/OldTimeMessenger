import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function NotFoundScreen() {
  const colors = useColors();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          This screen doesn&apos;t exist.
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          The link may be outdated, or that screen is no longer available.
        </Text>

        <Link href="/(tabs)" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.primary }]}>
            Go to chats
          </Text>
        </Link>
        <Link href="/(tabs)/updates" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.primary }]}>
            Go to updates
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  link: {
    marginTop: 12,
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
