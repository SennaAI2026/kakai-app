import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, Animated,
} from 'react-native';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';
import type { User } from '@kakai/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogRow {
  package_name: string;
  app_name: string | null;
  date: string;
  minutes: number;
}

interface DayStat {
  date: string;
  total: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATARS = ['🦒', '🐻', '🐼', '🐨'];

const CATEGORY_META: Record<string, { emoji: string; label: string; color: string }> = {
  games:         { emoji: '🎮', label: 'Игры',         color: '#7C3AED' },
  social:        { emoji: '💬', label: 'Соцсети',      color: '#2563EB' },
  video:         { emoji: '📺', label: 'Видео',        color: '#DC2626' },
  education:     { emoji: '📚', label: 'Учёба',        color: '#059669' },
  browser:       { emoji: '🌐', label: 'Браузер',      color: '#D97706' },
  communication: { emoji: '📞', label: 'Общение',      color: '#0891B2' },
  other:         { emoji: '📱', label: 'Прочее',       color: '#6B7B6E' },
};

// ─── Category helper ─────────────────────────────────────────────────────────

function guessCategory(pkg: string): string {
  if (/game|play/i.test(pkg)) return 'games';
  if (/social|tiktok|instagram|facebook|vk|snapchat/i.test(pkg)) return 'social';
  if (/youtube|video|netflix|tv/i.test(pkg)) return 'video';
  if (/edu|school|learn|duolingo/i.test(pkg)) return 'education';
  if (/browser|chrome|firefox|safari|opera/i.test(pkg)) return 'browser';
  if (/whatsapp|telegram|messenger|viber|call/i.test(pkg)) return 'communication';
  return 'other';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function minsToText(mins: number): string {
  if (mins === 0) return '0';
  if (mins < 60) return `${mins}м`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
}

function minsToTextFull(mins: number): string {
  if (mins === 0) return '0 мин';
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}

function dayShort(iso: string): string {
  return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][new Date(iso).getDay()];
}

function dayFull(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (iso === todayISO()) return 'Сегодня';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === yesterday.toISOString().split('T')[0]) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [children, setChildren]       = useState<User[]>([]);
  const [selectedChild, setSelectedChild] = useState<User | null>(null);
  const [logs, setLogs]               = useState<LogRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [refreshing, setRefreshing]   = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const days = getLast7Days();

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadLogs = useCallback(async (childId: string) => {
    const since = getLast7Days()[0];
    const { data } = await supabase
      .from('usage_logs')
      .select('package_name, app_name, date, minutes')
      .eq('child_id', childId)
      .gte('date', since)
      .order('date', { ascending: false })
      .order('minutes', { ascending: false });

    setLogs((data as LogRow[]) ?? []);
  }, []);

  const loadData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users').select('family_id').eq('id', authUser.id).maybeSingle();
    if (!userData?.family_id) return;

    const { data: childrenData } = await supabase
      .from('users')
      .select('*')
      .eq('family_id', userData.family_id)
      .eq('role', 'child');

    if (childrenData?.length) {
      const kids = childrenData as User[];
      setChildren(kids);
      const child = kids[0];
      setSelectedChild((prev) => prev ?? child);
      await loadLogs(child.id);
    }
  }, [loadLogs]);

  useEffect(() => { loadData(); }, [loadData]);

  async function selectChild(child: User) {
    setLogs([]);
    setSelectedChild(child);
    await loadLogs(child.id);
  }

  async function onRefresh() {
    setRefreshing(true);
    if (selectedChild) await loadLogs(selectedChild.id);
    else await loadData();
    setRefreshing(false);
  }

  // ─── Select day with fade animation ────────────────────────────────────────

  function selectDate(date: string) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setSelectedDate(date);
  }

  // ─── Derived data ──────────────────────────────────────────────────────────

  const daySummaries: DayStat[] = days.map((date) => ({
    date,
    total: logs
      .filter((l) => l.date === date)
      .reduce((sum, l) => sum + l.minutes, 0),
  }));

  const maxMins   = Math.max(...daySummaries.map((d) => d.total), 60);
  const weekTotal = daySummaries.reduce((sum, d) => sum + d.total, 0);
  const avgPerDay = Math.round(weekTotal / 7);
  const busiestDay = daySummaries.reduce(
    (best, d) => (d.total > best.total ? d : best),
    daySummaries[0]
  );

  const dayLogs = logs
    .filter((l) => l.date === selectedDate)
    .sort((a, b) => b.minutes - a.minutes);
  const dayTotal = dayLogs.reduce((sum, l) => sum + l.minutes, 0);

  // Category breakdown for selected day
  const catTotals = dayLogs.reduce<Record<string, number>>((acc, l) => {
    const key = guessCategory(l.package_name);
    acc[key] = (acc[key] ?? 0) + l.minutes;
    return acc;
  }, {});
  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>📊 История</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0FA968" />
        }
        contentContainerStyle={s.scrollContent}
      >
        {/* Child selector */}
        {children.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.childRow}
          >
            {children.map((child) => (
              <TouchableOpacity
                key={child.id}
                style={[s.childTab, selectedChild?.id === child.id && s.childTabActive]}
                onPress={() => selectChild(child)}
                activeOpacity={0.8}
              >
                <Text style={[s.childTabText, selectedChild?.id === child.id && s.childTabTextActive]}>
                  {AVATARS[child.avatar_index ?? 0]} {child.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {selectedChild ? (
          <>
            {/* Summary card */}
            <View style={s.summaryCard}>
              <View style={s.summaryRow}>
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{minsToTextFull(weekTotal)}</Text>
                  <Text style={s.summaryLbl}>за 7 дней</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{minsToTextFull(avgPerDay)}</Text>
                  <Text style={s.summaryLbl}>в среднем/день</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{dayShort(busiestDay.date)}</Text>
                  <Text style={s.summaryLbl}>самый активный</Text>
                </View>
              </View>
            </View>

            {/* Bar chart */}
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Экранное время по дням</Text>
              <View style={s.chart}>
                {daySummaries.map(({ date, total }) => {
                  const pct = total > 0 ? Math.max(6, (total / maxMins) * 100) : 3;
                  const isSelected = date === selectedDate;
                  const isToday = date === todayISO();
                  return (
                    <TouchableOpacity
                      key={date}
                      style={s.barCol}
                      onPress={() => selectDate(date)}
                      activeOpacity={0.75}
                    >
                      {/* Value label above bar */}
                      <Text style={[s.barVal, isSelected && s.barValActive]} numberOfLines={1}>
                        {total > 0 ? minsToText(total) : '—'}
                      </Text>

                      {/* Bar */}
                      <View style={s.barTrack}>
                        <View
                          style={[
                            s.bar,
                            { height: `${pct}%` as any },
                            isSelected ? s.barSelected : total > 0 ? s.barFilled : s.barEmpty,
                          ]}
                        />
                      </View>

                      {/* Day label */}
                      <Text style={[s.barDay, isSelected && s.barDayActive]}>
                        {dayShort(date)}
                      </Text>
                      {isToday && <View style={s.todayDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Selected day detail */}
            <Animated.View style={{ opacity: fadeAnim }}>
              <View style={s.dayCard}>
                {/* Day header */}
                <View style={s.dayHeader}>
                  <View>
                    <Text style={s.dayTitle}>{dayFull(selectedDate)}</Text>
                    <Text style={s.daySubtitle}>
                      {dayLogs.length > 0
                        ? `${dayLogs.length} ${dayLogs.length === 1 ? 'приложение' : 'приложений'}`
                        : 'Нет данных'}
                    </Text>
                  </View>
                  {dayTotal > 0 && (
                    <View style={s.dayTotalBadge}>
                      <Text style={s.dayTotalText}>{minsToTextFull(dayTotal)}</Text>
                    </View>
                  )}
                </View>

                {dayLogs.length === 0 ? (
                  <View style={s.emptyDay}>
                    <Text style={s.emptyDayEmoji}>😴</Text>
                    <Text style={s.emptyDayText}>Нет данных за этот день</Text>
                  </View>
                ) : (
                  <>
                    {/* Category breakdown */}
                    {catEntries.length > 0 && (
                      <View style={s.catSection}>
                        {catEntries.map(([key, mins]) => {
                          const meta = CATEGORY_META[key] ?? CATEGORY_META.other;
                          const pct = dayTotal > 0 ? Math.round((mins / dayTotal) * 100) : 0;
                          return (
                            <View key={key} style={s.catRow}>
                              <View style={[s.catDot, { backgroundColor: meta.color }]} />
                              <Text style={s.catEmoji}>{meta.emoji}</Text>
                              <Text style={s.catLabel}>{meta.label}</Text>
                              <View style={s.catBarWrap}>
                                <View
                                  style={[
                                    s.catBarFill,
                                    { width: `${pct}%` as any, backgroundColor: meta.color },
                                  ]}
                                />
                              </View>
                              <Text style={s.catPct}>{pct}%</Text>
                              <Text style={s.catMins}>{minsToText(mins)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Divider */}
                    <View style={s.sectionDivider} />

                    {/* App list */}
                    <Text style={s.appListTitle}>По приложениям</Text>
                    {dayLogs.map((log, i) => {
                      const meta = CATEGORY_META[guessCategory(log.package_name)] ?? CATEGORY_META.other;
                      const pct = dayTotal > 0 ? log.minutes / dayTotal : 0;
                      const name = log.app_name ?? log.package_name;
                      return (
                        <View key={`${log.package_name}-${i}`} style={s.appRow}>
                          <View style={[s.appIcon, { backgroundColor: meta.color + '22' }]}>
                            <Text style={s.appIconEmoji}>{meta.emoji}</Text>
                          </View>
                          <View style={s.appInfo}>
                            <View style={s.appNameRow}>
                              <Text style={s.appName} numberOfLines={1}>{name}</Text>
                              <Text style={s.appTime}>{minsToTextFull(log.minutes)}</Text>
                            </View>
                            <View style={s.appBarTrack}>
                              <View
                                style={[
                                  s.appBarFill,
                                  {
                                    width: `${Math.round(pct * 100)}%` as any,
                                    backgroundColor: meta.color,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            </Animated.View>
          </>
        ) : (
          <View style={s.emptyWrap}>
            <Text style={s.emptyEmoji}>🦒</Text>
            <Text style={s.emptyText}>{t('parent.home.noChildrenDesc')}</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FBF7' },
  scrollContent: { paddingBottom: 16 },

  // Header
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#0D1B12' },

  // Child selector
  childRow: { paddingHorizontal: 24, gap: 8, paddingBottom: 16 },
  childTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'white', borderWidth: 1, borderColor: '#C8E8D5',
  },
  childTabActive: { backgroundColor: '#0FA968', borderColor: '#0FA968' },
  childTabText: { fontSize: 14, fontWeight: '600', color: '#0D1B12' },
  childTabTextActive: { color: 'white' },

  // Summary card
  summaryCard: {
    backgroundColor: '#0D1B12', borderRadius: 20,
    marginHorizontal: 24, marginBottom: 16, padding: 20,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 17, fontWeight: '900', color: '#0FA968', marginBottom: 4 },
  summaryLbl: { fontSize: 11, color: '#8BA897', textAlign: 'center' },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#1E3A29' },

  // Bar chart
  chartCard: {
    backgroundColor: 'white', borderRadius: 16,
    marginHorizontal: 24, marginBottom: 16,
    padding: 20, borderWidth: 1, borderColor: '#C8E8D5',
  },
  chartTitle: { fontSize: 14, fontWeight: '700', color: '#0D1B12', marginBottom: 16 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barVal: { fontSize: 9, color: '#9CA3AF', marginBottom: 4, textAlign: 'center' },
  barValActive: { color: '#0FA968', fontWeight: '700' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 4 },
  barEmpty:    { backgroundColor: '#F0F0F0' },
  barFilled:   { backgroundColor: '#C8E8D5' },
  barSelected: { backgroundColor: '#0FA968' },
  barDay: { fontSize: 11, color: '#6B7B6E', marginTop: 6, textAlign: 'center' },
  barDayActive: { color: '#0FA968', fontWeight: '700' },
  todayDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#0FA968', marginTop: 2,
  },

  // Day detail card
  dayCard: {
    backgroundColor: 'white', borderRadius: 16,
    marginHorizontal: 24, marginBottom: 16,
    padding: 20, borderWidth: 1, borderColor: '#C8E8D5',
  },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  dayTitle: { fontSize: 18, fontWeight: '800', color: '#0D1B12', marginBottom: 2 },
  daySubtitle: { fontSize: 12, color: '#6B7B6E' },
  dayTotalBadge: {
    backgroundColor: '#E6F9F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  dayTotalText: { fontSize: 14, fontWeight: '800', color: '#0FA968' },

  // Empty day
  emptyDay: { alignItems: 'center', paddingVertical: 32 },
  emptyDayEmoji: { fontSize: 36, marginBottom: 8 },
  emptyDayText: { fontSize: 14, color: '#9CA3AF' },

  // Category breakdown
  catSection: { marginBottom: 4 },
  catRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 10,
  },
  catDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  catEmoji: { fontSize: 14, flexShrink: 0 },
  catLabel: { fontSize: 13, color: '#0D1B12', fontWeight: '600', width: 72 },
  catBarWrap: {
    flex: 1, height: 6, backgroundColor: '#F0F0F0',
    borderRadius: 3, overflow: 'hidden',
  },
  catBarFill: { height: '100%', borderRadius: 3 },
  catPct: { fontSize: 11, color: '#6B7B6E', width: 30, textAlign: 'right' },
  catMins: { fontSize: 11, fontWeight: '700', color: '#0D1B12', width: 42, textAlign: 'right' },

  // Divider
  sectionDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 },

  // App list
  appListTitle: { fontSize: 13, fontWeight: '700', color: '#6B7B6E', marginBottom: 12 },
  appRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 14,
  },
  appIcon: {
    width: 40, height: 40, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  appIconEmoji: { fontSize: 19 },
  appInfo: { flex: 1 },
  appNameRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  appName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0D1B12', marginRight: 8 },
  appTime: { fontSize: 13, fontWeight: '700', color: '#6B7B6E', flexShrink: 0 },
  appBarTrack: { height: 5, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden' },
  appBarFill: { height: '100%', borderRadius: 3 },

  // No children
  emptyWrap: { alignItems: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#6B7B6E' },
});
