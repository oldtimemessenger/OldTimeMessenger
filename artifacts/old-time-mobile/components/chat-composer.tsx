import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type GestureResponderHandlers } from 'react-native';
import { getChatStickerSuggestions } from '@/constants/chat-stickers';

type ComposerColors = { card: string; muted: string; foreground: string; mutedForeground: string; primary: string; border: string };
type PickerMode = 'stickers' | 'emoji' | null;

const EMOJI_GRID = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
  '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
  '😢', '😭', '😤', '😠', '😳', '😮', '😱', '😴',
  '🙏', '👍', '👎', '👏', '🙌', '🔥', '🎉', '❤️',
];

export function ChatComposer({
  value, onChangeText, onSendText, onOpenAttachments, onRecordVoice, inputRef, colors, placeholder = 'Message',
  locale, recipientLocale, locationLabel, enterToSend = true, disabled = false, recordPanHandlers, showAttachments = true, idleAction = 'record',
}: {
  value: string; onChangeText: (value: string) => void; onSendText: (value: string) => void; onOpenAttachments: () => void;
  onRecordVoice: () => void; inputRef?: React.RefObject<TextInput | null>; colors: ComposerColors; placeholder?: string;
  locale?: string; recipientLocale?: string; locationLabel?: string; enterToSend?: boolean; disabled?: boolean;
  recordPanHandlers?: GestureResponderHandlers; showAttachments?: boolean; idleAction?: 'record' | 'send';
}) {
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const now = new Date();
  const timeKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  const suggestions = useMemo(
    () => getChatStickerSuggestions({ locale, recipientLocale, locationLabel, now }),
    [locale, recipientLocale, locationLabel, timeKey],
  );
  const send = (message = value) => {
    const content = message.trim();
    if (!content || disabled) return;
    onSendText(content);
    setPickerMode(null);
  };
  return (
    <View>
      {pickerMode ? (
        <View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.pickerHeading}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>{pickerMode === 'emoji' ? 'Emoji' : 'Smart stickers'}</Text>
            {pickerMode === 'emoji' ? (
              <Pressable onPress={() => setPickerMode('stickers')} accessibilityRole="button" accessibilityLabel="Show smart stickers">
                <Text style={[styles.pickerHint, { color: colors.primary }]}>Smart stickers</Text>
              </Pressable>
            ) : (
              <View style={styles.pickerHeadingAction}>
                <Text style={[styles.pickerHint, { color: colors.mutedForeground }]}>Suggested for you</Text>
                <Pressable onPress={() => setPickerMode('emoji')} accessibilityRole="button" accessibilityLabel="Open emoji drawer" hitSlop={8}>
                  <Ionicons name="grid-outline" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            )}
          </View>
          {pickerMode === 'emoji' ? (
            <ScrollView style={styles.emojiDrawer} contentContainerStyle={styles.emojiGrid} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {EMOJI_GRID.map((emoji) => (
                <Pressable key={emoji} onPress={() => { onChangeText(`${value}${emoji}`); inputRef?.current?.focus(); }} style={styles.emojiButton} accessibilityRole="button" accessibilityLabel={`Insert ${emoji}`}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.stickerRail}>
              {suggestions.map((sticker) => <Pressable key={sticker.id} onPress={() => send(sticker.text)} accessibilityRole="button" accessibilityLabel={`Send ${sticker.text}`} style={[styles.sticker, { backgroundColor: colors.muted }]}>
                <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>{sticker.text !== sticker.emoji ? <Text numberOfLines={1} style={[styles.stickerText, { color: colors.foreground }]}>{sticker.text}</Text> : null}
              </Pressable>)}
            </ScrollView>
          )}
        </View>
      ) : null}
      <View style={styles.row}>
        {showAttachments ? <Pressable onPress={onOpenAttachments} disabled={disabled} style={[styles.roundButton, { backgroundColor: colors.muted }]} accessibilityRole="button" accessibilityLabel="Open attachment menu" testID="chat-attachments-button">
          <Ionicons name="add" size={22} color={colors.foreground} />
        </Pressable> : null}
        <View style={[styles.inputPill, { backgroundColor: colors.muted }]}>
          <TextInput ref={inputRef} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} multiline maxLength={2000} blurOnSubmit={false} onSubmitEditing={enterToSend ? () => send() : undefined} accessibilityLabel={placeholder} />
          <Pressable onPress={() => { Keyboard.dismiss(); setPickerMode((mode) => mode ? null : 'stickers'); }} style={styles.stickerButton} accessibilityRole="button" accessibilityState={{ expanded: pickerMode !== null }} accessibilityLabel={pickerMode ? 'Close emoji and sticker drawer' : 'Open smart sticker picker'} testID="chat-sticker-button">
            <Ionicons name="happy-outline" size={21} color={colors.foreground} />
          </Pressable>
        </View>
        {value.trim() || idleAction === 'send' ? <Pressable onPress={() => send()} disabled={disabled || !value.trim()} style={[styles.sendWrap, { opacity: value.trim() ? 1 : 0.42 }]} accessibilityRole="button" accessibilityLabel="Send message" testID="chat-send-button"><LinearGradient colors={['#F55B9B', '#8B5CF6', '#3467E8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.roundButton}><Ionicons name="arrow-up" size={19} color="#fff" /></LinearGradient></Pressable>
          : <Pressable {...recordPanHandlers} onPress={recordPanHandlers ? undefined : onRecordVoice} disabled={disabled} style={styles.sendWrap} accessibilityRole="button" accessibilityLabel="Hold to record voice message" accessibilityHint="Swipe left to cancel or swipe up to lock recording" testID="record-voice-note"><LinearGradient colors={['#F55B9B', '#8B5CF6', '#3467E8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.roundButton}><Ionicons name="mic-outline" size={20} color="#fff" /></LinearGradient></Pressable>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingVertical: 9, marginBottom: 8 },
  pickerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 7 },
  pickerHeadingAction: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerTitle: { fontSize: 13, fontWeight: '800' }, pickerHint: { fontSize: 11 },
  stickerRail: { gap: 8, paddingHorizontal: 9 }, sticker: { width: 76, minHeight: 62, borderRadius: 14, padding: 6, alignItems: 'center', justifyContent: 'center' },
  stickerEmoji: { fontSize: 22 }, stickerText: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  emojiDrawer: { maxHeight: 184 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 7, paddingBottom: 2 },
  emojiButton: { width: '12.5%', height: 36, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 21 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, roundButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sendWrap: { borderRadius: 21, overflow: 'hidden' }, inputPill: { flex: 1, minHeight: 42, borderRadius: 22, paddingLeft: 14, paddingRight: 7, paddingVertical: 6, flexDirection: 'row', alignItems: 'flex-end' },
  input: { flex: 1, minHeight: 24, maxHeight: 108, fontSize: 15, paddingTop: 3, paddingBottom: 3 }, stickerButton: { width: 31, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});