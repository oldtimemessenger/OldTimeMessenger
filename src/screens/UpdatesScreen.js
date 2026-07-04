import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Search, Plus, Camera, Edit3, Lock, ShieldCheck, Video, Phone } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getVisibleStatuses } from '../services/statuses';
import { getNotes } from '../services/notes';
import { getScheduledMeetings } from '../services/calls';
import Avatar from '../components/Avatar';
import Section from '../components/Section';

export default function UpdatesScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [statuses, setStatuses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    Promise.all([
      getVisibleStatuses().catch(() => []),
      getNotes(user.id).catch(() => []),
      getScheduledMeetings(user.id).catch(() => []),
    ]).then(([s, n, m]) => { setStatuses(s); setNotes(n); setMeetings(m); }).finally(() => setLoading(false));
  }, [user.id]));

  const myStatuses = statuses.filter((s) => s.user_id === user.id);
  const others = statuses.filter((s) => s.user_id !== user.id);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Updates</Text>
        <Search size={19} color={theme.text} onPress={() => navigation.navigate('UpdateSearch')} />
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={theme.greenBright} /> : (
        <>
          {/* ---- Status ---- */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Status</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Camera')} style={styles.statusAddRow}>
            <Avatar name="You" color="#4A776B" size={56} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15.5 }}>Add status</Text>
              <Text style={{ color: theme.muted, fontSize: 12.5, marginTop: 2 }}>
                {myStatuses.length > 0 ? `${myStatuses.length} active` : 'Disappears after 24 hours'}
              </Text>
            </View>
            <Camera size={16} color={theme.text} />
          </TouchableOpacity>

          {others.length > 0 && <Text style={[styles.subLabel, { color: theme.muted }]}>RECENT UPDATES</Text>}
          {others.map((s) => (
            <TouchableOpacity key={s.id} onPress={() => navigation.navigate('StatusViewer', { status: s })} style={styles.statusAddRow}>
              <View style={[styles.ring, { borderColor: theme.greenBright }]}>
                <Avatar name={s.profiles?.display_name || '?'} color={s.color} size={50} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15.5 }}>{s.profiles?.display_name}</Text>
                <Text style={{ color: theme.muted, fontSize: 12.5, marginTop: 2 }}>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={[styles.divider8, { backgroundColor: theme.elevated }]} />

          {/* ---- Note Drops (private) ---- */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Note Drops</Text>
            <Text onPress={() => navigation.navigate('NewNote')} style={{ color: theme.greenBright, fontSize: 13, fontWeight: '700' }}>+ New Note</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, paddingBottom: 10 }}>
            <Lock size={11} color={theme.muted} />
            <Text style={{ color: theme.muted, fontSize: 11.5 }}>Secured — only visible to you</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 10 }}>
            {notes.map((n) => (
              <TouchableOpacity key={n.id} onPress={() => navigation.navigate('NewNote', { note: n })}
                style={[styles.noteCard, { backgroundColor: theme.elevated, borderColor: theme.divider }]}>
                <Text numberOfLines={1} style={{ color: theme.text, fontSize: 13.5, fontWeight: '700', marginBottom: 5 }}>{n.title || 'Untitled'}</Text>
                <Text numberOfLines={3} style={{ color: theme.muted, fontSize: 11.5, lineHeight: 16 }}>{n.body}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => navigation.navigate('NewNote')} style={[styles.noteCard, styles.noteCardNew, { borderColor: theme.divider }]}>
              <Plus size={18} color={theme.greenBright} />
              <Text style={{ color: theme.greenBright, fontSize: 11, fontWeight: '600', marginTop: 4 }}>New</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.divider8, { backgroundColor: theme.elevated, marginTop: 16 }]} />

          {/* ---- Calls & Meetings ---- */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Calls & Meetings</Text>
            <Text onPress={() => navigation.navigate('ScheduleMeeting')} style={{ color: theme.greenBright, fontSize: 13, fontWeight: '700' }}>+ Schedule</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, paddingBottom: 10 }}>
            <ShieldCheck size={11} color={theme.muted} />
            <Text style={{ color: theme.muted, fontSize: 11.5 }}>Secured calls, same protection as your chats</Text>
          </View>
          <Section>
            {meetings.length === 0 ? (
              <Text style={{ color: theme.muted, fontSize: 13, padding: 16 }}>No upcoming calls scheduled.</Text>
            ) : meetings.map((m, i) => {
              const Icon = m.call_type === 'video' ? Video : Phone;
              return (
                <View key={m.id} style={[styles.meetingRow, i && { borderTopWidth: 1, borderTopColor: theme.divider }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: '600' }}>{m.chats?.chat_name || 'Direct call'}</Text>
                    <Text style={{ color: theme.muted, fontSize: 12, marginTop: 1 }}>{new Date(m.scheduled_for).toLocaleString()}</Text>
                  </View>
                  <Icon size={18} color={theme.greenBright} />
                </View>
              );
            })}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 6 },
  title: { fontSize: 28, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', paddingHorizontal: 18, marginTop: 14, marginBottom: 6 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginTop: 18 },
  subLabel: { fontSize: 11.5, fontWeight: '700', paddingHorizontal: 18, marginTop: 6, marginBottom: 4 },
  statusAddRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8 },
  ring: { borderRadius: 28, borderWidth: 2.5, padding: 2 },
  divider8: { height: 8, marginTop: 8 },
  noteCard: { width: 150, borderRadius: 12, padding: 12, borderWidth: 1 },
  noteCardNew: { width: 90, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  meetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
});
