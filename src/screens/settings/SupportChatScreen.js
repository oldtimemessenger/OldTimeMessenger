import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Send } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';

export default function SupportChatScreen({ navigation }) {
  const { theme } = useTheme();
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState([
    { id: '1', fromMe: false, content: 'Hi — this is Old Time support. How can we help?' },
  ]);

  const send = () => {
    if (!text.trim()) return;
    setMsgs((prev) => [...prev, { id: String(Date.now()), fromMe: true, content: text.trim() }]);
    setText('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Support" onBack={() => navigation.goBack()} />
      <FlatList
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={{ alignItems: item.fromMe ? 'flex-end' : 'flex-start', marginVertical: 4 }}>
            <View style={[styles.bubble, { backgroundColor: item.fromMe ? theme.bubbleMe : theme.bubbleThem }]}>
              <Text style={{ color: theme.text, fontSize: 15 }}>{item.content}</Text>
            </View>
          </View>
        )}
      />
      <View style={[styles.inputRow, { backgroundColor: theme.header }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a message"
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.text, backgroundColor: theme.elevated }]}
        />
        <TouchableOpacity onPress={send} style={[styles.send, { backgroundColor: theme.green }]}>
          <Send size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '78%', padding: 10, borderRadius: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  send: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
});
