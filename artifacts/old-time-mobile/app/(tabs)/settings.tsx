import { Ionicons } from '@expo/vector-icons';
import React, { useState, useMemo } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, PrimaryButton, Screen } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { useLogout } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { setPresencePrivacy, setSharingExcluded, updateUserProfile } from '@/lib/social-api';

type Panel = 'profile' | 'notifications' | 'socialPrivacy' | 'storage' | 'appearance' | 'power' | 'language' | 'saved' | 'calls' | 'chatSettings' | 'faq' | null;

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const { profile, settings, savedMessages, calls, session, updateProfile, updateSettings, addSavedMessage, setSession, resetLocalData } = useApp();

  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState('');
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'clearing' | 'cleared' | 'error'>('idle');

  // Profile state
  const [draftName, setDraftName] = useState(profile.name);
  const [draftUsername, setDraftUsername] = useState(profile.username);
  const [draftBio, setDraftBio] = useState(profile.bio);

  const faqs = [
    { q: 'What is Old Time?', a: 'A private messenger with chats, status updates, device location sharing, and phone calls to your contacts.' },
    { q: 'How are chats protected?', a: 'Old Time requires an active signed-in session before chat data can be requested.' },
    { q: 'How long do status updates last?', a: 'Status updates remain available on this device for 24 hours after they are created.' }
  ];
  const [faqOpen, setFaqOpen] = useState(-1);

  const [savedInput, setSavedInput] = useState('');

  function toggle(key: keyof typeof settings) {
    updateSettings({ [key]: !settings[key] } as Partial<typeof settings>);
  }

  async function toggleLastSeen() {
    const next = !settings.lastSeen;
    updateSettings({ lastSeen: next });
    if (!session?.authToken) return;
    try {
      await setPresencePrivacy(session.authToken, session.id, next);
    } catch (error) {
      updateSettings({ lastSeen: !next });
      Alert.alert('Privacy setting not saved', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  function signOut() {
    logout.mutate(undefined);
    setSession(null);
    resetLocalData();
    queryClient.clear();
    router.replace('/');
  }

  async function chooseProfilePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const selectedUri = result.assets[0].uri;
      try {
        if (Platform.OS === 'web') {
          updateProfile({ avatarUri: selectedUri });
          return;
        }
        const source = new File(selectedUri);
        const destination = new File(Paths.document, `old-time-profile-${session?.id ?? 'local'}${source.extension || '.jpg'}`);
        if (destination.exists) destination.delete();
        source.copy(destination);
        updateProfile({ avatarUri: destination.uri });
      } catch {
        Alert.alert('Photo not saved', 'Old Time could not store that photo. Choose another image and try again.');
      }
    }
  }

  async function saveProfileChanges(input: { name?: string; username?: string; bio?: string }) {
    if (!session?.authToken) {
      updateProfile(input);
      return;
    }
    try {
      const updated = await updateUserProfile(session.authToken, session.id, input);
      updateProfile({ name: updated.name, username: updated.username, bio: updated.bio, phone: updated.phone });
      setSession({ ...session, ...updated });
      return true;
    } catch (error) {
      Alert.alert('Profile not saved', error instanceof Error ? error.message : 'Please try again.');
      return false;
    }
  }

  async function handleSaveProfile() {
    const saved = await saveProfileChanges({ name: draftName, username: draftUsername, bio: draftBio });
    if (saved !== false) {
      Alert.alert('Profile saved', 'Your Old Time identity is up to date.');
      setPanel(null);
    }
  }

  async function updateContactPermission(next: 'everyone' | 'followers' | 'nobody') {
    const previous = settings.contactPermission;
    updateSettings({ contactPermission: next });
    if (!session?.authToken) return;
    try {
      const updated = await updateUserProfile(session.authToken, session.id, { contactPermission: next });
      setSession({ ...session, ...updated });
    } catch (error) {
      updateSettings({ contactPermission: previous });
      Alert.alert('Contact setting not saved', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function clearCache() {
    setCacheStatus('clearing');
    try {
      queryClient.clear();
      await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
      setCacheStatus('cleared');
    } catch {
      setCacheStatus('error');
    }
  }

  const groups = useMemo(() => ([
      { items: [
      { key: "profile", icon: "person", bg: colors.settingsRed, label: "My Profile", value: profile.name, onPress: () => { setDraftName(profile.name); setDraftUsername(profile.username); setDraftBio(profile.bio); setPanel('profile'); } },
      { key: "saved", icon: "bookmark", bg: colors.settingsCyan, label: "Saved Messages", value: String(savedMessages.length), onPress: () => setPanel('saved') },
    ]},
    { items: [
      { key: "calls", icon: "call", bg: colors.settingsGreen, label: "Recent Calls", onPress: () => setPanel('calls') },
      { key: "chatSettings", icon: "chatbubbles", bg: colors.settingsCyan, label: "Chat Settings", onPress: () => setPanel('chatSettings') },
    ]},
    { items: [
      { key: "notifications", icon: "notifications", bg: colors.settingsRed, label: "Notifications and Sounds", value: settings.notifications ? "On" : "Off", onPress: () => setPanel('notifications') },
      { key: "socialPrivacy", icon: "lock-closed", bg: colors.settingsGray, label: "Privacy and Security", value: "Status, location, presence", onPress: () => setPanel('socialPrivacy') },
      { key: "storage", icon: "server", bg: colors.settingsGreen, label: "Data and Storage", value: "On device", onPress: () => setPanel('storage') },
      { key: "appearance", icon: "contrast", bg: colors.settingsCyan, label: "Appearance", onPress: () => setPanel('appearance') },
      { key: "power", icon: "battery-half", bg: colors.settingsYellow, label: "Power Saving", value: settings.lowPower ? "On" : "Off", onPress: () => setPanel('power') },
      { key: "language", icon: "globe", bg: colors.settingsViolet, label: "Language", value: settings.language, onPress: () => setPanel('language') },
    ]},
    { title: "Old Time", items: [
       { key: "faq", icon: "help-circle", bg: colors.settingsCyan, label: "Old Time FAQ", onPress: () => setPanel('faq') },
    ]},
    { items: [
       { key: "logout", icon: "log-out", bg: colors.settingsRed, label: "Log Out", danger: true, onPress: signOut },
    ]},
  ] as const), [colors, profile, savedMessages.length, settings, logout]);

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  function renderPanel() {
    switch (panel) {
      case 'profile':
        return (
          <DetailShell title="Edit Profile" onBack={() => setPanel(null)}>
            <PanelSection>
              <View style={[styles.profileEditor, { backgroundColor: colors.card }]}>
                <View style={styles.profileEditorAvatar}>
                  <Avatar name={draftName || 'User'} size={96} color={colors.primary} uri={profile.avatarUri} />
                  <View style={[styles.profileEditorCamera, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </View>
                </View>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  style={[styles.profileEditorNameInput, { color: colors.foreground, borderBottomColor: colors.primary }]}
                  textAlign="center"
                />
                <Text style={[styles.profileEditorPhone, { color: colors.mutedForeground }]}>{session?.phone}</Text>
                <TextInput
                  value={draftBio}
                  onChangeText={setDraftBio}
                  placeholder="Add a bio"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={150}
                  multiline
                  textAlignVertical="top"
                  style={[styles.profileEditorBioInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  accessibilityLabel="Profile bio"
                />
                <Text style={[styles.profileEditorBioCount, { color: colors.mutedForeground }]}>{draftBio.length}/150</Text>
                <PrimaryButton label="Save Profile" onPress={() => void handleSaveProfile()} />
              </View>
            </PanelSection>
            <PanelSection>
              <Pressable onPress={() => void chooseProfilePhoto()} style={[styles.panelRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                <View style={[styles.settingIcon, { backgroundColor: colors.brandBlue }]}><Ionicons name="camera" size={16} color="#fff" /></View>
                <Text style={[styles.panelRowLabel, { flex: 1, color: colors.foreground, marginLeft: 16 }]}>Set Profile Photo</Text>
                <Text style={[styles.panelActionText, { color: colors.primary }]}>Choose</Text>
              </Pressable>
              <View style={[styles.panelRow, { borderBottomColor: 'transparent', backgroundColor: colors.card }]}>
                 <View style={[styles.settingIcon, { backgroundColor: '#8B5CF6' }]}><Ionicons name="at" size={16} color="#fff" /></View>
                <TextInput
                  value={draftUsername}
                  onChangeText={setDraftUsername}
                  placeholder="username"
                  autoCapitalize="none"
                  placeholderTextColor={colors.mutedForeground}
                  style={{ flex: 1, fontSize: 16, color: colors.foreground, marginLeft: 16 }}
                />
                <Pressable onPress={() => void saveProfileChanges({ username: draftUsername })}>
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Save</Text>
                </Pressable>
              </View>
            </PanelSection>
          </DetailShell>
        );

      case 'saved':
        return (
          <DetailShell title="Saved Messages" onBack={() => setPanel(null)}>
            <View style={{ flex: 1 }}>
              <View style={[styles.saveComposer, { backgroundColor: colors.background }]}>
                <TextInput
                  value={savedInput}
                  onChangeText={setSavedInput}
                  placeholder="Save a message..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.saveInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                />
                <Pressable onPress={() => { if(savedInput.trim()){ addSavedMessage(savedInput.trim()); setSavedInput(''); } }} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="send" size={16} color="#fff" />
                </Pressable>
              </View>
              {savedMessages.length === 0 ? (
                 <Text style={{ padding: 16, color: colors.mutedForeground, textAlign: 'center' }}>Keep reminders, recipes, and anything you want to find later.</Text>
              ) : savedMessages.map((msg, i) => (
                <View key={i} style={[styles.savedBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ color: colors.foreground, fontSize: 15 }}>{msg}</Text>
                </View>
              ))}
            </View>
          </DetailShell>
        );

      case 'socialPrivacy':
        return (
          <DetailShell title="Status and Location" onBack={() => setPanel(null)}>
            <View style={[styles.privacyNotice, { backgroundColor: colors.secondary }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
              <Text style={[styles.privacyNoticeText, { color: colors.foreground }]}>These are your starting choices. Public sharing still requires you to choose Public before each post.</Text>
            </View>
            <PanelSection title="Presence">
              <PanelToggleRow
                label="Show online and last seen"
                sub="Let contacts see when you are online and the last time you were active."
                value={settings.lastSeen}
                onChange={() => void toggleLastSeen()}
                isLast
              />
            </PanelSection>
            <PanelSection title="Who may message you">
              {([
                ['everyone', 'Everyone', 'Anyone can send a message request.'],
                ['followers', 'People you follow', 'Only accounts you follow can send a request.'],
                ['nobody', 'No one', 'Keep new message requests turned off.'],
              ] as const).map(([permission, label, sub], index, items) => (
                <AudienceRow
                  key={permission}
                  label={label}
                  sub={sub}
                  value={settings.contactPermission === permission}
                  onPress={() => void updateContactPermission(permission)}
                  isLast={index === items.length - 1}
                />
              ))}
            </PanelSection>
            <PanelSection title="Default status audience">
              {(['public', 'friends', 'followers', 'close_friends', 'private'] as const).map((audience, index, items) => (
                <AudienceRow key={audience} label={audience === 'public' ? 'Public (choose per update)' : sharingLabel(audience)} value={audience !== 'public' && settings.statusAudience === audience} onPress={() => audience === 'public' ? Alert.alert('Public is always a fresh choice', 'For safety, Public cannot be saved as your default. Choose Public while composing each update.') : updateSettings({ statusAudience: audience })} isLast={index === items.length - 1} />
              ))}
            </PanelSection>
            <PanelSection title="Default location audience">
              {(['public', 'friends', 'followers', 'private'] as const).map((audience, index, items) => (
                <AudienceRow key={audience} label={audience === 'public' ? 'Public (choose per pin)' : sharingLabel(audience)} value={audience !== 'public' && settings.locationAudience === audience} onPress={() => audience === 'public' ? Alert.alert('Public is always a fresh choice', 'For safety, Public cannot be saved as your default. Choose Public while composing each location pin.') : updateSettings({ locationAudience: audience })} isLast={index === items.length - 1} />
              ))}
            </PanelSection>
            <PanelSection title="Never share with">
              {settings.excludedPeople.length === 0 ? (
                <View style={[styles.excludedEmpty, { backgroundColor: colors.card }]}>
                  <Ionicons name="eye-off-outline" size={22} color={colors.primary} />
                  <Text style={[styles.excludedEmptyTitle, { color: colors.foreground }]}>No one is excluded</Text>
                  <Text style={[styles.excludedEmptyText, { color: colors.mutedForeground }]}>Open someone’s profile card from Updates and choose “Toggle excluded from sharing.”</Text>
                </View>
              ) : settings.excludedPeople.map((person, index) => (
                <View key={person.id} style={[styles.panelRow, { backgroundColor: colors.card, borderBottomColor: index === settings.excludedPeople.length - 1 ? 'transparent' : colors.border }]}>
                  <Avatar name={person.name} size={34} color={colors.primary} />
                  <Text style={[styles.excludedName, { color: colors.foreground }]}>{person.name}</Text>
                  <Pressable onPress={() => {
                    if (!session?.authToken) return;
                    void setSharingExcluded(session.authToken, person.id, false).then(() => {
                      updateSettings({ excludedPeople: settings.excludedPeople.filter((item) => item.id !== person.id) });
                    }).catch(() => Alert.alert('Sharing list not updated', 'Please try again.'));
                  }} accessibilityRole="button" accessibilityLabel={`Remove ${person.name} from excluded people`}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </PanelSection>
          </DetailShell>
        );

      case 'calls':
        return (
          <DetailShell title="Recent Calls" onBack={() => setPanel(null)}>
            <PanelSection>
              {calls.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: colors.mutedForeground }}>No recent calls.</Text>
                </View>
              ) : calls.map((c, i) => (
                <View key={c.id} style={[styles.panelRow, { backgroundColor: colors.card, borderBottomColor: i === calls.length - 1 ? 'transparent' : colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: c.direction === 'missed' ? colors.destructive : colors.foreground }}>{c.name}</Text>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>{new Date(c.createdAt).toLocaleString()} {c.duration ? `• ${c.duration}` : ''}</Text>
                  </View>
                  <Ionicons name={c.type === 'video' ? 'videocam' : 'call'} size={18} color={colors.mutedForeground} />
                </View>
              ))}
            </PanelSection>
          </DetailShell>
        );

      case 'chatSettings':
        return (
          <DetailShell title="Chats" onBack={() => setPanel(null)}>
            <PanelSection>
              <PanelToggleRow label="Enter to send" value={settings.enterToSend} onChange={() => toggle('enterToSend')} />
              <PanelToggleRow label="Autoplay media" value={settings.autoplay} onChange={() => toggle('autoplay')} />
              <PanelToggleRow label="Read receipts" value={settings.readReceipts} onChange={() => toggle('readReceipts')} isLast />
            </PanelSection>
          </DetailShell>
        );

      case 'notifications':
        return (
          <DetailShell title="Notifications and Sounds" onBack={() => setPanel(null)}>
            <PanelSection>
              <PanelToggleRow label="Notifications" sub="Show alerts for new messages and activity." value={settings.notifications} onChange={() => toggle('notifications')} />
              <PanelToggleRow label="Sounds" sub="Play a sound for new messages and calls." value={settings.sounds} onChange={() => toggle('sounds')} />
              <PanelToggleRow label="Message previews" sub="Show message text in notifications." value={settings.previews} onChange={() => toggle('previews')} isLast />
            </PanelSection>
          </DetailShell>
        );

      case 'faq':
        return (
          <DetailShell title="Old Time FAQ" onBack={() => setPanel(null)}>
            <PanelSection>
              {faqs.map((f, i) => (
                <View key={i} style={{ backgroundColor: colors.card, borderBottomWidth: i === faqs.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                  <Pressable onPress={() => setFaqOpen(faqOpen === i ? -1 : i)} style={[styles.panelRow, { borderBottomWidth: 0 }]}>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: colors.foreground }}>{f.q}</Text>
                    <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} style={{ transform: [{ rotate: faqOpen === i ? '180deg' : '0deg' }] }} />
                  </Pressable>
                  {faqOpen === i && (
                    <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                      <Text style={{ fontSize: 14, lineHeight: 20, color: colors.mutedForeground }}>{f.a}</Text>
                    </View>
                  )}
                </View>
              ))}
            </PanelSection>
          </DetailShell>
        );

      case 'storage':
        return (
          <DetailShell title="Data and Storage" onBack={() => setPanel(null)}>
            <PanelSection>
              <Pressable disabled={cacheStatus === 'clearing'} onPress={() => void clearCache()} style={[styles.panelRow, { backgroundColor: colors.card, borderBottomColor: 'transparent' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: cacheStatus === 'cleared' ? '#34C77E' : '#F0537A' }}>
                    {cacheStatus === 'clearing' ? 'Clearing Cache…' : cacheStatus === 'cleared' ? 'Cache Cleared' : 'Clear Cache'}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                    {cacheStatus === 'error' ? 'Cache could not be cleared. Try again.' : cacheStatus === 'cleared' ? 'Temporary images and API data were removed.' : 'Remove temporary images and cached API data'}
                  </Text>
                </View>
                <Ionicons name={cacheStatus === 'cleared' ? 'checkmark-circle' : 'trash'} size={18} color={cacheStatus === 'cleared' ? '#34C77E' : '#F0537A'} />
              </Pressable>
              <PanelToggleRow label="Automatic media downloads" value={settings.autoDownload} onChange={() => toggle('autoDownload')} />
              <PanelToggleRow label="Wi-Fi only" sub="Only download media automatically on Wi-Fi." value={settings.wifiOnly} onChange={() => toggle('wifiOnly')} isLast />
            </PanelSection>
          </DetailShell>
        );

      case 'appearance':
        return (
          <DetailShell title="Appearance" onBack={() => setPanel(null)}>
            <PanelSection title="Theme">
              <PanelToggleRow label="Dark Mode" sub="Switch app theme" value={settings.darkMode} onChange={() => toggle('darkMode')} isLast />
            </PanelSection>
            <PanelSection title="Accent Color">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 16, backgroundColor: colors.card }}>
                {[colors.brandBlue, colors.brandOrange, colors.brandPurple, '#3F7BE8', '#A855F7', '#E06C16'].map((accent) => (
                  <Pressable key={accent} onPress={() => updateSettings({ accent })} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: settings.accent === accent ? 2 : 0, borderColor: accent }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                      {settings.accent === accent && <Ionicons name="checkmark" size={18} color="#fff" />}
                    </View>
                  </Pressable>
                ))}
              </View>
            </PanelSection>
          </DetailShell>
        );

      case 'power':
        return (
          <DetailShell title="Power Saving" onBack={() => setPanel(null)}>
            <PanelSection>
              <PanelToggleRow label="Power saving mode" sub="Reduce background activity and media autoplay." value={settings.lowPower} onChange={() => toggle('lowPower')} isLast />
            </PanelSection>
          </DetailShell>
        );

      case 'language':
        return (
          <DetailShell title="Language" onBack={() => setPanel(null)}>
            <PanelSection>
              {['English'].map((language) => (
                <AudienceRow key={language} label={language} value={settings.language === language} onPress={() => updateSettings({ language })} isLast />
              ))}
            </PanelSection>
          </DetailShell>
        );

      default:
        return null;
    }
  }

  return (
    <Screen title="Settings" scroll={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 14 }}>
        <View style={[styles.settingsProfileHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Avatar name={profile.name || 'You'} size={54} color={colors.primary} uri={profile.avatarUri} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsProfileName, { color: colors.foreground }]}>{profile.name || 'Your profile'}</Text>
            <Text style={[styles.settingsProfileHandle, { color: colors.mutedForeground }]}>{profile.username ? `@${profile.username}` : 'Add a username and bio'}</Text>
          </View>
          <Pressable onPress={() => { setDraftName(profile.name); setDraftUsername(profile.username); setDraftBio(profile.bio); setPanel('profile'); }} style={[styles.settingsEditButton, { backgroundColor: colors.secondary }]} accessibilityRole="button" accessibilityLabel="Edit profile">
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Edit</Text>
          </Pressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.mutedForeground} style={{ marginLeft: 12 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search settings"
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={{ padding: 12 }}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {filteredGroups.map((g, i) => (
          <View key={i} style={{ marginBottom: 24 }}>
            {'title' in g && g.title && (
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{g.title.toUpperCase()}</Text>
            )}
            <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {g.items.map((item, j) => (
                <SettingRow key={item.key} item={item} isLast={j === g.items.length - 1} colors={colors} />
              ))}
            </View>
          </View>
        ))}

      </ScrollView>

      <Modal visible={panel !== null} animationType="slide" onRequestClose={() => setPanel(null)}>
        {panel && renderPanel()}
      </Modal>
    </Screen>
  );
}

// ---------------- Supporting Components ----------------

function SettingRow({ item, isLast, colors }: any) {
  return (
    <Pressable testID={`setting-${item.key}`} accessibilityRole="button" accessibilityLabel={item.label} onPress={item.onPress} style={({pressed}) => [styles.settingRow, { borderBottomColor: isLast ? 'transparent' : colors.border, backgroundColor: pressed ? colors.muted : 'transparent' }]}>
       <View style={[styles.settingIcon, { backgroundColor: item.danger ? `${colors.destructive}16` : item.bg }]}>
          <Ionicons name={item.icon as any} size={17} color={item.danger ? colors.destructive : colors.foreground} />
       </View>
       <Text style={[styles.settingLabel, { color: item.danger ? colors.destructive : colors.foreground }]}>{item.label}</Text>
       {item.value ? <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>{item.value}</Text> : null}
       {!item.danger && <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />}
    </Pressable>
  )
}

function DetailShell({ title, onBack, children, rightAction }: any) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <View style={[styles.shellHeader, { paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
         <Pressable onPress={onBack} style={styles.shellBack}>
           <Ionicons name="chevron-back" size={28} color={colors.primary} />
           <Text style={[styles.shellBackText, { color: colors.primary }]}>Settings</Text>
         </Pressable>
         {rightAction}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}>
         <Text style={[styles.shellTitle, { color: colors.foreground }]}>{title}</Text>
         {children}
      </ScrollView>
    </View>
  )
}

function PanelToggleRow({ label, sub, value, onChange, isLast }: any) {
  const colors = useColors();
  return (
    <View style={[styles.panelRow, { borderBottomColor: isLast ? 'transparent' : colors.border, backgroundColor: colors.card }]}>
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={[styles.panelRowLabel, { color: colors.foreground }]}>{label}</Text>
        {sub && <Text style={[styles.panelRowSub, { color: colors.mutedForeground }]}>{sub}</Text>}
      </View>
                 <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.muted, true: colors.brandBlue }} />
    </View>
  )
}

function AudienceRow({ label, sub, value, onPress, isLast }: { label: string; sub?: string; value: boolean; onPress: () => void; isLast: boolean }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.panelRow, { backgroundColor: colors.card, borderBottomColor: isLast ? 'transparent' : colors.border }]}>
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={[styles.panelRowLabel, { color: colors.foreground }]}>{label}</Text>
        {sub ? <Text style={[styles.panelRowSub, { color: colors.mutedForeground }]}>{sub}</Text> : null}
      </View>
      <View style={[styles.radio, { borderColor: value ? colors.primary : colors.border }]}>{value ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}</View>
    </Pressable>
  );
}

function sharingLabel(audience: string) {
  if (audience === 'close_friends') return 'Close friends';
  if (audience === 'private') return 'Only me';
  return audience.charAt(0).toUpperCase() + audience.slice(1);
}

function PanelSection({ title, children }: any) {
  const colors = useColors();
  return (
    <View style={styles.panelSection}>
      {title && <Text style={[styles.panelSectionTitle, { color: colors.mutedForeground }]}>{title.toUpperCase()}</Text>}
      <View style={[styles.panelSectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
         {children}
      </View>
    </View>
  )
}

// ---------------- Styles ----------------

const styles = StyleSheet.create({
  searchContainer: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 10, borderWidth: 1, marginBottom: 20 },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 16, height: '100%' },
  sectionTitle: { textTransform: 'uppercase', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginLeft: 4, marginBottom: 6, marginTop: 4 },
  group: { borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth },
  settingIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: 16.5, marginLeft: 14 },
  settingValue: { fontSize: 15, marginRight: 8 },
  settingsProfileHeader: { minHeight: 82, borderRadius: 20, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  settingsProfileName: { fontSize: 18, fontWeight: '700' },
  settingsProfileHandle: { fontSize: 13, marginTop: 4 },
  settingsEditButton: { minWidth: 58, minHeight: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },

  shellHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  shellBack: { flexDirection: 'row', alignItems: 'center', height: 44, paddingRight: 16 },
  shellBackText: { fontSize: 17, marginLeft: -4 },
  shellTitle: { fontSize: 28, fontWeight: '800', marginVertical: 14, marginLeft: 4 },

  panelSection: { marginBottom: 20 },
  panelSectionTitle: { textTransform: 'uppercase', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginLeft: 16, marginBottom: 6 },
  panelSectionCard: { borderRadius: 11, overflow: 'hidden', borderWidth: 1 },
  panelRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
  panelRowLabel: { fontSize: 16 },
  panelRowSub: { fontSize: 13, marginTop: 2 },
  panelActionText: { fontSize: 16 },
  privacyNotice: { borderRadius: 12, padding: 13, marginBottom: 20, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  privacyNoticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  excludedEmpty: { alignItems: 'center', padding: 24 },
  excludedEmptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  excludedEmptyText: { fontSize: 12, lineHeight: 17, marginTop: 5, textAlign: 'center' },
  excludedName: { flex: 1, fontSize: 15, fontWeight: '700', marginLeft: 10 },

  profileEditor: { alignItems: 'center', paddingVertical: 24 },
  profileEditorAvatar: { position: 'relative', marginBottom: 16 },
  profileEditorCamera: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  profileEditorNameInput: { fontSize: 22, fontWeight: '700', borderBottomWidth: 2, paddingVertical: 4, minWidth: '60%', marginBottom: 6 },
  profileEditorPhone: { fontSize: 15, marginBottom: 20 },
  profileEditorBioInput: { width: '100%', minHeight: 88, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, lineHeight: 22, marginBottom: 4 },
  profileEditorBioCount: { alignSelf: 'flex-end', fontSize: 12, marginBottom: 14 },

  walletCard: { alignItems: 'center', paddingVertical: 32 },
  walletSub: { fontSize: 14, marginBottom: 4 },
  walletBalance: { fontSize: 36, fontWeight: '800', marginBottom: 20 },
  walletActions: { flexDirection: 'row', gap: 12 },
  walletBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
  walletBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  saveComposer: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, marginBottom: 16 },
  saveInput: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  saveBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  savedBubble: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8, alignSelf: 'flex-start', maxWidth: '85%' },
});
