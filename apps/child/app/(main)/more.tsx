import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet,
  ScrollView, RefreshControl,
} from 'react-native';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';
import type { Task } from '@kakai/shared';

interface ScheduleRow {
  id: string;
  type: 'sleep' | 'school' | 'custom';
  label: string | null;
  start_time: string;
  end_time: string;
  days: number[];
  is_active: boolean;
}

interface StatsRow {
  streak_days: number;
  balance_minutes: number;
}

const SCHEDULE_ICON: Record<string, string> = {
  sleep:  '🌙',
  school: '🏫',
  custom: '📅',
};

const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function formatDays(days: number[]): string {
  if (days.length === 7) return 'Каждый день';
  if (JSON.stringify([...days].sort()) === JSON.stringify([1, 2, 3, 4, 5]))
    return 'Пн – Пт';
  if (JSON.stringify([...days].sort()) === JSON.stringify([0, 6]))
    return 'Сб, Вс';
  return days.map((d) => DAY_LABELS[d]).join(', ');
}

function formatTime(t: string): string {
  // "HH:MM:SS" → "HH:MM"
  return t.slice(0, 5);
}

function formatTaskDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return t('common.today');
  const isYesterday =
    d.toDateString() === new Date(now.setDate(now.getDate() - 1)).toDateString();
  if (isYesterday) return t('common.yesterday');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function minsToText(mins: number): string {
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}ч ${m}мин` : `${h}ч`;
}

// ─── Week earned helper ────────────────────────────────────────────────────────

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.toISOString();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MoreScreen() {
  const [stats, setStats] = useState<StatsRow | null>(null);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [weekEarned, setWeekEarned] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users').select('family_id').eq('id', authUser.id).maybeSingle();
    if (!userData?.family_id) return;

    const [
      { data: timeData },
      { data: tasksData },
      { data: schedulesData },
    ] = await Promise.all([
      supabase
        .from('screen_time')
        .select('streak_days, balance_minutes')
        .eq('child_id', authUser.id)
        .maybeSingle(),
      supabase
        .from('tasks')
        .select('*')
        .eq('child_id', authUser.id)
        .eq('status', 'approved')
        .order('approved_at', { ascending: false })
        .limit(30),
      supabase
        .from('schedules')
        .select('id, type, label, start_time, end_time, days, is_active')
        .eq('family_id', userData.family_id)
        .eq('is_active', true)
        .order('type'),
    ]);

    if (timeData) setStats(timeData as StatsRow);
    if (tasksData) {
      const tasks = tasksData as Task[];
      setDoneTasks(tasks);
      const weekStart = getWeekStart();
      const earned = tasks
        .filter((tk) => tk.approved_at && tk.approved_at >= weekStart)
        .reduce((sum, tk) => sum + tk.reward_minutes, 0);
      setWeekEarned(earned);
    }
    if (schedulesData) setSchedules(schedulesData as ScheduleRow[]);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  const totalTasksDone = doneTasks.length;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>⭐ Ещё</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD23F" />}
        showsVerticalScrollIndicator={false}
      >

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={[s.statCard, s.statCardStreak]}>
            <Text style={s.statEmoji}>🔥</Text>
            <Text style={s.statValue}>{stats?.streak_days ?? 0}</Text>
            <Text style={s.statLabel}>Серия дней</Text>
          </View>
          <View style={[s.statCard, s.statCardEarned]}>
            <Text style={s.statEmoji}>⏱️</Text>
            <Text style={s.statValue}>{minsToText(weekEarned)}</Text>
            <Text style={s.statLabel}>Заработано за неделю</Text>
          </View>
          <View style={[s.statCard, s.statCardTasks]}>
            <Text style={s.statEmoji}>✅</Text>
            <Text style={s.statValue}>{totalTasksDone}</Text>
            <Text style={s.statLabel}>Заданий выполнено</Text>
          </View>
        </View>

        {/* Schedule section */}
        <Text style={s.sectionTitle}>📅 {t('child.schedule.title')}</Text>

        {schedules.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Расписание не настроено</Text>
          </View>
        ) : (
          <View style={s.scheduleList}>
            {schedules.map((sch) => (
              <View key={sch.id} style={s.scheduleCard}>
                <View style={s.scheduleIcon}>
                  <Text style={s.scheduleIconEmoji}>{SCHEDULE_ICON[sch.type] ?? '📅'}</Text>
                </View>
                <View style={s.scheduleInfo}>
                  <Text style={s.scheduleLabel}>
                    {sch.label ?? t(`child.schedule.${sch.type}`)}
                  </Text>
                  <Text style={s.scheduleTime}>
                    {formatTime(sch.start_time)} – {formatTime(sch.end_time)}
                  </Text>
                  <Text style={s.scheduleDays}>{formatDays(sch.days)}</Text>
                </View>
                <View style={s.scheduleLocked}>
                  <Text style={s.scheduleLockedEmoji}>🔒</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Completed tasks history */}
        <Text style={s.sectionTitle}>🏆 История заданий</Text>

        {doneTasks.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyEmoji}>📋</Text>
            <Text style={s.emptyText}>Пока нет выполненных заданий</Text>
            <Text style={s.emptyHint}>Выполни задание — и оно появится здесь</Text>
          </View>
        ) : (
          <View style={s.taskList}>
            {doneTasks.map((task) => (
              <View key={task.id} style={s.taskCard}>
                <View style={s.taskIconWrap}>
                  <Text style={s.taskIcon}>✅</Text>
                </View>
                <View style={s.taskInfo}>
                  <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
                  <Text style={s.taskDate}>
                    {task.approved_at ? formatTaskDate(task.approved_at) : ''}
                  </Text>
                </View>
                <View style={s.taskRewardBadge}>
                  <Text style={s.taskRewardText}>+{task.reward_minutes} мин</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E6' },

  // Header
  header: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#0D1B12' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 28 },
  statCard: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1.5,
  },
  statCardStreak: { backgroundColor: '#FFF3CD', borderColor: '#FFD23F' },
  statCardEarned: { backgroundColor: '#E6F9F0', borderColor: '#0FA968' },
  statCardTasks: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 18, fontWeight: '900', color: '#0D1B12' },
  statLabel: { fontSize: 10, color: '#6B7B6E', fontWeight: '600', textAlign: 'center', lineHeight: 13 },

  // Section title
  sectionTitle: {
    fontSize: 17, fontWeight: '800', color: '#0D1B12',
    paddingHorizontal: 24, marginBottom: 12,
  },

  // Schedule
  scheduleList: { paddingHorizontal: 24, gap: 10, marginBottom: 28 },
  scheduleCard: {
    backgroundColor: 'white', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: '#F0F0F0',
  },
  scheduleIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#FFF8E6', justifyContent: 'center', alignItems: 'center',
  },
  scheduleIconEmoji: { fontSize: 22 },
  scheduleInfo: { flex: 1 },
  scheduleLabel: { fontSize: 15, fontWeight: '700', color: '#0D1B12', marginBottom: 2 },
  scheduleTime: { fontSize: 14, color: '#0FA968', fontWeight: '600', marginBottom: 2 },
  scheduleDays: { fontSize: 12, color: '#6B7B6E' },
  scheduleLocked: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center',
  },
  scheduleLockedEmoji: { fontSize: 16 },

  // Task history
  taskList: { paddingHorizontal: 24, gap: 8, marginBottom: 28 },
  taskCard: {
    backgroundColor: 'white', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#FFD23F',
  },
  taskIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#E6F9F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  taskIcon: { fontSize: 18 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#0D1B12', marginBottom: 2 },
  taskDate: { fontSize: 12, color: '#6B7B6E' },
  taskRewardBadge: {
    backgroundColor: '#E6F9F0', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  taskRewardText: { fontSize: 12, fontWeight: '700', color: '#0FA968' },

  // Empty states
  emptyCard: {
    backgroundColor: 'white', borderRadius: 14, marginHorizontal: 24,
    marginBottom: 28, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7B6E', textAlign: 'center', fontWeight: '500' },
  emptyHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 4 },
});
