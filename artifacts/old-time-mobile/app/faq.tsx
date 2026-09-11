import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const questions = [
  {
    question: 'What is Old Time?',
    answer: 'Old Time is a private social space for sharing real moments, keeping up with your community, and talking with people you know.',
  },
  {
    question: 'What is the difference between a Story and a Post?',
    answer: 'Stories are temporary moments that stay available for 24 hours. Posts remain on your profile until you choose to remove them.',
  },
  {
    question: 'How do I create something?',
    answer: 'Open Create from the center tab, or tap the red plus beside your profile photo. You can capture a photo or video, choose media from your library, or write a text post.',
  },
  {
    question: 'What are Coins and Gold?',
    answer: 'Coins are used for gifts and access in LIVE rooms. Gold is creator earnings that can be withdrawn after payout setup is complete.',
  },
  {
    question: 'How do LIVE gifts work?',
    answer: 'Gifts can only be sent to people who are participating in the current LIVE room. Gift benefits are applied once and the room shows the same confirmed gift to everyone.',
  },
  {
    question: 'How do I change my profile?',
    answer: 'Open Profile, tap Edit profile to change your name, username, or bio, or tap your profile photo to choose a new photo.',
  },
  {
    question: 'How do I delete my account?',
    answer: 'Open Settings, choose Delete account, and confirm. Deletion removes your profile, content, messages, uploaded media, and sign-in identity permanently.',
  },
];

export default function FaqScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to settings" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>FAQ and help</Text>
        <View style={styles.headerSpacer} />
      </View>
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>A few quick answers for using Old Time.</Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {questions.map((item, index) => {
          const isOpen = openQuestion === index;
          return (
            <View key={item.question} style={[styles.item, index < questions.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.question}
                accessibilityState={{ expanded: isOpen }}
                onPress={() => setOpenQuestion(isOpen ? null : index)}
                style={styles.question}
              >
                <Text style={[styles.questionText, { color: colors.foreground }]}>{item.question}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={19} color={colors.mutedForeground} />
              </Pressable>
              {isOpen ? <Text style={[styles.answer, { color: colors.mutedForeground }]}>{item.answer}</Text> : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  title: { fontFamily: 'Fraunces_900Black', fontSize: 24 },
  intro: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, marginBottom: 20, paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 24, paddingHorizontal: 18, overflow: 'hidden' },
  item: { paddingVertical: 4 },
  question: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12 },
  questionText: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 15, lineHeight: 21 },
  answer: { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 21, paddingRight: 28, paddingBottom: 18 },
});