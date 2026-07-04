import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { saveNote, deleteNote } from '../services/notes';
import Header from '../components/Header';

export default function NewNoteScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const initial = route.params?.note;
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!user || saving) return;
    try {
      setSaving(true);
      await saveNote(user.id, { id: initial?.id, title: title.trim(), body: body.trim() });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Unable to save note', error.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!initial?.id) return;
    try {
      await deleteNote(initial.id);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Unable to delete note', error.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header
        title={initial ? 'Edit Note' : 'New Note'}
        onBack={() => navigation.goBack()}
        right={<Text onPress={onSave} style={{ color: saving ? theme.muted : theme.greenBright, fontWeight: '700' }}>Save</Text>}
      />
      <View style={{ padding: 16, gap: 12 }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={theme.muted}
          style={{ color: theme.text, fontSize: 18, fontWeight: '600' }}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write your note..."
          placeholderTextColor={theme.muted}
          multiline
          textAlignVertical="top"
          style={{ color: theme.text, fontSize: 15, minHeight: 240 }}
        />
        {initial?.id ? (
          <TouchableOpacity onPress={onDelete} style={{ marginTop: 8 }}>
            <Text style={{ color: theme.danger, fontWeight: '600' }}>Delete note</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
