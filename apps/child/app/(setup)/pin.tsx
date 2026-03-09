import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function PinScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  function onKey(key: string) {
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === '' || pin.length >= PIN_LENGTH) return;

    const next = pin + key;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      if (step === 'create') {
        setTimeout(() => {
          setFirstPin(next);
          setStep('confirm');
          setPin('');
        }, 200);
      } else {
        if (next === firstPin) {
          savePin(next);
        } else {
          shake();
          setTimeout(() => setPin(''), 300);
          Alert.alert('PIN-коды не совпадают', 'Попробуйте ещё раз');
        }
      }
    }
  }

  async function savePin(value: string) {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.family_id) {
        // TODO: hash PIN before storing (currently plain text, matching existing project pattern)
        await supabase
          .from('families')
          .update({ parent_pin: value })
          .eq('id', profile.family_id);
      }
    }
    setSaving(false);
    router.push('/(setup)/schedule');
  }

  return (
    <View style={s.root}>
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '82%' }]} />
        </View>
      </View>

      <View style={s.content}>
        <View style={s.iconWrap}>
          <Text style={s.icon}>🔐</Text>
        </View>

        <Text style={s.title}>
          {step === 'create' ? 'Создайте PIN-код' : 'Подтвердите PIN-код'}
        </Text>
        <Text style={s.desc}>
          {step === 'create'
            ? 'Этот код защитит настройки Kakai на телефоне'
            : 'Введите PIN ещё раз для подтверждения'}
        </Text>

        {/* PIN dots */}
        <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[s.pinDot, i < pin.length && s.pinDotFilled]}
            />
          ))}
        </Animated.View>

        {saving && <Text style={s.savingText}>Сохраняем...</Text>}

        {/* Numeric keypad */}
        <View style={s.keypad}>
          {KEYS.map((key, i) => (
            <TouchableOpacity
              key={i}
              style={[s.key, key === '' && s.keyEmpty]}
              onPress={() => key !== '' && onKey(key)}
              activeOpacity={key === '' ? 1 : 0.6}
              disabled={saving}
            >
              <Text style={[s.keyText, key === '⌫' && s.keyBackspace]}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={s.skipBtn}
          onPress={() => router.push('/(setup)/schedule')}
          activeOpacity={0.85}
        >
          <Text style={s.skipBtnText}>Пропустить</Text>
        </TouchableOpacity>

        <View style={s.dots}>
          <View style={s.dot} />
          <View style={s.dot} />
          <View style={s.dot} />
          <View style={s.dot} />
          <View style={s.dot} />
          <View style={s.dot} />
          <View style={[s.dot, s.dotActive]} />
          <View style={s.dot} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8E6' },
  progressWrap: { paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 8 },
  progressTrack: { height: 6, backgroundColor: '#FFE899', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#FFD23F', borderRadius: 3 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 24 },
  iconWrap: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: '#FFF2C8', borderWidth: 2, borderColor: '#FFD23F',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  icon: { fontSize: 44 },
  title: { fontSize: 26, fontWeight: '900', color: '#0D1B12', textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 4 },

  // PIN dots
  dotsRow: { flexDirection: 'row', gap: 20, marginBottom: 32 },
  pinDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#FFD23F', backgroundColor: 'transparent',
  },
  pinDotFilled: { backgroundColor: '#FFD23F' },
  savingText: { fontSize: 14, color: '#9CA3AF', marginBottom: 12 },

  // Keypad
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: 280, justifyContent: 'center',
  },
  key: {
    width: 80, height: 60, margin: 6, borderRadius: 16,
    backgroundColor: 'white', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#F0E0B0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  keyEmpty: { backgroundColor: 'transparent', borderWidth: 0, elevation: 0, shadowOpacity: 0 },
  keyText: { fontSize: 28, fontWeight: '700', color: '#0D1B12' },
  keyBackspace: { fontSize: 24 },

  // Skip
  skipBtn: { marginTop: 16, padding: 14, alignItems: 'center' },
  skipBtnText: { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },

  // Nav dots
  dots: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F0E0B0' },
  dotActive: { backgroundColor: '#FFD23F', width: 20 },
});
