import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Check, Video, Phone, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getMyContacts } from '../services/profile';
import { getOrCreateDirectChat } from '../services/chats';
import { scheduleMeeting } from '../services/calls';
import Avatar from '../components/Avatar';
import Header from '../components/Header';
import Section from '../components/Section';

export default function ScheduleMeetingScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [who, setWho] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState('video');

  useEffect(() => { getMyContacts(user.id).then((c) => { setContacts(c); setWho(c[0] || null); }).catch(() => {}); }, [user.id]);

  const save = async () => {
    if (!who || !date || !time) return;
    const chat = await getOrCreateDirectChat(user.id, who.id);
    await scheduleMeeting(chat.id, user.id, type, new Date(`${date}T${time}`).toISOString());
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Schedule a Call" onBack={() => navigation.goBack()}
        right={<Text onPress={save} style={{ color: theme.greenBright, fontSize: 14, fontWeight: '700' }}>Save</Text>} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, paddingTop: 8 }}>
        <ShieldCheck size={11} color={theme.muted} />
        <Text style={{ color: theme.muted, fontSize: 11.5 }}>Secured — encrypted the same as your chats</Text>
      </View>
      <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', padding: 16, paddingBottom: 6 }}>WITH</Text>
      <Section>
        {contacts.map((c, i) => (
          <TouchableOpacity key={c.id} onPress={() => setWho(c)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11 }, i && { borderTopWidth: 1, borderTopColor: theme.divider }]}>
            <Avatar name={c.display_name} color="#5B7C99" size={36} />
            <Text style={{ flex: 1, color: theme.text, fontSize: 14.5 }}>{c.display_name}</Text>
            {who?.id === c.id && <Check size={17} color={theme.greenBright} />}
          </TouchableOpacity>
        ))}
      </Section>
      <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', paddingHorizontal: 16 }}>WHEN</Text>
      <Section>
        <View style={{ flexDirection: 'row', gap: 10, padding: 12 }}>
          <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.muted}
            style={{ flex: 1, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.divider, borderRadius: 8, padding: 10, color: theme.text }} />
          <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={theme.muted}
            style={{ flex: 1, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.divider, borderRadius: 8, padding: 10, color: theme.text }} />
        </View>
      </Section>
      <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600', paddingHorizontal: 16 }}>CALL TYPE</Text>
      <Section>
        <View style={{ flexDirection: 'row', gap: 10, padding: 12 }}>
          {[['video', Video, 'Video'], ['voice', Phone, 'Voice']].map(([id, Icon, label]) => (
            <TouchableOpacity key={id} onPress={() => setType(id)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 10, borderRadius: 10,
                backgroundColor: type === id ? theme.greenBright : theme.bg, borderWidth: 1, borderColor: type === id ? theme.greenBright : theme.divider }}>
              <Icon size={15} color={type === id ? '#06140F' : theme.text} />
              <Text style={{ color: type === id ? '#06140F' : theme.text, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>
    </View>
  );
}
