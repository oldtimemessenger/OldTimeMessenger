import React, { useEffect, useState } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity } from 'react-native';
import { ArrowLeft, Search } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getMyContacts } from '../services/profile';
import { getOrCreateDirectChat } from '../services/chats';
import Avatar from '../components/Avatar';

export default function ChatSearchScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState([]);

  useEffect(() => { getMyContacts(user.id).then(setContacts).catch(() => {}); }, [user.id]);
  const results = contacts.filter((c) => c.display_name.toLowerCase().includes(query.toLowerCase()));

  const open = async (contact) => {
    const chat = await getOrCreateDirectChat(user.id, contact.id);
    navigation.replace('ChatView', { chat, title: contact.display_name, otherUser: contact });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft size={21} color={theme.text} /></TouchableOpacity>
        <View style={{ flex: 1, backgroundColor: theme.elevated, borderRadius: 10, padding: 9, marginLeft: 10, flexDirection: 'row', alignItems: 'center' }}>
          <Search size={16} color={theme.muted} />
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search chats" placeholderTextColor={theme.muted}
            style={{ flex: 1, color: theme.text, fontSize: 14.5, marginLeft: 8 }} />
        </View>
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => open(item)} style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
            <Avatar name={item.display_name} color="#5B7C99" size={40} status={item.status} />
            <Text style={{ color: theme.text, fontSize: 15, marginLeft: 12 }}>{item.display_name}</Text>
          </TouchableOpacity>
        )}
      />
      {query.length > 0 && results.length === 0 && <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 30 }}>No chats found</Text>}
    </View>
  );
}
