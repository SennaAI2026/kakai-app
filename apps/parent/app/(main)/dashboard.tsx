import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, RefreshControl, Alert, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';
import { DEFAULT_DAILY_LIMIT } from '@kakai/shared';
import type { User, Task } from '@kakai/shared';

interface ScreenTimeRow {
  id: string;
  daily_limit: number;
  used_today: number;
  is_blocked: boolean;
  balance_minutes: number;
  streak_days: number;
}

interface FamilyRow {
  id: string;
  name: string;
  invite_code: string;
}

const AVATARS = ['🦊', '🐻', '🐼', '🐨'];
const ADD_OPTIONS = [15, 30, 60];

function minsToText(mins: number): string {
  if (mins < 60) return `${mins}${t('common.minutes')}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}${t('common.hours')} ${m}${t('common.minutes')}` : `${h}${t('common.hours')}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [children, setChildren] = useState<User[]>([]);
  const [selectedChild, setSelectedChild] = useState<User | null>(null);
  const [screenTime, setScreenTime] = useState<ScreenTimeRow | null>(null);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadChildData = useCallback(async (childId: string) => {
    const [{ data: timeData }, { data: tasksData }] = await Promise.all([
      supabase
        .from('screen_time')
        .select('id, daily_limit, used_today, is_blocked, balance_minutes, streak_days')
        .eq('child_id', childId)
        .maybeSingle(),
      supabase
        .from('tasks')
        .select('*')
        .eq('child_id', childId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    if (timeData) setScreenTime(timeData as ScreenTimeRow);
    if (tasksData) setPendingTasks(tasksData as Task[]);
  }, []);

  const loadData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users').select('family_id').eq('id', authUser.id).maybeSingle();
    if (!userData?.family_id) return;

    const [{ data: familyData }, { data: childrenData }] = await Promise.all([
      supabase.from('families').select('id, name, invite_code').eq('id', userData.family_id).maybeSingle(),
      supabase.from('users').select('*').eq('family_id', userData.family_id).eq('role', 'child'),
    ]);

    if (familyData) setFamily(familyData as FamilyRow);

    if (childrenData?.length) {
      const kids = childrenData as User[];
      setChildren(kids);
      setSelectedChild((prev) => prev ?? kids[0]);
      await loadChildData((kids[0]).id);
    }
  }, [loadChildData]);

  useEffect(() => {
    loadData();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return;
      channel = supabase
        .channel('parent-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          if (selectedChild) loadChildData(selectedChild.id);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'screen_time' }, () => {
          if (selectedChild) loadChildData(selectedChild.id);
        })
        .subscribe();
    });

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [loadData, loadChildData, selectedChild]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function selectChild(child: User) {
    setSelectedChild(child);
    setScreenTime(null);
    setPendingTasks([]);
    await loadChildData(child.id);
  }

  async function toggleBlock(value: boolean) {
    if (!screenTime) return;
    const { error } = await supabase
      .from('screen_time')
      .update({ is_blocked: value })
      .eq('id', screenTime.id);
    if (error) Alert.alert(t('common.error'), error.message);
    else setScreenTime({ ...screenTime, is_blocked: value });
  }

  async function addTime(minutes: number) {
    if (!screenTime) return;
    const newBalance = (screenTime.balance_minutes ?? 0) + minutes;
    const { error } = await supabase
      .from('screen_time')
      .update({ balance_minutes: newBalance })
      .eq('id', screenTime.id);
    if (error) Alert.alert(t('common.error'), error.message);
    else {
      setScreenTime({ ...screenTime, balance_minutes: newBalance });
      Alert.alert('✅', `+${minutes} ${t('common.minutes')}`);
    }
  }

  async function approveTask(taskId: string) {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) Alert.alert(t('common.error'), error.message);
    else {
      setPendingTasks((prev) => prev.filter((tk) => tk.id !== taskId));
      Alert.alert('🎉', t('parent.tasks.approved'));
    }
  }

  const used = screenTime?.used_today ?? 0;
  const limit = screenTime?.daily_limit ?? DEFAULT_DAILY_LIMIT;
  const balance = screenTime?.balance_minutes ?? 0;
  const remaining = Math.max(0, limit - used + balance);
  const usedPct = Math.min(1, used / limit);
  const avatarEmoji = AVATARS[(selectedChild?.avatar_index ?? 1) - 1] ?? '🦊';
  const isBlocked = screenTime?.is_blocked ?? false;

  return (
    <View style={s.container}>
      <FlatList
        data={pendingTasks}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0FA968" />
        }
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={s.header}>
              <View>
                <Text style={s.appTitle}>Kakai</Text>
                {family && <Text style={s.familyName}>👨‍👩‍👧 {family.name}</Text>}
              </View>
              {(screenTime?.streak_days ?? 0) > 0 && (
                <View style={s.streakBadge}>
                  <Text style={s.streakText}>🔥 {screenTime!.streak_days} {t('common.days')}</Text>
                </View>
              )}
            </View>

            {/* Child selector */}
            {children.length > 1 && (
              <View style={s.childRow}>
                {children.map((child) => (
                  <TouchableOpacity
                    key={child.id}
                    style={[s.childTab, selectedChild?.id === child.id && s.childTabActive]}
                    onPress={() => selectChild(child)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.childTabText, selectedChild?.id === child.id && s.childTabTextActive]}>
                      {AVATARS[(child.avatar_index ?? 1) - 1]} {child.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedChild ? (
              <>
                {/* Balance card */}
                <View style={[s.balanceCard, isBlocked && s.balanceCardBlocked]}>
                  <View style={s.balanceTop}>
                    <View style={s.balanceChildInfo}>
                      <Text style={s.balanceAvatar}>{avatarEmoji}</Text>
                      <View>
                        <Text style={s.balanceChildName}>{selectedChild.name}</Text>
                        {selectedChild.age ? (
                          <Text style={s.balanceChildAge}>{selectedChild.age} лет</Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={s.blockToggle}>
                      <Text style={s.blockLabel}>{isBlocked ? '🔒' : '🔓'}</Text>
                      <Switch
                        value={isBlocked}
                        onValueChange={toggleBlock}
                        trackColor={{ false: '#1E3A29', true: '#7F1D1D' }}
                        thumbColor="white"
                      />
                    </View>
                  </View>

                  {isBlocked ? (
                    <View style={s.blockedInfo}>
                      <Text style={s.blockedTitle}>{t('child.home.blocked')}</Text>
                      <Text style={s.blockedDesc}>Экран заблокирован. Выключи блок чтобы ребёнок мог пользоваться.</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={s.remainingLabel}>{t('child.home.screenTimeLeft')}</Text>
                      <Text style={s.remainingValue}>{minsToText(remaining)}</Text>

                      {/* Progress bar */}
                      <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${usedPct * 100}%` as any }]} />
                      </View>
                      <Text style={s.progressSub}>
                        {t('parent.child.usedToday')}: {used}{t('common.minutes')} / {limit}{t('common.minutes')}
                      </Text>

                      {balance > 0 && (
                        <View style={s.bonusBadge}>
                          <Text style={s.bonusText}>🎁 +{balance}{t('common.minutes')} бонус</Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* Add time buttons */}
                  <Text style={s.addLabel}>{t('parent.child.addTime')}</Text>
                  <View style={s.addRow}>
                    {ADD_OPTIONS.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={s.addBtn}
                        onPress={() => addTime(m)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.addBtnText}>+{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* App rules button */}
                <TouchableOpacity
                  style={s.appRulesBtn}
                  onPress={() => router.push({ pathname: '/modals/app-rules', params: { childId: selectedChild.id } })}
                  activeOpacity={0.8}
                >
                  <Text style={s.appRulesIcon}>📱</Text>
                  <View style={s.appRulesInfo}>
                    <Text style={s.appRulesTitle}>Приложения</Text>
                    <Text style={s.appRulesDesc}>Управление доступом к приложениям</Text>
                  </View>
                  <Text style={s.appRulesArrow}>→</Text>
                </TouchableOpacity>

                {/* Pending tasks section title */}
                {pendingTasks.length > 0 && (
                  <Text style={s.sectionTitle}>⏳ Ждут проверки</Text>
                )}
              </>
            ) : (
              /* No children */
              <View style={s.emptyWrap}>
                <Text style={s.emptyEmoji}>👧</Text>
                <Text style={s.emptyText}>{t('parent.home.noChildrenDesc')}</Text>
                {family && (
                  <>
                    <Text style={s.emptyHint}>{t('settings.inviteCode')}:</Text>
                    <Text style={s.inviteCode}>{family.invite_code}</Text>
                  </>
                )}
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={s.taskCard}>
            <View style={s.taskInfo}>
              <Text style={s.taskTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={s.taskReward}>+{item.reward_minutes} {t('common.minutes')}</Text>
            </View>
            <TouchableOpacity
              style={s.approveBtn}
              onPress={() => approveTask(item.id)}
              activeOpacity={0.8}
            >
              <Text style={s.approveBtnText}>✓ Одобрить</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          selectedChild ? (
            <View style={s.tasksEmpty}>
              <Text style={s.tasksEmptyEmoji}>✅</Text>
              <Text style={s.tasksEmptyText}>Нет заданий, ожидающих проверки</Text>
            </View>
          ) : null
        }
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FBF7' },
  listContent: { paddingBottom: 32 },

  // Header
  header: {
    paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  appTitle: { fontSize: 30, fontWeight: '800', color: '#0FA968' },
  familyName: { fontSize: 14, color: '#6B7B6E', marginTop: 2 },
  streakBadge: {
    backgroundColor: '#FFF3CD', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#FFD23F',
  },
  streakText: { fontSize: 13, fontWeight: '700', color: '#92400E' },

  // Child selector
  childRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 24, marginBottom: 16,
  },
  childTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'white', borderWidth: 1, borderColor: '#C8E8D5',
  },
  childTabActive: { backgroundColor: '#0FA968', borderColor: '#0FA968' },
  childTabText: { fontSize: 14, fontWeight: '600', color: '#0D1B12' },
  childTabTextActive: { color: 'white' },

  // Balance card
  balanceCard: {
    marginHorizontal: 24, marginBottom: 28,
    backgroundColor: '#0D1B12', borderRadius: 24, padding: 24,
  },
  balanceCardBlocked: {
    backgroundColor: '#1A0A0A',
    borderWidth: 2, borderColor: '#7F1D1D',
  },
  balanceTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  balanceChildInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balanceAvatar: { fontSize: 38 },
  balanceChildName: { fontSize: 18, fontWeight: '800', color: 'white' },
  balanceChildAge: { fontSize: 13, color: '#8BA897', marginTop: 2 },
  blockToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockLabel: { fontSize: 20 },

  blockedInfo: { alignItems: 'center', paddingVertical: 12 },
  blockedTitle: { fontSize: 18, fontWeight: '800', color: '#FF4D4D', marginBottom: 6 },
  blockedDesc: { fontSize: 13, color: '#8BA897', textAlign: 'center', lineHeight: 18 },

  remainingLabel: { color: '#8BA897', fontSize: 13, marginBottom: 6, textAlign: 'center' },
  remainingValue: {
    color: '#0FA968', fontSize: 46, fontWeight: '900',
    letterSpacing: -1, marginBottom: 16, textAlign: 'center',
  },
  progressTrack: {
    height: 6, backgroundColor: '#1E2F25',
    borderRadius: 3, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: { height: '100%', backgroundColor: '#0FA968', borderRadius: 3 },
  progressSub: { color: '#6B7B6E', fontSize: 12, textAlign: 'center', marginBottom: 12 },
  bonusBadge: {
    backgroundColor: '#1E3A29', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'center', marginBottom: 16,
  },
  bonusText: { color: '#0FA968', fontSize: 13, fontWeight: '600' },

  addLabel: { color: '#8BA897', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  addRow: { flexDirection: 'row', gap: 10 },
  addBtn: {
    flex: 1, backgroundColor: '#1E3A29', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#0FA968',
  },
  addBtnText: { fontSize: 15, fontWeight: '800', color: '#0FA968' },

  // App rules button
  appRulesBtn: {
    marginHorizontal: 24, marginBottom: 24,
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#C8E8D5',
  },
  appRulesIcon: { fontSize: 28, marginRight: 14 },
  appRulesInfo: { flex: 1 },
  appRulesTitle: { fontSize: 16, fontWeight: '700', color: '#0D1B12', marginBottom: 2 },
  appRulesDesc: { fontSize: 12, color: '#6B7B6E' },
  appRulesArrow: { fontSize: 20, color: '#0FA968', fontWeight: '700' },

  // Section title
  sectionTitle: {
    fontSize: 17, fontWeight: '800', color: '#0D1B12',
    paddingHorizontal: 24, marginBottom: 12,
  },

  // Task cards
  taskCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    marginHorizontal: 24, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#C8E8D5',
  },
  taskInfo: { flex: 1, marginRight: 12 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: '#0D1B12', marginBottom: 4 },
  taskReward: { fontSize: 13, color: '#0FA968', fontWeight: '700' },
  approveBtn: {
    backgroundColor: '#0FA968', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  approveBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },

  // Tasks empty
  tasksEmpty: { alignItems: 'center', paddingVertical: 32 },
  tasksEmptyEmoji: { fontSize: 36, marginBottom: 8 },
  tasksEmptyText: { fontSize: 14, color: '#6B7B6E', textAlign: 'center' },

  // No children
  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#6B7B6E', textAlign: 'center', marginBottom: 16 },
  emptyHint: { fontSize: 13, color: '#6B7B6E', marginBottom: 6 },
  inviteCode: { color: '#0FA968', fontSize: 32, fontWeight: '800', letterSpacing: 5 },
});
