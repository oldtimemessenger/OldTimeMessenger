import { Ionicons } from '@expo/vector-icons';
import { deleteAccount } from '@/lib/api-client-react';
import { supabase, useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/OldTimeUi';
import { useOldTime } from '@/context/OldTimeContext';
import { useColors } from '@/hooks/useColors';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';

type IconName = keyof typeof Ionicons.glyphMap;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { profile } = useOldTime();
  const [pending, setPending] = useState(false);

  const signOutUser = async () => {
    if (pending) return;
    setPending(true);
    try {
      await signOut();
      router.replace('/(auth)/sign-in' as never);
    } catch (error) {
      Alert.alert('Could not log out', error instanceof Error ? error.message : 'Please try again.');
      setPending(false);
    }
  };

  const deleteUserAccount = () => {
    if (pending) return;
    Alert.alert(
      'Permanently delete your Old Time account?',
      'This cannot be undone. Your profile, content, messages, uploaded media, and sign-in identity will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setPending(true);
            try {
              await deleteAccount();
              try {
                await signOut();
              } catch {
                // The global sign-out may fail because the server has already
                // deleted this identity. Local credentials must still go.
              } finally {
                const { error } = await supabase.auth.signOut({ scope: 'local' });
                if (error) throw new Error('Your account was deleted, but this device could not clear the local session.');
              }
              router.replace('/(auth)/sign-in' as never);
            } catch (error) {
              Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.');
              setPending(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: TAB_BAR_CONTENT_CLEARANCE }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Pressable onPress={() => router.push('/(tabs)/profile' as never)} style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Open profile">
        <Avatar source={profile?.avatar} name={profile?.name} size={58} accent={profile?.accent} />
        <View style={styles.profileCopy}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>{profile?.name ?? 'Your profile'}</Text>
          <Text style={[styles.profileHandle, { color: colors.mutedForeground }]}>{profile ? `@${profile.handle}` : 'Profile'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={colors.mutedForeground} />
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingsRow
          icon="person-outline"
          title="Profile"
          onPress={() => router.push('/(tabs)/profile' as never)}
          colors={colors}
        />
        <SettingsRow
          icon="calendar-outline"
          title="Birthday"
          subtitle={profile?.birthday ? 'Private profile detail' : 'Optional profile detail'}
          onPress={() => router.push('/edit-profile' as never)}
          colors={colors}
        />
        <SettingsRow
          icon="notifications-outline"
          title="Notifications"
          subtitle="See activity and replies"
          onPress={() => router.push('/notifications' as never)}
          colors={colors}
        />
        <SettingsRow
          icon="briefcase-outline"
          title="Creator Hub"
          subtitle="Partnerships & selling"
          onPress={() => router.push('/creator-hub' as never)}
          colors={colors}
        />
        <SettingsRow
          icon="log-out-outline"
          title="Log out"
          onPress={() => void signOutUser()}
          colors={colors}
          disabled={pending}
          last
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Money</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingsRow
          icon="wallet-outline"
          title="Wallet"
          onPress={() => router.push('/wallet' as never)}
          colors={colors}
        />
        <SettingsRow
          icon="card-outline"
          title="Creator payouts"
          onPress={() => router.push('/payment-settings' as never)}
          colors={colors}
        />
        <SettingsRow
          icon="cash-outline"
          title="Withdraw Gold"
          onPress={() => router.push('/withdraw' as never)}
          colors={colors}
          last
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Help</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingsRow
          icon="help-circle-outline"
          title="FAQ and help"
          subtitle="Find answers about using Old Time"
          onPress={() => router.push('/faq' as never)}
          colors={colors}
          last
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Data</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingsRow
          icon="trash-outline"
          title="Delete account"
          onPress={deleteUserAccount}
          colors={colors}
          destructive
          last
          disabled={pending}
        />
      </View>
    </ScrollView>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  colors,
  destructive = false,
  last = false,
  disabled = false,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  destructive?: boolean;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
       <View style={[styles.iconWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
         <Ionicons name={icon} size={19} color={colors.foreground} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowBody, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  title: { fontFamily: 'Fraunces_900Black', fontSize: 24 },
  profileCard: { minHeight: 96, borderWidth: 1, borderRadius: 24, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  profileCopy: { flex: 1 },
  profileName: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
  profileHandle: { fontFamily: 'Outfit_500Medium', fontSize: 14, marginTop: 4 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, marginBottom: 12, marginLeft: 4 },
  card: { borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, marginBottom: 26 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowCopy: { flex: 1 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
  rowBody: { fontFamily: 'Outfit_400Regular', fontSize: 13, marginTop: 4 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.5 },
});