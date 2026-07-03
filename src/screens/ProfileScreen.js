import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import Section from '../components/Section';
import Divider from '../components/Divider';
import Header from '../components/Header';

export default function ProfileScreen({ navigation }) {
  const { theme } = useTheme();
  const { profile } = useAuth();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Profile" onBack={() => navigation.goBack()} />
      <View style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Avatar name={profile?.display_name || 'You'} color="#C97B4A" size={108} status="online" />
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700', marginTop: 14 }}>{profile?.display_name}</Text>
        <Text style={{ color: theme.online, fontSize: 13.5, marginTop: 4 }}>online</Text>
      </View>
      <Section>
        <View style={{ padding: 13 }}><Text style={{ color: theme.muted, fontSize: 12 }}>Phone</Text><Text style={{ color: theme.text, fontSize: 15, marginTop: 2 }}>{profile?.phone}</Text></View><Divider />
        <View style={{ padding: 13 }}><Text style={{ color: theme.muted, fontSize: 12 }}>Username</Text><Text style={{ color: theme.text, fontSize: 15, marginTop: 2 }}>{profile?.username ? `@${profile.username}` : 'Not set'}</Text></View><Divider />
        <View style={{ padding: 13 }}><Text style={{ color: theme.muted, fontSize: 12 }}>Bio</Text><Text style={{ color: theme.text, fontSize: 15, marginTop: 2 }}>{profile?.bio || '—'}</Text></View>
      </Section>
    </ScrollView>
  );
}
