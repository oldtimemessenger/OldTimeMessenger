import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Bell, Palette, Lock, ShieldCheck, HardDrive, MapPin, Eye, Star, Folder, Smartphone, Globe, HelpCircle, FileText, QrCode } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import Section from '../components/Section';
import Divider from '../components/Divider';
import SettingsRow from '../components/SettingsRow';

export default function SettingsScreen({ navigation }) {
  const { theme } = useTheme();
  const { profile, signOut } = useAuth();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '700', padding: 20, paddingBottom: 16 }}>Settings</Text>
      <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 18 }}>
        <Avatar name={profile?.display_name || 'You'} color="#C97B4A" size={62} status="online" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 18.5, fontWeight: '600' }}>{profile?.display_name || 'Set up your profile'}</Text>
          <Text style={{ color: theme.muted, fontSize: 13.5, marginTop: 2 }}>{profile?.bio || profile?.phone || ''}</Text>
        </View>
        <QrCode size={20} color={theme.muted} onPress={() => navigation.navigate('Qr')} />
      </TouchableOpacity>

      <Section>
        <SettingsRow icon={Bell} color="#D9714A" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
        <Divider /><SettingsRow icon={Palette} color="#0A84FF" label="Notification Color" onPress={() => navigation.navigate('NotificationColor')} />
        <Divider /><SettingsRow icon={Lock} color="#6E6259" label="Privacy" onPress={() => navigation.navigate('Privacy')} />
        <Divider /><SettingsRow icon={ShieldCheck} color="#178484" label="Encryption" onPress={() => navigation.navigate('Security')} />
        <Divider /><SettingsRow icon={HardDrive} color="#6FA86F" label="Data and Storage" onPress={() => navigation.navigate('Storage')} />
        <Divider /><SettingsRow icon={MapPin} color={theme.green} label="Live Location" />
        <Divider /><SettingsRow icon={Eye} color="#A85C8C" label="Story & Note Drop Privacy" onPress={() => navigation.navigate('AudienceSettings')} />
        <Divider /><SettingsRow icon={Star} color="#B0473E" label="Your Interests" onPress={() => navigation.navigate('Interests')} />
      </Section>

      <Section>
        <SettingsRow icon={Palette} color="#5B7C99" label="Appearance" onPress={() => navigation.navigate('Appearance')} />
        <Divider /><SettingsRow icon={Folder} color="#B08B3E" label="Chat Folders" />
        <Divider /><SettingsRow icon={Smartphone} color="#7C8A52" label="Linked Devices" value="1 active" onPress={() => navigation.navigate('Devices')} />
        <Divider /><SettingsRow icon={Globe} color="#A85C8C" label="Language" value={profile?.language || 'English'} onPress={() => navigation.navigate('Language')} />
      </Section>

      <Section><SettingsRow icon={HelpCircle} color="#6E6259" label="Help" onPress={() => navigation.navigate('Help')} /></Section>
      <Section><SettingsRow icon={FileText} color={theme.danger} label="Log Out" danger onPress={signOut} /></Section>
    </ScrollView>
  );
}
