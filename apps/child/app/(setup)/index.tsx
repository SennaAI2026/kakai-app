import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';

const AVATARS = ['🦒', '🐻', '🐼', '🐨'];
const AGES = Array.from({ length: 13 }, (_, i) => i + 5); // 5–17

export default function SetupIndex() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [avatar, setAvatar] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const mascotScale = useRef(new Animated.Value(0.4)).current;
  const mascotOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(mascotScale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.timing(mascotOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  function animateTo(next: number) {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -24, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(24);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  }

  async function handleNameSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ name: trimmed, avatar_id: avatar }).eq('id', user.id);
    }
    setSaving(false);
    animateTo(3);
  }

  async function handleAgeSave() {
    if (!age) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ age }).eq('id', user.id);
    }
    setSaving(false);
    router.push('/(setup)/usage-stats');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.root}>
        {/* Progress bar (steps 1–7) */}
        {step >= 1 && step <= 7 && (
          <View style={s.progressWrap}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(step / 7) * 100}%` as any }]} />
            </View>
          </View>
        )}

        <Animated.View
          style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {/* ── STEP 0: Welcome ─────────────────────────────────── */}
          {step === 0 && (
            <View style={s.center}>
              <Animated.Text
                style={[s.mascot, { transform: [{ scale: mascotScale }], opacity: mascotOpacity }]}
              >
                🦒
              </Animated.Text>
              <View style={s.bubble}>
                <Text style={s.bubbleText}>
                  Привет! Я Жирафик Какай 👋{'\n'}
                  Давай настроим твой телефон вместе!
                </Text>
              </View>
              <Text style={s.welcomeTitle}>Добро пожаловать в Kakai!</Text>
              <Text style={s.welcomeDesc}>
                Несколько простых шагов — и ты готов зарабатывать экранное время.
              </Text>
              <TouchableOpacity style={s.btnBig} onPress={() => animateTo(1)} activeOpacity={0.85}>
                <Text style={s.btnBigText}>Начать! 🚀</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 1: Avatar picker ───────────────────────────── */}
          {step === 1 && (
            <View style={s.center}>
              <Text style={s.stepTitle}>Выбери своего{'\n'}помощника!</Text>
              <Text style={s.stepDesc}>Это твой личный аватар в приложении</Text>
              <View style={s.avatarGrid}>
                {AVATARS.map((emoji, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.avatarCard, avatar === i && s.avatarCardSelected]}
                    onPress={() => setAvatar(i)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.avatarEmoji}>{emoji}</Text>
                    {avatar === i && <View style={s.avatarCheck}><Text style={s.avatarCheckText}>✓</Text></View>}
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={s.btnBig} onPress={() => animateTo(2)} activeOpacity={0.85}>
                <Text style={s.btnBigText}>Выбрать {AVATARS[avatar]}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 2: Name input ──────────────────────────────── */}
          {step === 2 && (
            <View style={s.center}>
              <Text style={s.avatarPreview}>{AVATARS[avatar]}</Text>
              <View style={s.bubble}>
                <Text style={s.bubbleText}>Как тебя зовут? 😊</Text>
              </View>
              <Text style={s.stepDesc}>Введи своё имя или прозвище</Text>
              <TextInput
                style={s.nameInput}
                placeholder="Твоё имя..."
                placeholderTextColor="#C8AD7A"
                value={name}
                onChangeText={setName}
                maxLength={30}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleNameSave}
              />
              <TouchableOpacity
                style={[s.btnBig, (!name.trim() || saving) && s.btnDisabled]}
                onPress={handleNameSave}
                disabled={!name.trim() || saving}
                activeOpacity={0.85}
              >
                <Text style={s.btnBigText}>{saving ? 'Сохраняем...' : 'Далее →'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 3: Age picker ──────────────────────────────── */}
          {step === 3 && (
            <ScrollView
              contentContainerStyle={s.centerScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.stepTitle}>Сколько тебе лет?</Text>
              <Text style={s.stepDesc}>Подберём подходящие настройки для тебя</Text>
              <View style={s.ageGrid}>
                {AGES.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[s.ageBtn, age === a && s.ageBtnSelected]}
                    onPress={() => setAge(a)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.ageBtnText, age === a && s.ageBtnTextSelected]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[s.btnBig, s.btnBigMt, (!age || saving) && s.btnDisabled]}
                onPress={handleAgeSave}
                disabled={!age || saving}
                activeOpacity={0.85}
              >
                <Text style={s.btnBigText}>{saving ? 'Сохраняем...' : 'Далее →'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8E6' },

  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 8,
  },
  progressTrack: {
    height: 6, backgroundColor: '#FFE899', borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: 6, backgroundColor: '#FFD23F', borderRadius: 3,
  },

  content: { flex: 1 },

  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 32,
  },
  centerScroll: {
    flexGrow: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 32,
  },

  // Welcome
  mascot: { fontSize: 96, marginBottom: 12 },
  welcomeTitle: {
    fontSize: 26, fontWeight: '900', color: '#0D1B12',
    textAlign: 'center', marginTop: 8, marginBottom: 10,
  },
  welcomeDesc: {
    fontSize: 15, color: '#6B7B6E', textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },

  // Speech bubble
  bubble: {
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: '#FFD23F',
    marginBottom: 20, width: '100%', maxWidth: 340,
  },
  bubbleText: {
    fontSize: 15, color: '#0D1B12', textAlign: 'center', lineHeight: 22, fontWeight: '500',
  },

  // Step header
  stepTitle: {
    fontSize: 26, fontWeight: '900', color: '#0D1B12',
    textAlign: 'center', marginBottom: 8, lineHeight: 34,
  },
  stepDesc: {
    fontSize: 14, color: '#6B7B6E', textAlign: 'center', marginBottom: 28,
  },

  // Avatar
  avatarGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 14, marginBottom: 32,
  },
  avatarCard: {
    width: 110, height: 110, borderRadius: 22,
    backgroundColor: 'white', borderWidth: 3, borderColor: '#F0E0B0',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,
    elevation: 3, position: 'relative',
  },
  avatarCardSelected: { borderColor: '#FFD23F', backgroundColor: '#FFFBEA' },
  avatarEmoji: { fontSize: 56 },
  avatarCheck: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: '#FFD23F', borderRadius: 10, width: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarCheckText: { fontSize: 11, fontWeight: '900', color: '#7A5800' },

  // Name
  avatarPreview: { fontSize: 72, marginBottom: 16 },
  nameInput: {
    width: '100%', backgroundColor: 'white', borderRadius: 16,
    padding: 18, fontSize: 22, fontWeight: '700', color: '#0D1B12',
    borderWidth: 2, borderColor: '#FFD23F', textAlign: 'center',
    marginBottom: 24,
  },

  // Age grid
  ageGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 10, marginBottom: 8,
  },
  ageBtn: {
    width: 64, height: 56, borderRadius: 14,
    backgroundColor: 'white', borderWidth: 2, borderColor: '#F0E0B0',
    justifyContent: 'center', alignItems: 'center',
  },
  ageBtnSelected: { backgroundColor: '#FFD23F', borderColor: '#FFD23F' },
  ageBtnText: { fontSize: 20, fontWeight: '700', color: '#6B7B6E' },
  ageBtnTextSelected: { color: '#7A5800' },

  // Big button
  btnBig: {
    backgroundColor: '#FFD23F', borderRadius: 20, paddingVertical: 18,
    paddingHorizontal: 40, alignItems: 'center', width: '100%', maxWidth: 340,
    shadowColor: '#FFD23F', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 5,
  },
  btnBigMt: { marginTop: 16 },
  btnDisabled: { opacity: 0.45 },
  btnBigText: { fontSize: 18, fontWeight: '900', color: '#7A5800' },
});
