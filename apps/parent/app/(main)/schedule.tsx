import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, TextInput, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';

type ScheduleType = 'sleep' | 'school' | 'custom';

interface ScheduleRow {
  id: string;
  family_id: string;
  type: ScheduleType;
  label: string | null;
  start_time: string;
  end_time: string;
  days: number[];
  is_active: boolean;
}

const TYPE_META: Record<ScheduleType, { emoji: string; label: string; bg: string; color: string }> = {
  sleep:  { emoji: '🌙', label: 'Ночной режим', bg: '#EDE9FE', color: '#6D28D9' },
  school: { emoji: '🏫', label: 'Школа',         bg: '#FEF3C7', color: '#B45309' },
  custom: { emoji: '📅', label: 'Свой режим',    bg: '#D1FAE5', color: '#065F46' },
};

const TYPES: ScheduleType[] = ['sleep', 'school', 'custom'];

const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND  = [0, 6];
const ALL_DAYS  = [0, 1, 2, 3, 4, 5, 6];

function formatDays(days: number[]): string {
  const s = [...days].sort((a, b) => a - b);
  if (s.length === 7) return 'Каждый день';
  if (JSON.stringify(s) === JSON.stringify(WEEKDAYS)) return 'Пн – Пт';
  if (JSON.stringify(s) === JSON.stringify(WEEKEND))  return 'Сб, Вс';
  return s.map((d) => DAY_SHORT[d]).join(', ');
}

function formatTime(str: string): string {
  return str.slice(0, 5);
}

function isValidTime(str: string): boolean {
  return /^\d{2}:\d{2}$/.test(str);
}

// ─── Blank form ────────────────────────────────────────────────────────────────

const BLANK = {
  type: 'sleep' as ScheduleType,
  label: '',
  start_time: '22:00',
  end_time: '07:00',
  days: WEEKDAYS,
  is_active: true,
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);

  // form state
  const [type, setType]         = useState<ScheduleType>(BLANK.type);
  const [label, setLabel]       = useState(BLANK.label);
  const [startTime, setStartTime] = useState(BLANK.start_time);
  const [endTime, setEndTime]   = useState(BLANK.end_time);
  const [days, setDays]         = useState<number[]>(BLANK.days);
  const [active, setActive]     = useState(BLANK.is_active);
  const [saving, setSaving]     = useState(false);

  const loadSchedules = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users').select('family_id').eq('id', authUser.id).maybeSingle();
    if (!userData?.family_id) return;

    setFamilyId(userData.family_id);

    const { data } = await supabase
      .from('schedules')
      .select('id, family_id, type, label, start_time, end_time, days, is_active')
      .eq('family_id', userData.family_id)
      .order('type')
      .order('start_time');

    if (data) setSchedules(data as ScheduleRow[]);
  }, []);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  // ─── Open modal ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setType(BLANK.type);
    setLabel(BLANK.label);
    setStartTime(BLANK.start_time);
    setEndTime(BLANK.end_time);
    setDays(BLANK.days);
    setActive(BLANK.is_active);
    setShowModal(true);
  }

  function openEdit(sch: ScheduleRow) {
    setEditing(sch);
    setType(sch.type);
    setLabel(sch.label ?? '');
    setStartTime(formatTime(sch.start_time));
    setEndTime(formatTime(sch.end_time));
    setDays(sch.days);
    setActive(sch.is_active);
    setShowModal(true);
  }

  // ─── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      Alert.alert('Ошибка', 'Введите время в формате ЧЧ:ММ (например: 22:00)');
      return;
    }
    if (days.length === 0) {
      Alert.alert('Ошибка', 'Выберите хотя бы один день');
      return;
    }
    if (!familyId) return;

    setSaving(true);

    const payload = {
      family_id: familyId,
      type,
      label: type === 'custom' ? (label.trim() || 'Пользовательский') : null,
      start_time: startTime,
      end_time: endTime,
      days: [...days].sort((a, b) => a - b),
      is_active: active,
    };

    const { error } = editing
      ? await supabase.from('schedules').update(payload).eq('id', editing.id)
      : await supabase.from('schedules').insert(payload);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      setShowModal(false);
      loadSchedules();
    }
    setSaving(false);
  }

  // ─── Toggle active ──────────────────────────────────────────────────────────

  async function toggleActive(sch: ScheduleRow, value: boolean) {
    await supabase.from('schedules').update({ is_active: value }).eq('id', sch.id);
    setSchedules((prev) =>
      prev.map((s) => s.id === sch.id ? { ...s, is_active: value } : s)
    );
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  function handleDelete(sch: ScheduleRow) {
    Alert.alert(
      'Удалить расписание?',
      `"${sch.label ?? TYPE_META[sch.type].label}" будет удалено навсегда.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            await supabase.from('schedules').delete().eq('id', sch.id);
            loadSchedules();
          },
        },
      ]
    );
  }

  // ─── Day toggle helpers ──────────────────────────────────────────────────────

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  function setPreset(preset: number[]) {
    setDays(preset);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const grouped: Record<ScheduleType, ScheduleRow[]> = {
    sleep:  schedules.filter((s) => s.type === 'sleep'),
    school: schedules.filter((s) => s.type === 'school'),
    custom: schedules.filter((s) => s.type === 'custom'),
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>📅 {t('child.schedule.title')}</Text>
        <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
          <Text style={s.addBtnText}>＋ Добавить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* Info banner */}
        <View style={s.infoBanner}>
          <Text style={s.infoBannerText}>
            🔒 В указанные часы телефон ребёнка будет автоматически заблокирован
          </Text>
        </View>

        {/* Grouped sections */}
        {TYPES.map((typeKey) => {
          const list = grouped[typeKey];
          if (list.length === 0) return null;
          const meta = TYPE_META[typeKey];
          return (
            <View key={typeKey} style={s.section}>
              <Text style={s.sectionTitle}>{meta.emoji} {meta.label}</Text>
              {list.map((sch) => (
                <TouchableOpacity
                  key={sch.id}
                  style={[s.card, !sch.is_active && s.cardInactive]}
                  onPress={() => openEdit(sch)}
                  activeOpacity={0.85}
                >
                  <View style={[s.cardIcon, { backgroundColor: meta.bg }]}>
                    <Text style={s.cardIconEmoji}>{meta.emoji}</Text>
                  </View>

                  <View style={s.cardBody}>
                    <Text style={[s.cardLabel, !sch.is_active && s.textMuted]}>
                      {sch.label ?? meta.label}
                    </Text>
                    <Text style={[s.cardTime, !sch.is_active && s.textMuted]}>
                      {formatTime(sch.start_time)} – {formatTime(sch.end_time)}
                    </Text>
                    <Text style={s.cardDays}>{formatDays(sch.days)}</Text>
                  </View>

                  <View style={s.cardRight}>
                    <Switch
                      value={sch.is_active}
                      onValueChange={(val) => toggleActive(sch, val)}
                      trackColor={{ false: '#E5E7EB', true: meta.color }}
                      thumbColor="white"
                    />
                    <TouchableOpacity onPress={() => handleDelete(sch)} activeOpacity={0.7} style={s.deleteBtn}>
                      <Text style={s.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {/* Empty state */}
        {schedules.length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyEmoji}>📅</Text>
            <Text style={s.emptyTitle}>Расписание не настроено</Text>
            <Text style={s.emptyDesc}>
              Добавь ночной или школьный режим — телефон будет блокироваться автоматически
            </Text>
            <TouchableOpacity style={s.emptyBtn} onPress={openCreate} activeOpacity={0.8}>
              <Text style={s.emptyBtnText}>＋ Создать расписание</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Create / Edit modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={s.overlayBg} activeOpacity={1} onPress={() => setShowModal(false)} />

          <ScrollView style={s.sheet} contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled">
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{editing ? 'Редактировать' : 'Новое расписание'}</Text>

            {/* Type selector */}
            <Text style={s.fieldLabel}>Тип</Text>
            <View style={s.typeRow}>
              {TYPES.map((tp) => {
                const meta = TYPE_META[tp];
                const selected = type === tp;
                return (
                  <TouchableOpacity
                    key={tp}
                    style={[s.typeBtn, selected && { backgroundColor: meta.bg, borderColor: meta.color }]}
                    onPress={() => {
                      setType(tp);
                      if (tp === 'sleep')  { setStartTime('22:00'); setEndTime('07:00'); setDays(ALL_DAYS); }
                      if (tp === 'school') { setStartTime('08:00'); setEndTime('14:00'); setDays(WEEKDAYS); }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.typeBtnEmoji}>{meta.emoji}</Text>
                    <Text style={[s.typeBtnText, selected && { color: meta.color, fontWeight: '700' }]}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom label */}
            {type === 'custom' && (
              <>
                <Text style={s.fieldLabel}>Название</Text>
                <TextInput
                  style={s.input}
                  placeholder="Например: Обед"
                  placeholderTextColor="#9CA3AF"
                  value={label}
                  onChangeText={setLabel}
                />
              </>
            )}

            {/* Time range */}
            <Text style={s.fieldLabel}>Блокировать с … до …</Text>
            <View style={s.timeRow}>
              <View style={s.timeInputWrap}>
                <Text style={s.timeInputLabel}>Начало</Text>
                <TextInput
                  style={s.timeInput}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="22:00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              <Text style={s.timeDash}>→</Text>
              <View style={s.timeInputWrap}>
                <Text style={s.timeInputLabel}>Конец</Text>
                <TextInput
                  style={s.timeInput}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="07:00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            </View>
            <Text style={s.timeHint}>Формат: ЧЧ:ММ (например 22:00)</Text>

            {/* Day selector */}
            <Text style={s.fieldLabel}>Дни недели</Text>
            <View style={s.dayPresets}>
              {[
                { label: 'Пн–Пт',     value: WEEKDAYS },
                { label: 'Сб–Вс',     value: WEEKEND },
                { label: 'Каждый день', value: ALL_DAYS },
              ].map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={[
                    s.presetChip,
                    JSON.stringify([...days].sort()) === JSON.stringify([...p.value].sort()) && s.presetChipActive,
                  ]}
                  onPress={() => setPreset(p.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    s.presetChipText,
                    JSON.stringify([...days].sort()) === JSON.stringify([...p.value].sort()) && s.presetChipTextActive,
                  ]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.daysRow}>
              {DAY_SHORT.map((dl, idx) => {
                const selected = days.includes(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[s.dayBtn, selected && s.dayBtnActive]}
                    onPress={() => toggleDay(idx)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.dayBtnText, selected && s.dayBtnTextActive]}>{dl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Active toggle */}
            <View style={s.activeRow}>
              <Text style={s.activeLabel}>Включить сейчас</Text>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: '#E5E7EB', true: '#0FA968' }}
                thumbColor="white"
              />
            </View>

            {/* Buttons */}
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)} activeOpacity={0.8}>
                <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, saving && s.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={s.saveBtnText}>{saving ? t('common.loading') : t('common.save')}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FBF7' },

  // Header
  header: {
    paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#0D1B12' },
  addBtn: {
    backgroundColor: '#0D1B12', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  addBtnText: { color: '#0FA968', fontWeight: '700', fontSize: 14 },

  scrollContent: { paddingBottom: 16 },

  // Info banner
  infoBanner: {
    backgroundColor: '#E0F2FE', borderRadius: 12,
    marginHorizontal: 24, marginBottom: 24,
    padding: 14, borderWidth: 1, borderColor: '#BAE6FD',
  },
  infoBannerText: { fontSize: 13, color: '#0C4A6E', lineHeight: 18 },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', color: '#0D1B12',
    paddingHorizontal: 24, marginBottom: 10,
  },

  // Schedule card
  card: {
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    marginHorizontal: 24, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: '#C8E8D5',
  },
  cardInactive: { borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' },
  cardIcon: {
    width: 46, height: 46, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  cardIconEmoji: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: '#0D1B12', marginBottom: 2 },
  cardTime: { fontSize: 16, fontWeight: '800', color: '#0FA968', marginBottom: 2 },
  cardDays: { fontSize: 12, color: '#6B7B6E' },
  cardRight: { alignItems: 'center', gap: 8, flexShrink: 0 },
  textMuted: { color: '#9CA3AF' },

  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0D1B12', marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: '#6B7B6E', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    backgroundColor: '#0FA968', borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },

  // Modal
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000050' },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  sheetContent: { padding: 24 },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#0D1B12', marginBottom: 20 },

  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#6B7B6E',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },

  // Type selector
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 4,
    backgroundColor: '#F4FBF7', borderWidth: 1.5, borderColor: '#C8E8D5',
  },
  typeBtnEmoji: { fontSize: 20 },
  typeBtnText: { fontSize: 11, fontWeight: '600', color: '#6B7B6E', textAlign: 'center' },

  // Input
  input: {
    backgroundColor: '#F4FBF7', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#0D1B12', marginBottom: 20,
    borderWidth: 1, borderColor: '#C8E8D5',
  },

  // Time row
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  timeInputWrap: { flex: 1 },
  timeInputLabel: { fontSize: 11, color: '#6B7B6E', marginBottom: 6 },
  timeInput: {
    backgroundColor: '#F4FBF7', borderRadius: 12, padding: 14,
    fontSize: 20, fontWeight: '800', color: '#0D1B12', textAlign: 'center',
    borderWidth: 1.5, borderColor: '#C8E8D5',
  },
  timeDash: { fontSize: 20, color: '#6B7B6E', marginTop: 20 },
  timeHint: { fontSize: 11, color: '#9CA3AF', marginBottom: 20 },

  // Days
  dayPresets: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F4FBF7', borderWidth: 1, borderColor: '#C8E8D5',
  },
  presetChipActive: { backgroundColor: '#0FA968', borderColor: '#0FA968' },
  presetChipText: { fontSize: 12, fontWeight: '600', color: '#6B7B6E' },
  presetChipTextActive: { color: 'white' },

  daysRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dayBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#F4FBF7', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  dayBtnActive: { backgroundColor: '#0FA968', borderColor: '#0FA968' },
  dayBtnText: { fontSize: 11, fontWeight: '700', color: '#6B7B6E' },
  dayBtnTextActive: { color: 'white' },

  // Active toggle
  activeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F4FBF7', borderRadius: 12, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: '#C8E8D5',
  },
  activeLabel: { fontSize: 15, fontWeight: '600', color: '#0D1B12' },

  // Modal buttons
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, borderRadius: 12, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#C8E8D5',
  },
  cancelBtnText: { fontSize: 15, color: '#6B7B6E', fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: '#0FA968', borderRadius: 12, padding: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
});
