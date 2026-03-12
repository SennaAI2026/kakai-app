import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Modal, Animated, Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@kakai/api';
import { setLocale } from '@kakai/i18n';
import { PIN_LENGTH } from '@kakai/shared';
import type { User, ScreenTime, Lang } from '@kakai/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRow = Pick<User, 'id' | 'name' | 'avatar_index' | 'lang' | 'family_id'>;
type TimeRow = Pick<ScreenTime, 'daily_limit_minutes' | 'used_minutes' | 'bonus_minutes'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVATARS = ['🦒', '🐻', '🐼', '🐨'];
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function minsToText(mins: number): string {
  if (mins <= 0) return '0 мин';
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}

// ─── PIN modal ───────────────────────────────────────────────────────────────

function PinModal({
  visible,
  familyId,
  onSuccess,
  onCancel,
}: {
  visible: boolean;
  familyId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState(false);
  const [loading, setLoading] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) { setPin(''); setError(false); }
  }, [visible]);

  function triggerShake() {
    setError(true);
    Animated.sequence([
      Animated.timing(shake, { toValue: 12,  duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start(() => { setPin(''); setError(false); });
  }

  async function verify(entered: string) {
    setLoading(true);

    // If no familyId yet, allow sign-out with any PIN (edge case)
    if (!familyId) { setLoading(false); onSuccess(); return; }

    const { data: family } = await supabase
      .from('families')
      .select('invite_code')
      .eq('id', familyId)
      .maybeSingle();

    setLoading(false);

    // parent_pin field may not exist yet — fall back to invite code last 4 digits
    const storedPin = (family as Record<string, string> | null)?.parent_pin
      ?? (family as Record<string, string> | null)?.invite_code?.slice(-4);

    if (!storedPin || storedPin === entered) {
      onSuccess();
    } else {
      Alert.alert('Неверный PIN', 'Попробуй ещё раз или спроси у родителей.');
      triggerShake();
    }
  }

  function handleKey(key: string) {
    if (key === '' || loading) return;
    if (key === '⌫') { setPin((p) => p.slice(0, -1)); return; }
    const next = pin + key;
    if (next.length > PIN_LENGTH) return;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      setTimeout(() => verify(next), 100);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          <View style={pm.handle} />
          <Text style={pm.title}>Выход из аккаунта</Text>
          <Text style={pm.subtitle}>Введи PIN-код родителя</Text>

          <Animated.View style={[pm.dotsRow, { transform: [{ translateX: shake }] }]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[pm.dot, i < pin.length && (error ? pm.dotError : pm.dotFilled)]}
              />
            ))}
          </Animated.View>

          <View style={pm.pad}>
            {PAD_KEYS.map((key, i) => (
              <TouchableOpacity
                key={i}
                style={[pm.key, key === '' && pm.keyEmpty]}
                onPress={() => handleKey(key)}
                disabled={loading || key === ''}
                activeOpacity={key === '' ? 1 : 0.55}
              >
                <Text style={key === '⌫' ? pm.keyBackspace : pm.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={onCancel} style={pm.cancelBtn} activeOpacity={0.7}>
            <Text style={pm.cancelText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Reusable row ─────────────────────────────────────────────────────────────

function Row({
  emoji, label, value, onPress, danger, right,
}: {
  emoji: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
      disabled={!onPress && !right}
    >
      <Text style={s.rowEmoji}>{emoji}</Text>
      <Text style={[s.rowLabel, danger && s.rowLabelDanger]}>{label}</Text>
      <View style={s.rowRight}>
        {right ?? (
          <>
            {value ? <Text style={s.rowValue}>{value}</Text> : null}
            {onPress ? <Text style={s.rowChevron}>›</Text> : null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLabel}>{text}</Text>;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ChildSettingsScreen() {
  const [user, setUser]             = useState<UserRow | null>(null);
  const [timeRow, setTimeRow]       = useState<TimeRow | null>(null);
  const [lang, setLang]             = useState<Lang>('ru');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showPinModal, setShowPinModal]         = useState(false);
  const [savingAvatar, setSavingAvatar]         = useState(false);

  const avatarAnim = useRef(new Animated.Value(1)).current;

  const loadData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const [{ data: userData }, { data: timeData }] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, avatar_index, lang, family_id')
        .eq('id', authUser.id)
        .maybeSingle(),
      supabase
        .from('screen_time')
        .select('daily_limit_minutes, used_minutes, bonus_minutes')
        .eq('child_id', authUser.id)
        .eq('date', todayISO())
        .maybeSingle(),
    ]);

    if (userData) {
      setUser(userData as UserRow);
      setLang((userData.lang as Lang) ?? 'ru');
    }
    if (timeData) setTimeRow(timeData as TimeRow);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAvatarSelect(idx: number) {
    if (!user || savingAvatar) return;
    setSavingAvatar(true);

    // Bounce animation
    Animated.sequence([
      Animated.timing(avatarAnim, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.spring(avatarAnim,  { toValue: 1, tension: 80, friction: 5, useNativeDriver: true }),
    ]).start();

    const { error } = await supabase
      .from('users')
      .update({ avatar_index: idx })
      .eq('id', user.id);

    if (!error) {
      setUser({ ...user, avatar_index: idx });
      setShowAvatarPicker(false);
    }
    setSavingAvatar(false);
  }

  async function handleLangToggle(value: Lang) {
    setLang(value);
    setLocale(value);
    if (user) {
      await supabase.from('users').update({ lang: value }).eq('id', user.id);
    }
  }

  function handleAbout() {
    const version = Constants.expoConfig?.version ?? '1.0.0';
    Alert.alert('Kakai — Бала', `Версия ${version}\n\nПриложение родительского контроля для Казахстана.`, [{ text: 'OK' }]);
  }

  // Derived
  const avatarEmoji  = AVATARS[user?.avatar_index ?? 0] ?? '🦒';
  const limit        = timeRow?.daily_limit_minutes ?? 0;
  const used         = timeRow?.used_minutes        ?? 0;
  const bonus        = timeRow?.bonus_minutes       ?? 0;
  const remaining    = Math.max(0, limit - used + bonus);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>🦒 Профиль</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Profile card ───────────────────────────────── */}
        <View style={s.profileCard}>
          <TouchableOpacity
            onPress={() => setShowAvatarPicker((v) => !v)}
            activeOpacity={0.85}
          >
            <Animated.Text style={[s.profileAvatar, { transform: [{ scale: avatarAnim }] }]}>
              {avatarEmoji}
            </Animated.Text>
            <View style={s.editBadge}>
              <Text style={s.editBadgeText}>✏️</Text>
            </View>
          </TouchableOpacity>

          <View style={s.profileText}>
            <Text style={s.profileName}>{user?.name ?? '—'}</Text>
            <Text style={s.profileSub}>
              {showAvatarPicker ? 'Выбери аватар ниже' : 'Нажми на аватар, чтобы изменить'}
            </Text>
          </View>
        </View>

        {/* ── Inline avatar picker ────────────────────────── */}
        {showAvatarPicker && (
          <View style={s.avatarPicker}>
            <View style={s.avatarGrid}>
              {AVATARS.map((emoji, i) => {
                const selected = (user?.avatar_index ?? 0) === i;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.avatarOption, selected && s.avatarOptionSelected]}
                    onPress={() => handleAvatarSelect(i)}
                    disabled={savingAvatar}
                    activeOpacity={0.75}
                  >
                    <Text style={s.avatarOptionEmoji}>{emoji}</Text>
                    {selected && (
                      <View style={s.avatarCheck}>
                        <Text style={s.avatarCheckText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Time stats ─────────────────────────────────── */}
        <SectionLabel text="Моё время сегодня" />
        <View style={s.statsCard}>
          <View style={s.statItem}>
            <Text style={s.statEmoji}>⏳</Text>
            <Text style={s.statValue}>{timeRow ? minsToText(remaining) : '—'}</Text>
            <Text style={s.statLabel}>Осталось</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statEmoji}>📊</Text>
            <Text style={s.statValue}>{timeRow ? minsToText(limit) : '—'}</Text>
            <Text style={s.statLabel}>Лимит</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statEmoji}>🎁</Text>
            <Text style={[s.statValue, bonus > 0 && s.statValueGreen]}>
              {timeRow ? `+${bonus} мин` : '—'}
            </Text>
            <Text style={s.statLabel}>Бонус</Text>
          </View>
        </View>

        {/* ── Language ───────────────────────────────────── */}
        <SectionLabel text="Приложение" />
        <View style={s.card}>
          <Row
            emoji="🌐"
            label="Язык"
            right={
              <View style={s.langToggle}>
                {(['ru', 'kz'] as Lang[]).map((l) => (
                  <TouchableOpacity
                    key={l}
                    style={[s.langBtn, lang === l && s.langBtnActive]}
                    onPress={() => handleLangToggle(l)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.langBtnText, lang === l && s.langBtnTextActive]}>
                      {l === 'ru' ? 'РУС' : 'ҚАЗ'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            }
          />
          <View style={s.divider} />
          <Row
            emoji="ℹ️"
            label="О приложении"
            value={`v${Constants.expoConfig?.version ?? '1.0.0'}`}
            onPress={handleAbout}
          />
        </View>

        {/* ── Sign out ───────────────────────────────────── */}
        <SectionLabel text="Аккаунт" />
        <View style={s.card}>
          <Row
            emoji="🚪"
            label="Выйти из аккаунта"
            danger
            onPress={() => setShowPinModal(true)}
          />
        </View>
        <Text style={s.signOutHint}>Для выхода нужен PIN-код родителя</Text>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* PIN modal */}
      <PinModal
        visible={showPinModal}
        familyId={user?.family_id ?? null}
        onSuccess={async () => {
          setShowPinModal(false);
          await supabase.auth.signOut();
        }}
        onCancel={() => setShowPinModal(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8E6' },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 24, paddingBottom: 16,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#0D1B12' },

  // Profile card
  profileCard: {
    backgroundColor: 'white', borderRadius: 24,
    marginHorizontal: 20, marginBottom: 12,
    padding: 24, flexDirection: 'row', alignItems: 'center', gap: 20,
    borderWidth: 2, borderColor: '#FFD23F',
    shadowColor: '#FFD23F', shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
  },
  profileAvatar: { fontSize: 60 },
  editBadge: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: '#FFD23F', borderRadius: 12,
    width: 24, height: 24, justifyContent: 'center', alignItems: 'center',
  },
  editBadgeText: { fontSize: 12 },
  profileText: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: '800', color: '#0D1B12', marginBottom: 4 },
  profileSub:  { fontSize: 12, color: '#9CA3AF', lineHeight: 16 },

  // Avatar picker
  avatarPicker: {
    backgroundColor: 'white', borderRadius: 20,
    marginHorizontal: 20, marginBottom: 16,
    padding: 20, borderWidth: 1.5, borderColor: '#FFD23F',
  },
  avatarGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  avatarOption: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: '#FFF8E6', borderWidth: 2, borderColor: '#F0E0B0',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarOptionSelected: { borderColor: '#FFD23F', backgroundColor: '#FFFBEA' },
  avatarOptionEmoji: { fontSize: 36 },
  avatarCheck: {
    position: 'absolute', top: -8, right: -8,
    backgroundColor: '#FFD23F', borderRadius: 10, width: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarCheckText: { fontSize: 11, fontWeight: '900', color: '#7A5800' },

  // Stats card
  statsCard: {
    backgroundColor: '#0D1B12', borderRadius: 20,
    marginHorizontal: 20, marginBottom: 20,
    flexDirection: 'row', alignItems: 'center', padding: 20,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#FFD23F' },
  statValueGreen: { color: '#0FA968' },
  statLabel: { fontSize: 11, color: '#6B8C7A', fontWeight: '600' },
  statDivider: { width: 1, height: 44, backgroundColor: '#1E3020' },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#A8947A',
    textTransform: 'uppercase', letterSpacing: 1,
    marginHorizontal: 24, marginBottom: 8, marginTop: 4,
  },

  // Card + rows
  card: {
    backgroundColor: 'white', borderRadius: 16,
    marginHorizontal: 20, marginBottom: 8,
    borderWidth: 1, borderColor: '#F0EAD6', overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#F5F0E8', marginLeft: 52 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, gap: 12, minHeight: 54,
  },
  rowEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#0D1B12' },
  rowLabelDanger: { color: '#EF4444' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, color: '#9CA3AF' },
  rowChevron: { fontSize: 22, color: '#D0C8B8', fontWeight: '300' },

  // Language toggle
  langToggle: { flexDirection: 'row', gap: 6 },
  langBtn: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#FFF8E6', borderWidth: 1.5, borderColor: '#F0E0B0',
  },
  langBtnActive: { backgroundColor: '#FFD23F', borderColor: '#FFD23F' },
  langBtnText: { fontSize: 12, fontWeight: '700', color: '#A8947A' },
  langBtnTextActive: { color: '#7A5800' },

  // Sign-out hint
  signOutHint: {
    fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 4,
  },
});

// ─── PIN modal styles ─────────────────────────────────────────────────────────

const pm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 28, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', marginBottom: 24,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0D1B12', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 32 },

  dotsRow: { flexDirection: 'row', gap: 18, marginBottom: 36 },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  dotFilled: { backgroundColor: '#FFD23F', borderColor: '#FFD23F' },
  dotError:  { backgroundColor: '#EF4444', borderColor: '#EF4444' },

  pad: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: 288, justifyContent: 'center', gap: 10,
  },
  key: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#F9F5ED',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#F0E8D0',
  },
  keyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { fontSize: 28, fontWeight: '500', color: '#0D1B12' },
  keyBackspace: { fontSize: 22, color: '#9CA3AF' },

  cancelBtn: { marginTop: 24, paddingVertical: 8 },
  cancelText: { fontSize: 15, color: '#9CA3AF', fontWeight: '600' },
});
