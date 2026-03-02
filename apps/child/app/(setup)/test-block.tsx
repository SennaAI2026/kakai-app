import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, AppState, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getAllPermissions } from 'kakai-blocker';
import type { PermissionStatus } from 'kakai-blocker';

interface PermissionItem {
  key: keyof PermissionStatus;
  icon: string;
  label: string;
}

const PERM_LIST: PermissionItem[] = [
  { key: 'usageStats',   icon: '📊', label: 'Статистика приложений' },
  { key: 'accessibility', icon: '♿', label: 'Специальные возможности' },
  { key: 'overlay',       icon: '🪟', label: 'Поверх других окон' },
  { key: 'deviceAdmin',   icon: '🛡️', label: 'Защита от удаления' },
  { key: 'batteryOpt',    icon: '🔋', label: 'Режим батареи' },
];

export default function TestBlockScreen() {
  const router = useRouter();
  const [perms, setPerms] = useState<PermissionStatus>({
    usageStats: false,
    accessibility: false,
    overlay: false,
    deviceAdmin: false,
    batteryOpt: false,
  });

  const checkAll = useCallback(() => {
    try {
      setPerms(getAllPermissions());
    } catch {}
  }, []);

  useEffect(() => {
    checkAll();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAll();
    });
    return () => sub.remove();
  }, [checkAll]);

  const grantedCount = PERM_LIST.filter((p) => perms[p.key]).length;
  const allGranted = grantedCount === PERM_LIST.length;
  const criticalGranted = perms.usageStats && perms.accessibility && perms.overlay;

  return (
    <View style={s.root}>
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '100%' }]} />
        </View>
      </View>

      <View style={s.content}>
        <Text style={s.mascot}>🦊</Text>
        <Text style={s.title}>
          {allGranted ? 'Всё готово!' : 'Проверка разрешений'}
        </Text>
        <Text style={s.subtitle}>
          {allGranted
            ? 'Все разрешения выданы. Kakai работает на полную!'
            : `Выдано ${grantedCount} из ${PERM_LIST.length} разрешений`}
        </Text>

        <View style={s.permList}>
          {PERM_LIST.map((item) => {
            const ok = perms[item.key];
            return (
              <View key={String(item.key)} style={[s.permRow, ok ? s.permRowOk : s.permRowFail]}>
                <Text style={s.permIcon}>{item.icon}</Text>
                <Text style={[s.permLabel, ok && s.permLabelOk]}>{item.label}</Text>
                <Text style={ok ? s.permStatusOk : s.permStatusFail}>
                  {ok ? '✓' : '✗'}
                </Text>
              </View>
            );
          })}
        </View>

        {!allGranted && (
          <Text style={s.hintText}>
            {criticalGranted
              ? 'Основные разрешения выданы. Можно продолжить.'
              : 'Без основных разрешений блокировка не будет работать.'}
          </Text>
        )}

        <TouchableOpacity
          style={s.btnBig}
          onPress={() => router.replace('/(main)/home')}
          activeOpacity={0.85}
        >
          <Text style={s.btnBigText}>Начать! 🚀</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8E6' },
  progressWrap: { paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 8 },
  progressTrack: { height: 6, backgroundColor: '#FFE899', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#0FA968', borderRadius: 3 },

  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32 },

  mascot: { fontSize: 72, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: '#0D1B12', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7B6E', textAlign: 'center', marginBottom: 28 },

  permList: { width: '100%', maxWidth: 360, gap: 8, marginBottom: 24 },
  permRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 16, borderWidth: 2,
  },
  permRowOk: { backgroundColor: '#ECFDF5', borderColor: '#0FA968' },
  permRowFail: { backgroundColor: '#FFF5F5', borderColor: '#FCA5A5' },
  permIcon: { fontSize: 22 },
  permLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#6B7B6E' },
  permLabelOk: { color: '#065F46' },
  permStatusOk: { fontSize: 20, fontWeight: '900', color: '#0FA968' },
  permStatusFail: { fontSize: 20, fontWeight: '900', color: '#EF4444' },

  hintText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 20, paddingHorizontal: 12 },

  btnBig: {
    backgroundColor: '#FFD23F', borderRadius: 20, paddingVertical: 18,
    paddingHorizontal: 40, alignItems: 'center', width: '100%', maxWidth: 340,
    shadowColor: '#FFD23F', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 5,
  },
  btnBigText: { fontSize: 18, fontWeight: '900', color: '#7A5800' },
});
