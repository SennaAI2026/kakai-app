import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Switch, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';

const WEEK_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

interface ScheduleItem {
  type: 'sleep' | 'school';
  icon: string;
  label: string;
  startTime: string;
  endTime: string;
  days: number[];
  enabled: boolean;
}

const DEFAULT_SCHEDULES: ScheduleItem[] = [
  {
    type: 'sleep',
    icon: '🌙',
    label: 'Сон',
    startTime: '22:00',
    endTime: '07:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
  },
  {
    type: 'school',
    icon: '🏫',
    label: 'Учёба',
    startTime: '08:00',
    endTime: '16:00',
    days: [1, 2, 3, 4, 5], // Mon–Fri
    enabled: true,
  },
];

export default function ScheduleScreen() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleItem[]>(DEFAULT_SCHEDULES);
  const [saving, setSaving] = useState(false);

  function toggleSchedule(index: number) {
    setSchedules((prev) =>
      prev.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s))
    );
  }

  function toggleDay(scheduleIdx: number, day: number) {
    setSchedules((prev) =>
      prev.map((s, i) => {
        if (i !== scheduleIdx) return s;
        const days = s.days.includes(day)
          ? s.days.filter((d) => d !== day)
          : [...s.days, day].sort();
        return { ...s, days };
      })
    );
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: profile } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.family_id) { setSaving(false); return; }

    const enabled = schedules.filter((s) => s.enabled);
    if (enabled.length === 0) {
      setSaving(false);
      router.push('/(setup)/test-block');
      return;
    }

    for (const sched of enabled) {
      const { error } = await supabase
        .from('schedules')
        .upsert(
          {
            family_id: profile.family_id,
            type: sched.type,
            start_time: sched.startTime,
            end_time: sched.endTime,
            days: sched.days,
            enabled: true,
          },
          { onConflict: 'family_id,type' }
        );

      if (error) {
        Alert.alert('Ошибка', error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push('/(setup)/test-block');
  }

  return (
    <View style={s.root}>
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '92%' }]} />
        </View>
      </View>

      <View style={s.content}>
        <View style={s.iconWrap}>
          <Text style={s.icon}>📅</Text>
        </View>

        <Text style={s.title}>Расписание</Text>
        <Text style={s.desc}>
          Kakai автоматически ограничит телефон в это время
        </Text>

        <View style={s.cardList}>
          {schedules.map((sched, idx) => (
            <View key={sched.type} style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.cardTitleRow}>
                  <Text style={s.cardIcon}>{sched.icon}</Text>
                  <Text style={s.cardLabel}>{sched.label}</Text>
                </View>
                <Switch
                  value={sched.enabled}
                  onValueChange={() => toggleSchedule(idx)}
                  trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
                  thumbColor={sched.enabled ? '#0FA968' : '#D1D5DB'}
                />
              </View>

              {sched.enabled && (
                <>
                  <View style={s.timeRow}>
                    <View style={s.timeBadge}>
                      <Text style={s.timeLabel}>С</Text>
                      <Text style={s.timeValue}>{sched.startTime}</Text>
                    </View>
                    <Text style={s.timeDash}>—</Text>
                    <View style={s.timeBadge}>
                      <Text style={s.timeLabel}>До</Text>
                      <Text style={s.timeValue}>{sched.endTime}</Text>
                    </View>
                  </View>

                  <View style={s.daysRow}>
                    {WEEK_DAYS.map((label, dayIdx) => {
                      const active = sched.days.includes(dayIdx);
                      return (
                        <TouchableOpacity
                          key={dayIdx}
                          style={[s.dayBtn, active && s.dayBtnActive]}
                          onPress={() => toggleDay(idx, dayIdx)}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.dayText, active && s.dayTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[s.btnBig, saving && s.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={s.btnBigText}>{saving ? 'Сохраняем...' : 'Сохранить →'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.skipBtn}
          onPress={() => router.push('/(setup)/test-block')}
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
          <View style={s.dot} />
          <View style={[s.dot, s.dotActive]} />
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
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  iconWrap: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: '#FFF2C8', borderWidth: 2, borderColor: '#FFD23F',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  icon: { fontSize: 44 },
  title: { fontSize: 26, fontWeight: '900', color: '#0D1B12', textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 20, paddingHorizontal: 4 },

  // Schedule cards
  cardList: { width: '100%', maxWidth: 360, gap: 14, marginBottom: 20 },
  card: {
    backgroundColor: 'white', borderRadius: 20, padding: 18,
    borderWidth: 1.5, borderColor: '#FFE899',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { fontSize: 24 },
  cardLabel: { fontSize: 18, fontWeight: '800', color: '#0D1B12' },

  // Time row
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 },
  timeBadge: {
    backgroundColor: '#FFF8E6', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18,
    alignItems: 'center', borderWidth: 1, borderColor: '#FFE899',
  },
  timeLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  timeValue: { fontSize: 22, fontWeight: '900', color: '#0D1B12' },
  timeDash: { fontSize: 18, color: '#9CA3AF', fontWeight: '700' },

  // Days row
  daysRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  dayBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  dayBtnActive: { backgroundColor: '#FFD23F' },
  dayText: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  dayTextActive: { color: '#7A5800' },

  // Buttons
  btnBig: {
    backgroundColor: '#FFD23F', borderRadius: 20, paddingVertical: 18,
    paddingHorizontal: 40, alignItems: 'center', width: '100%', maxWidth: 340,
    shadowColor: '#FFD23F', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 5,
  },
  btnDisabled: { opacity: 0.45 },
  btnBigText: { fontSize: 18, fontWeight: '900', color: '#7A5800' },
  skipBtn: { marginTop: 16, padding: 14, alignItems: 'center' },
  skipBtnText: { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },

  // Nav dots
  dots: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F0E0B0' },
  dotActive: { backgroundColor: '#FFD23F', width: 20 },
});
