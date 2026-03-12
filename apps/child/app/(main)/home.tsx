import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, RefreshControl, Alert, Animated, Platform,
} from 'react-native';
import { supabase } from '@kakai/api';
import type { Task, ScreenTime, User } from '@kakai/shared';
import {
  getUsageStats,
  hasUsageStatsPermission,
  setBlockingEnabled,
  setBlockedApps,
} from 'kakai-blocker';
import type { UsageStat } from 'kakai-blocker';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVATARS = ['🦒', '🐻', '🐼', '🐨'];

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

function greeting(name: string): string {
  const h = new Date().getHours();
  if (h < 5)  return `Поздно уже, ${name} 😴`;
  if (h < 12) return `Доброе утро, ${name}! ☀️`;
  if (h < 17) return `Привет, ${name}! 👋`;
  if (h < 21) return `Добрый вечер, ${name}! 🌆`;
  return `Пора спать, ${name} 🌙`;
}

// ─── Native usage helper ─────────────────────────────────────────────────────

function getNativeUsedMinutes(): number {
  if (Platform.OS !== 'android') return 0;
  try {
    if (!hasUsageStatsPermission()) return 0;
    const now = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const stats: UsageStat[] = getUsageStats(dayStart.getTime(), now);
    const totalMs = stats.reduce((sum, s) => sum + s.totalTimeInForeground, 0);
    return Math.round(totalMs / 60_000);
  } catch {
    return 0;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRow = Pick<User, 'id' | 'name' | 'avatar_index'>;
type TimeRow = Pick<ScreenTime, 'daily_limit_minutes' | 'used_minutes' | 'bonus_minutes' | 'is_blocked'>;
type TaskRow = Pick<Task, 'id' | 'title' | 'description' | 'reward_minutes' | 'status' | 'created_at'>;

// ─── Task card ───────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onMarkDone,
}: {
  task: TaskRow;
  onMarkDone: (id: string) => void;
}) {
  const isPending = task.status === 'pending';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function press() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(() => onMarkDone(task.id));
  }

  return (
    <Animated.View style={[s.taskCard, { transform: [{ scale: scaleAnim }] }]}>
      <View style={s.taskLeft}>
        <View style={[s.taskDot, !isPending && s.taskDotDone]} />
        <View style={s.taskInfo}>
          <Text style={s.taskTitle} numberOfLines={2}>{task.title}</Text>
          {task.description ? (
            <Text style={s.taskDesc} numberOfLines={1}>{task.description}</Text>
          ) : null}
          <View style={s.taskRewardRow}>
            <Text style={s.taskRewardIcon}>⏱</Text>
            <Text style={s.taskRewardText}>+{task.reward_minutes} мин</Text>
          </View>
        </View>
      </View>
      {isPending ? (
        <TouchableOpacity style={s.doneBtn} onPress={press} activeOpacity={0.8}>
          <Text style={s.doneBtnText}>Готово ✓</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.waitingBadge}>
          <Text style={s.waitingText}>⏳ Ждёт</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [user, setUser]           = useState<UserRow | null>(null);
  const [timeRow, setTimeRow]     = useState<TimeRow | null>(null);
  const [tasks, setTasks]         = useState<TaskRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [nativeUsed, setNativeUsed] = useState(0);

  const cardAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const today = todayISO();

    const [{ data: userData }, { data: timeData }, { data: tasksData }] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, avatar_index')
        .eq('id', authUser.id)
        .maybeSingle(),
      supabase
        .from('screen_time')
        .select('daily_limit_minutes, used_minutes, bonus_minutes, is_blocked')
        .eq('child_id', authUser.id)
        .eq('date', today)
        .maybeSingle(),
      supabase
        .from('tasks')
        .select('id, title, description, reward_minutes, status, created_at')
        .eq('child_id', authUser.id)
        .in('status', ['pending', 'done'])
        .order('created_at', { ascending: false }),
    ]);

    if (userData)  setUser(userData as UserRow);
    if (timeData)  setTimeRow(timeData as TimeRow);
    if (tasksData) setTasks(tasksData as TaskRow[]);

    // Get real device usage from native module
    setNativeUsed(getNativeUsedMinutes());

    // Sync blocking state to native SharedPreferences
    if (Platform.OS === 'android') {
      const dbBlocked = (timeData as TimeRow | null)?.is_blocked ?? false;
      const localUsed = getNativeUsedMinutes();
      const localRemaining = Math.max(
        0,
        ((timeData as TimeRow | null)?.daily_limit_minutes ?? 120)
          - (localUsed > 0 ? localUsed : ((timeData as TimeRow | null)?.used_minutes ?? 0))
          + ((timeData as TimeRow | null)?.bonus_minutes ?? 0),
      );
      const shouldBlock = dbBlocked || (localRemaining === 0 && (localUsed > 0 || ((timeData as TimeRow | null)?.used_minutes ?? 0) > 0));
      try { setBlockingEnabled(shouldBlock); } catch {}

      // Sync blocked/limited apps to native
      try {
        const { data: rules } = await supabase
          .from('app_rules')
          .select('package_name')
          .eq('child_id', authUser.id)
          .in('category', ['blocked', 'limited']);
        if (rules) {
          setBlockedApps(rules.map((r: { package_name: string }) => r.package_name));
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    loadData();

    // Animate card in
    Animated.spring(cardAnim, {
      toValue: 1, tension: 55, friction: 8, useNativeDriver: true,
    }).start();

    const channel = supabase
      .channel('child-home')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks',
      }, loadData)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'screen_time',
      }, (payload) => {
        loadData();
        // Immediately sync blocking state from Realtime payload
        if (Platform.OS === 'android' && payload.new) {
          const row = payload.new as Record<string, unknown>;
          const blocked = row.is_blocked === true;
          try { setBlockingEnabled(blocked); } catch {}
        }
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'app_rules',
      }, () => {
        // Re-sync blocked apps when rules change
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function markTaskDone(taskId: string) {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      Alert.alert('Ошибка', error.message);
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'done' as const } : t))
      );
      Alert.alert('🎉 Отлично!', 'Задание отправлено на проверку родителю.');
    }
  }

  // Derived values — prefer native usage when available
  const limit     = timeRow?.daily_limit_minutes ?? 120;
  const dbUsed    = timeRow?.used_minutes        ?? 0;
  const used      = nativeUsed > 0 ? nativeUsed : dbUsed;
  const bonus     = timeRow?.bonus_minutes       ?? 0;
  const remaining = Math.max(0, limit - used + bonus);
  const usedPct   = limit > 0 ? Math.min(1, used / limit) : 0;
  const isBlocked = (timeRow?.is_blocked ?? false) || (remaining === 0 && used > 0);

  const avatarEmoji  = AVATARS[user?.avatar_index ?? 0] ?? '🦒';
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1], outputRange: [40, 0],
  });

  return (
    <View style={s.root}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD23F" />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* ── Header ─────────────────────────────────── */}
            <View style={s.header}>
              <View style={s.headerText}>
                <Text style={s.greetingText} numberOfLines={1}>
                  {greeting(user?.name ?? '...')}
                </Text>
                <Text style={s.headerSub}>Посмотри, что тебя ждёт сегодня</Text>
              </View>
              <Text style={s.avatarText}>{avatarEmoji}</Text>
            </View>

            {/* ── Time card ──────────────────────────────── */}
            <Animated.View
              style={[
                s.timeCard,
                isBlocked && s.timeCardBlocked,
                { opacity: cardAnim, transform: [{ translateY: cardTranslateY }] },
              ]}
            >
              {isBlocked ? (
                /* Blocked state */
                <>
                  <Text style={s.blockedIcon}>🔒</Text>
                  <Text style={s.blockedTitle}>Экранное время закончилось</Text>
                  <Text style={s.blockedDesc}>
                    Выполни задание и заработай больше времени!
                  </Text>
                  {pendingCount > 0 && (
                    <View style={s.blockedHint}>
                      <Text style={s.blockedHintText}>
                        У тебя {pendingCount} задание{pendingCount > 1 ? 'я' : ''} ниже 👇
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                /* Normal state */
                <>
                  <Text style={s.timeLabel}>Осталось сегодня</Text>
                  <Text style={s.timeValue}>{minsToText(remaining)}</Text>

                  {/* Progress bar */}
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${usedPct * 100}%` as any }]} />
                  </View>

                  <View style={s.timeFooter}>
                    <Text style={s.timeSub}>
                      Использовано: <Text style={s.timeSubBold}>{minsToText(used)}</Text>
                    </Text>
                    <Text style={s.timeSub}>
                      Лимит: <Text style={s.timeSubBold}>{minsToText(limit)}</Text>
                    </Text>
                  </View>

                  {bonus > 0 && (
                    <View style={s.bonusBadge}>
                      <Text style={s.bonusText}>🎁 +{bonus} мин бонуса за задания</Text>
                    </View>
                  )}
                </>
              )}
            </Animated.View>

            {/* ── Tasks header ───────────────────────────── */}
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Задания</Text>
              {pendingCount > 0 && (
                <View style={s.pendingBadge}>
                  <Text style={s.pendingBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TaskCard task={item} onMarkDone={markTaskDone} />
        )}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyEmoji}>📋</Text>
            <Text style={s.emptyTitle}>Заданий пока нет</Text>
            <Text style={s.emptyDesc}>
              Родители скоро добавят задания.{'\n'}За каждое — бонусное экранное время!
            </Text>
          </View>
        }
        contentContainerStyle={s.listContent}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8E6' },
  listContent: { paddingBottom: 32, flexGrow: 1 },

  // Header
  header: {
    paddingTop: 56, paddingHorizontal: 24, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerText: { flex: 1, marginRight: 12 },
  greetingText: { fontSize: 20, fontWeight: '800', color: '#0D1B12' },
  headerSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  avatarText: { fontSize: 52 },

  // Time card
  timeCard: {
    marginHorizontal: 20, marginBottom: 24,
    backgroundColor: '#0D1B12', borderRadius: 28,
    padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 6,
  },
  timeCardBlocked: {
    backgroundColor: '#1A0505',
    borderWidth: 2, borderColor: '#FF4D4D',
  },
  timeLabel: { color: '#6B8C7A', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  timeValue: {
    color: '#FFD23F', fontSize: 52, fontWeight: '900',
    letterSpacing: -1, marginBottom: 20,
  },
  progressTrack: {
    width: '100%', height: 8, backgroundColor: '#1E3020',
    borderRadius: 4, overflow: 'hidden', marginBottom: 14,
  },
  progressFill: {
    height: '100%', backgroundColor: '#0FA968', borderRadius: 4,
  },
  timeFooter: {
    flexDirection: 'row', justifyContent: 'space-between', width: '100%',
  },
  timeSub: { color: '#6B8C7A', fontSize: 12 },
  timeSubBold: { color: '#A8C4B4', fontWeight: '700' },
  bonusBadge: {
    marginTop: 16, backgroundColor: '#1A3325',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: '#0FA96844',
  },
  bonusText: { color: '#0FA968', fontSize: 13, fontWeight: '700' },

  // Blocked
  blockedIcon: { fontSize: 48, marginBottom: 12 },
  blockedTitle: {
    fontSize: 18, fontWeight: '800', color: '#FF6B6B',
    textAlign: 'center', marginBottom: 8,
  },
  blockedDesc: {
    fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20,
  },
  blockedHint: {
    marginTop: 16, backgroundColor: '#2A1010',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FF4D4D44',
  },
  blockedHintText: { color: '#FF9999', fontSize: 13, fontWeight: '600' },

  // Section
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0D1B12' },
  pendingBadge: {
    backgroundColor: '#FFD23F', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center',
  },
  pendingBadgeText: { fontSize: 12, fontWeight: '900', color: '#7A5800' },

  // Task card
  taskCard: {
    backgroundColor: 'white', borderRadius: 18, padding: 18,
    marginHorizontal: 20, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FFE899',
    shadowColor: '#FFD23F', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  taskLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginRight: 12 },
  taskDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#FFD23F', marginTop: 5, flexShrink: 0,
  },
  taskDotDone: { backgroundColor: '#D1D5DB' },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 15, fontWeight: '700', color: '#0D1B12', marginBottom: 3, lineHeight: 20 },
  taskDesc: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  taskRewardRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskRewardIcon: { fontSize: 12 },
  taskRewardText: { fontSize: 13, fontWeight: '700', color: '#0FA968' },

  // Done button
  doneBtn: {
    backgroundColor: '#FFD23F', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center',
    shadowColor: '#FFD23F', shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3,
  },
  doneBtnText: { color: '#7A5800', fontWeight: '800', fontSize: 13 },

  // Waiting badge
  waitingBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingVertical: 7, paddingHorizontal: 11,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  waitingText: { fontSize: 12, fontWeight: '700', color: '#92400E' },

  // Empty
  emptyWrap: {
    alignItems: 'center', paddingVertical: 52, paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0D1B12', marginBottom: 8 },
  emptyDesc: {
    fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22,
  },
});
