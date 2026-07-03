import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActionSheetIOS,
} from 'react-native';
import { ArrowLeft, Video, Phone, Plus, Smile, Camera, Send, Mic, Lock, Zap, Trash2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getMessages, sendMessage, markMessageRead, subscribeToChat, deleteForMe, deleteForEveryone } from '../services/messages';
import Avatar from '../components/Avatar';
import VoiceBubble from '../components/VoiceBubble';

export default function ChatViewScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { chat, title, otherUser } = route.params;
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  const load = useCallback(async () => {
    const data = await getMessages(chat.id, user.id);
    setMsgs(data);
  }, [chat.id, user.id]);

  useEffect(() => {
    load();
    const unsubscribe = subscribeToChat(chat.id, (newMsg) => {
      setMsgs((prev) => [...prev, newMsg]);
      if (newMsg.sender_id !== user.id) markMessageRead(newMsg.id, user.id);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return unsubscribe;
  }, [chat.id, load, user.id]);

  const send = async () => {
    if (!text.trim()) return;
    const body = text.trim();
    setText('');
    try {
      await sendMessage(chat.id, user.id, { content: body, isDisappearing: chat.disappearing_duration !== 'off' });
    } catch (e) {
      Alert.alert('Message failed to send', e.message);
    }
  };

  const onLongPressMessage = (m) => {
    if (m.sender_id !== user.id || m.deleted_for_everyone) return;
    const options = ['Delete for me', 'Delete for everyone', 'Cancel'];
    const act = (idx) => {
      if (idx === 0) { deleteForMe(m.id, user.id).then(() => setMsgs((p) => p.filter((x) => x.id !== m.id))); }
      if (idx === 1) { deleteForEveryone(m.id, user.id).then(load); }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, destructiveButtonIndex: 1, cancelButtonIndex: 2 }, act);
    } else {
      Alert.alert('Message options', undefined, [
        { text: options[0], onPress: () => act(0) },
        { text: options[1], style: 'destructive', onPress: () => act(1) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const renderItem = ({ item }) => {
    const fromMe = item.sender_id === user.id;
    return (
      <TouchableOpacity
        activeOpacity={fromMe ? 0.7 : 1}
        onLongPress={() => onLongPressMessage(item)}
        style={{ alignItems: fromMe ? 'flex-end' : 'flex-start', marginVertical: 4 }}
      >
        <View style={[
          styles.bubble,
          { backgroundColor: fromMe ? theme.bubbleMe : theme.bubbleThem, borderColor: theme.divider, borderWidth: fromMe ? 0 : 1 },
        ]}>
          {item.deleted_for_everyone ? (
            <Text style={{ color: theme.muted, fontStyle: 'italic', fontSize: 13.5 }}>This message was deleted</Text>
          ) : item.message_type === 'voice' ? (
            <VoiceBubble fromMe={fromMe} />
          ) : (
            <Text style={{ color: theme.text, fontSize: 14.5 }}>{item.content}</Text>
          )}
          <Text style={{ fontSize: 10.5, color: theme.muted, alignSelf: 'flex-end', marginTop: 3 }}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft size={21} color={theme.text} /></TouchableOpacity>
        <Avatar name={title} color="#5B7C99" size={36} status={otherUser?.status} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15.5 }} numberOfLines={1}>{title}</Text>
          <Text style={{ color: otherUser?.status === 'online' ? theme.online : theme.muted, fontSize: 12 }}>
            {otherUser?.status === 'online' ? 'online' : 'last seen recently'}
          </Text>
        </View>
        {chat.disappearing_duration !== 'off' && <Zap size={15} color={theme.greenBright} style={{ marginRight: 6 }} />}
        <TouchableOpacity onPress={() => navigation.navigate('Call', { callType: 'video', otherUser, chatId: chat.id })}>
          <Video size={21} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Call', { callType: 'voice', otherUser, chatId: chat.id })} style={{ marginLeft: 12 }}>
          <Phone size={19} color={theme.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 14 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={
          <View style={[styles.encryptedBanner, { backgroundColor: theme.elevated }]}>
            <Lock size={11} color={theme.muted} />
            <Text style={{ fontSize: 11, color: theme.muted, textAlign: 'center', marginLeft: 6, flex: 1 }}>
              Messages here are secured with end-to-end style access control. Only chat participants can read them.
            </Text>
          </View>
        }
      />

      <View style={[styles.inputRow, { backgroundColor: theme.header }]}>
        <Plus size={22} color={theme.muted} />
        <View style={[styles.inputWrap, { backgroundColor: theme.elevated, borderColor: theme.inputBorder }]}>
          <Smile size={18} color={theme.muted} />
          <TextInput
            value={text} onChangeText={setText} placeholder="Message" placeholderTextColor={theme.muted}
            style={{ flex: 1, color: theme.text, fontSize: 14.5, marginLeft: 8 }} onSubmitEditing={send}
          />
          <Camera size={17} color={theme.muted} />
        </View>
        <TouchableOpacity onPress={send} style={[styles.sendBtn, { backgroundColor: theme.green }]}>
          {text ? <Send size={16} color="#fff" /> : <Mic size={16} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, gap: 4 },
  bubble: { maxWidth: '78%', padding: 8, borderRadius: 14, borderBottomRightRadius: 3 },
  encryptedBanner: { flexDirection: 'row', alignSelf: 'center', maxWidth: '90%', borderRadius: 8, marginBottom: 10, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 9 },
  inputWrap: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
});
