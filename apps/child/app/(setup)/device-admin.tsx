import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, AppState, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  hasDeviceAdminPermission,
  requestDeviceAdmin,
} from 'kakai-blocker';

export default function DeviceAdminScreen() {
  const router = useRouter();
  const [granted, setGranted] = useState(false);

  const checkPermission = useCallback(() => {
    try {
      setGranted(hasDeviceAdminPermission());
    } catch {}
  }, []);

  useEffect(() => {
    checkPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermission();
    });
    return () => sub.remove();
  }, [checkPermission]);

  function handleRequest() {
    try { requestDeviceAdmin(); } catch {}
  }

  return (
    <View style={s.root}>
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '75%' }]} />
        </View>
      </View>

      <View style={s.content}>
        <View style={s.iconWrap}>
          <Text style={s.icon}>🛡️</Text>
          {granted && <View style={s.checkBadge}><Text style={s.checkText}>✓</Text></View>}
        </View>

        <Text style={s.title}>Защита от удаления</Text>
        <Text style={s.desc}>
          Не даст случайно удалить Kakai с телефона. Только родитель сможет отключить приложение.
        </Text>

        <View style={s.bubble}>
          <Text style={s.bubbleText}>
            Нажми "Разрешить" → подтверди активацию администратора
          </Text>
        </View>

        {granted ? (
          <View style={s.grantedCard}>
            <Text style={s.grantedIcon}>✅</Text>
            <Text style={s.grantedText}>Разрешение получено!</Text>
          </View>
        ) : (
          <TouchableOpacity style={s.btnBig} onPress={handleRequest} activeOpacity={0.85}>
            <Text style={s.btnBigText}>Разрешить →</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={s.nextBtn}
          onPress={() => router.push('/(setup)/battery')}
          activeOpacity={0.85}
        >
          <Text style={s.nextBtnText}>{granted ? 'Далее →' : 'Пропустить'}</Text>
        </TouchableOpacity>

        <View style={s.dots}>
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
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  iconWrap: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: '#FFF2C8', borderWidth: 2, borderColor: '#FFD23F',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20, position: 'relative',
  },
  icon: { fontSize: 44 },
  checkBadge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#0FA968', borderRadius: 14, width: 28, height: 28,
    justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF8E6',
  },
  checkText: { color: 'white', fontWeight: '900', fontSize: 14 },
  title: { fontSize: 26, fontWeight: '900', color: '#0D1B12', textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 20, paddingHorizontal: 4 },
  bubble: {
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: '#FFD23F', marginBottom: 24, width: '100%', maxWidth: 340,
  },
  bubbleText: { fontSize: 14, color: '#0D1B12', textAlign: 'center', lineHeight: 20, fontWeight: '500' },
  grantedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ECFDF5', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24,
    borderWidth: 2, borderColor: '#0FA968', width: '100%', maxWidth: 340, justifyContent: 'center',
  },
  grantedIcon: { fontSize: 24 },
  grantedText: { fontSize: 16, fontWeight: '800', color: '#065F46' },
  btnBig: {
    backgroundColor: '#FFD23F', borderRadius: 20, paddingVertical: 18,
    paddingHorizontal: 40, alignItems: 'center', width: '100%', maxWidth: 340,
    shadowColor: '#FFD23F', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 5,
  },
  btnBigText: { fontSize: 18, fontWeight: '900', color: '#7A5800' },
  nextBtn: { marginTop: 16, padding: 14, alignItems: 'center' },
  nextBtnText: { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F0E0B0' },
  dotActive: { backgroundColor: '#FFD23F', width: 20 },
});
