import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Phone, Video } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getMyContacts } from '../services/profile';
import Avatar from '../components/Avatar';
import Header from '../components/Header';

export default function NewCallScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  useEffect(() => { getMyContacts(user.id).then(setContacts).catch(() => {}); }, [user.id]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="New Call" onBack={() => navigation.goBack()} />
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
            <Avatar name={item.display_name} color="#5B7C99" size={42} status={item.status} />
            <Text style={{ flex: 1, color: theme.text, fontSize: 15, marginLeft: 12 }}>{item.display_name}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Call', { callType: 'voice', otherUser: item })} style={{ marginRight: 14 }}>
              <Phone size={18} color={theme.greenBright} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Call', { callType: 'video', otherUser: item })}>
              <Video size={19} color={theme.greenBright} />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}
