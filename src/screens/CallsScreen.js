import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Phone, PhoneIncoming, PhoneOutgoing, Video, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getRecentCalls } from '../services/calls';
import Avatar from '../components/Avatar';

export default function CallsScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    getRecentCalls(user.id).then(setCalls).catch(() => {}).finally(() => setLoading(false));
  }, [user.id]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6 }}>
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: '700' }}>Calls</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NewCall')}><Phone size={20} color={theme.text} /></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 20, paddingVertical: 8 }}>
        <ShieldCheck size={12} color={theme.green} />
        <Text style={{ fontSize: 11, color: theme.green }}>Calls are protected end-to-end by Row Level Security</Text>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={theme.greenBright} /> : (
        <FlatList
          data={calls}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center', marginTop: 30 }}>No recent calls</Text>}
          renderItem={({ item }) => {
            const isMe = item.caller_id === user.id;
            const other = isMe ? item.callee : item.caller;
            const missed = item.status === 'missed';
            const DirIcon = item.direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 18 }}>
                <Avatar name={other?.display_name || '?'} color="#5B7C99" size={46} />
                <View style={{ flex: 1, marginLeft: 13 }}>
                  <Text style={{ color: missed ? theme.danger : theme.text, fontWeight: '600', fontSize: 15 }}>{other?.display_name || 'Unknown'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <DirIcon size={13} color={missed ? theme.danger : theme.online} />
                    <Text style={{ color: theme.muted, fontSize: 12.5 }}>{new Date(item.started_at).toLocaleString()}</Text>
                  </View>
                </View>
                {item.call_type === 'video' ? <Video size={19} color={theme.greenBright} /> : <Phone size={18} color={theme.greenBright} />}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
