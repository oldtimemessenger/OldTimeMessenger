import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Search, Edit3, Camera } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getChats } from '../services/chats';
import Avatar from '../components/Avatar';

function otherParticipant(chat, myId) {
  const others = (chat.chat_participants || []).filter((p) => p.user_id !== myId);
  return others[0]?.profiles;
}

export default function ChatsScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getChats(user.id);
      setChats(data);
    } catch (e) {
      console.warn('getChats failed', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item }) => {
    const other = item.is_group ? null : otherParticipant(item, user.id);
    const title = item.is_group ? item.chat_name || 'Group Chat' : other?.display_name || 'Unknown';
    const color = '#5B7C99';
    const preview = item.lastMessage
      ? item.lastMessage.message_type === 'text'
        ? item.lastMessage.content
        : `[${item.lastMessage.message_type}]`
      : 'Say hello 👋';

    return (
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('ChatView', { chat: item, title, otherUser: other })}>
        <Avatar name={title} color={color} size={48} status={other?.status} />
        <View style={{ flex: 1, marginLeft: 13, minWidth: 0 }}>
          <View style={styles.rowTop}>
            <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>{title}</Text>
            <Text style={{ color: theme.muted, fontSize: 12.5 }}>
              {item.updated_at ? new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </Text>
          </View>
          <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13.5, marginTop: 2 }}>{preview}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Chats</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Camera')}><Camera size={21} color={theme.text} /></TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.search, { backgroundColor: theme.elevated }]} onPress={() => navigation.navigate('ChatSearch')}>
        <Search size={17} color={theme.muted} />
        <Text style={{ color: theme.muted, fontSize: 15, marginLeft: 10 }}>Search</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.greenBright} />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.greenBright} />}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center' }}>
                No chats yet. Tap the pencil to start one.
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={[styles.fab, { backgroundColor: theme.greenBright }]} onPress={() => navigation.navigate('NewChat')}>
        <Edit3 size={22} color="#06140F" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 9, borderRadius: 10, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 18 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15.5, fontWeight: '600', flexShrink: 1 },
  fab: { position: 'absolute', right: 18, bottom: 18, width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
});
