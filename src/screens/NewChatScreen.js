import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getMyContacts } from '../services/profile';
import { getOrCreateDirectChat } from '../services/chats';
import Avatar from '../components/Avatar';
import Header from '../components/Header';

export default function NewChatScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyContacts(user.id).then(setContacts).catch(() => {}).finally(() => setLoading(false));
  }, [user.id]);

  const openChat = async (contact) => {
    const chat = await getOrCreateDirectChat(user.id, contact.id);
    navigation.replace('ChatView', { chat, title: contact.display_name, otherUser: contact });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="New Chat" onBack={() => navigation.goBack()} />
      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={theme.greenBright} /> : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center', marginTop: 30 }}>No contacts yet. Contacts appear once you and a friend are connected.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openChat(item)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
              <Avatar name={item.display_name} color="#5B7C99" size={42} status={item.status} />
              <Text style={{ color: theme.text, fontSize: 15, marginLeft: 12 }}>{item.display_name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
