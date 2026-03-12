import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ScrollView, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';
import { DEFAULT_DAILY_LIMIT } from '@kakai/shared';
import type { User, Task } from '@kakai/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScreenTimeRow { id: string; daily_limit: number; used_today: number; is_blocked: boolean; balance_minutes: number; streak_days: number }
interface FamilyRow { id: string; name: string; invite_code: string }
interface AppRuleRow { id: string; package_name: string; app_name: string | null; category: string }
interface ScheduleRow { id: string; type: string; label: string | null; start_time: string; end_time: string; days: number[]; is_active: boolean }
interface GpsRow { lat: number; lng: number; accuracy: number | null; created_at: string }
interface LogRow { date: string; minutes: number }

const AVATARS = ['🦒', '🐻', '🐼', '🐨'];
const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function minsToHM(mins: number): string {
  if (mins <= 0) return '0м';
  if (mins < 60) return `${mins}м`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

// ─── Section card helper ────────────────────────────────────────────────────

function SectionRow({ emoji, title, count, onPress, children }: {
  emoji: string; title: string; count?: number; onPress?: () => void; children?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={s.section} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionEmoji}>{emoji}</Text>
        <Text style={s.sectionTitle}>{title}</Text>
        {(count ?? 0) > 0 && (
          <View style={s.sectionBadge}><Text style={s.sectionBadgeText}>{count}</Text></View>
        )}
        <View style={{ flex: 1 }} />
        {onPress && <Text style={s.sectionChevron}>›</Text>}
      </View>
      {children}
    </TouchableOpacity>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [children, setChildren] = useState<User[]>([]);
  const [selectedChild, setSelectedChild] = useState<User | null>(null);
  const [screenTime, setScreenTime] = useState<ScreenTimeRow | null>(null);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [allRules, setAllRules] = useState<AppRuleRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [gps, setGps] = useState<GpsRow | null>(null);
  const [weekLogs, setWeekLogs] = useState<LogRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Derived from allRules — no extra queries
  const limitedApps = allRules.filter((r) => r.category === 'limited');
  const allowedApps = allRules.filter((r) => r.category === 'always');
  const blockedApps = allRules.filter((r) => r.category === 'blocked');

  const loadChildData = useCallback(async (childId: string, familyId: string) => {
    const [
      { data: timeData },
      { data: tasksData },
      { data: rulesData },
      { data: schedData },
      { data: gpsData },
      { data: logsData },
    ] = await Promise.all([
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
      supabase
        .from('app_rules')
        .select('id, package_name, app_name, category')
        .eq('family_id', familyId),
      supabase
        .from('schedules')
        .select('id, type, label, start_time, end_time, days, is_active')
        .eq('child_id', childId),
      supabase
        .from('gps_locations')
        .select('lat, lng, accuracy, created_at')
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('usage_logs')
        .select('date, minutes')
        .eq('child_id', childId)
        .gte('date', getLast7Days()[0]),
    ]);

    if (timeData) setScreenTime(timeData as ScreenTimeRow);
    if (tasksData) setPendingTasks(tasksData as Task[]);
    setAllRules((rulesData as AppRuleRow[]) ?? []);
    setSchedules((schedData as ScheduleRow[]) ?? []);
    setGps(gpsData as GpsRow | null);
    setWeekLogs((logsData as LogRow[]) ?? []);
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
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (selectedChild && family) loadChildData(selectedChild.id, family.id);
  }, [selectedChild, family, loadChildData]);

  useEffect(() => {
    if (!selectedChild || !family) return;
    const channel = supabase
      .channel('parent-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadChildData(selectedChild.id, family.id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'screen_time' }, () => {
        loadChildData(selectedChild.id, family.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChild, family, loadChildData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function selectChild(child: User) {
    setScreenTime(null);
    setPendingTasks([]);
    setAllRules([]);
    setSchedules([]);
    setGps(null);
    setWeekLogs([]);
    setSelectedChild(child);
  }

  async function toggleBlock(value: boolean) {
    if (!screenTime) return;
    const { error } = await supabase
      .from('screen_time').update({ is_blocked: value }).eq('id', screenTime.id);
    if (error) Alert.alert(t('common.error'), error.message);
    else setScreenTime({ ...screenTime, is_blocked: value });
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

  // ── Derived ─────────────────────────────────────────────────────────────

  const used = screenTime?.used_today ?? 0;
  const limit = screenTime?.daily_limit ?? DEFAULT_DAILY_LIMIT;
  const isBlocked = screenTime?.is_blocked ?? false;
  const avatarEmoji = AVATARS[selectedChild?.avatar_index ?? 0] ?? '🦒';
  const activeSchedules = schedules.filter((sc) => sc.is_active);
  const schoolSchedule = activeSchedules.find((sc) => sc.type === 'school');

  const days = getLast7Days();
  const daySums = days.map((date) => ({
    date,
    total: weekLogs.filter((l) => l.date === date).reduce((sum, l) => sum + l.minutes, 0),
  }));
  const maxMins = Math.max(...daySums.map((d) => d.total), 60);

  const now = new Date();
  const updatedStr = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      {/* ── GREEN HEADER ──────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerGradTop} />
        <View style={s.headerInner}>
          {/* Top row: mascot + name | refresh */}
          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <Image source={require('../../assets/giraffe_mascot_clean.png')} style={s.mascot} />
              <View>
                <View style={s.nameRow}>
                  <Text style={s.headerName}>{selectedChild?.name ?? 'Kakai'}</Text>
                  <Text style={s.headerChevron}>›</Text>
                </View>
                <View style={s.statusRow}>
                  <Text style={s.statusText}>🔋 70%</Text>
                  <Text style={s.statusText}>🔇 Без звука</Text>
                </View>
              </View>
            </View>
            <View style={s.headerRight}>
              <Text style={s.updatedText}>Данные обновлены{'\n'}{updatedStr}</Text>
              <TouchableOpacity onPress={onRefresh} activeOpacity={0.7} style={s.refreshBtn}>
                <Text style={s.refreshIcon}>↻</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Child selector: avatar circles */}
          {children.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.avatarRow}>
              {children.map((child) => {
                const active = selectedChild?.id === child.id;
                return (
                  <TouchableOpacity key={child.id} onPress={() => selectChild(child)} activeOpacity={0.8}>
                    <View style={[s.avatarCircle, active && s.avatarCircleActive]}>
                      <Text style={s.avatarEmoji}>{AVATARS[child.avatar_index ?? 0]}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>

      {/* ── SCROLL BODY ───────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2DB573" />}
        contentContainerStyle={s.scrollContent}
      >
        {selectedChild ? (
          <>
            {/* ── MAIN CARD: Лимит на развлечения ──────────────── */}
            <View style={s.mainCard}>
              <TouchableOpacity
                style={s.mainCardHeader}
                onPress={() => router.push({ pathname: '/modals/app-rules', params: { childId: selectedChild.id } })}
                activeOpacity={0.7}
              >
                <Text style={s.mainCardTitle}>Лимит на развлечения</Text>
                {limitedApps.length > 0 && (
                  <View style={s.greenBadge}>
                    <Text style={s.greenBadgeText}>{limitedApps.length}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <Text style={s.mainCardChevron}>›</Text>
              </TouchableOpacity>

              <Text style={s.mainCardDesc}>Общий лимит для игр, видео, соц. сетей...</Text>

              {/* Limited app list */}
              {limitedApps.slice(0, 4).map((app) => (
                <View key={app.id} style={s.limitedRow}>
                  <Text style={s.limitedIcon}>📱</Text>
                  <Text style={s.limitedName} numberOfLines={1}>{app.app_name ?? app.package_name}</Text>
                </View>
              ))}

              {/* Timer section */}
              <View style={s.timerBox}>
                <View style={s.timerDot}>
                  <Text style={s.timerDotText}>⏱</Text>
                </View>
                <Text style={s.timerValue}>{minsToHM(used)} из {minsToHM(limit)}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={s.timerEdit}>Изменить лимит</Text>
                </TouchableOpacity>
              </View>

              {/* Active schedule note */}
              {schoolSchedule && (
                <Text style={s.schedNote}>
                  Активно расписание «{schoolSchedule.label ?? 'Учёба'}» до {schoolSchedule.end_time}
                </Text>
              )}

              {/* Block / Unblock button */}
              <TouchableOpacity
                style={[s.blockBtn, isBlocked && s.blockBtnActive]}
                onPress={() => toggleBlock(!isBlocked)}
                activeOpacity={0.8}
              >
                <Text style={[s.blockBtnText, isBlocked && s.blockBtnTextActive]}>
                  {isBlocked ? '🔓 Разблокировать' : '🔒 Заблокировать'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── BOTTOM SHEET VISUAL ──────────────────────────── */}
            <View style={s.sheet}>
              <View style={s.handle} />

              {/* Pending tasks banner */}
              {pendingTasks.length > 0 && (
                <View style={s.tasksBanner}>
                  <Text style={s.tasksBannerTitle}>⏳ Ждут проверки ({pendingTasks.length})</Text>
                  {pendingTasks.slice(0, 3).map((task) => (
                    <View key={task.id} style={s.taskRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.taskName} numberOfLines={1}>{task.title}</Text>
                        <Text style={s.taskReward}>+{task.reward_minutes} {t('common.minutes')}</Text>
                      </View>
                      <TouchableOpacity style={s.taskApprove} onPress={() => approveTask(task.id)} activeOpacity={0.8}>
                        <Text style={s.taskApproveText}>✓</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Feedback banner */}
              <TouchableOpacity style={s.banner} activeOpacity={0.8}>
                <Image source={require('../../assets/giraffe_banner.png')} style={s.bannerImg} />
                <View style={s.bannerInfo}>
                  <Text style={s.bannerTitle}>Поделитесь мнением{'\n'}о приложении</Text>
                  <Text style={s.bannerSub}>Нам нужна ваша помощь</Text>
                </View>
                <Text style={s.bannerChevron}>›</Text>
              </TouchableOpacity>

              <View style={s.gap} />

              {/* a) Доступны всегда */}
              <SectionRow
                emoji="🔓" title="Доступны всегда" count={allowedApps.length}
                onPress={() => router.push({ pathname: '/modals/app-rules', params: { childId: selectedChild.id } })}
              >
                {allowedApps.length > 0 ? (
                  <View style={s.appChipRow}>
                    {allowedApps.slice(0, 3).map((app) => (
                      <View key={app.id} style={s.appChip}>
                        <Text style={s.appChipText}>{app.app_name ?? app.package_name}</Text>
                      </View>
                    ))}
                    {allowedApps.length > 3 && <Text style={s.appMore}>+{allowedApps.length - 3}</Text>}
                  </View>
                ) : (
                  <Text style={s.sectionHint}>Нет разрешённых приложений</Text>
                )}
              </SectionRow>

              <View style={s.gap} />

              {/* b) Всегда заблокированы */}
              <SectionRow
                emoji="🔒" title="Всегда заблокированы"
                onPress={() => router.push({ pathname: '/modals/app-rules', params: { childId: selectedChild.id } })}
              >
                {blockedApps.length > 0 ? (
                  <View style={s.appChipRow}>
                    {blockedApps.slice(0, 3).map((app) => (
                      <View key={app.id} style={[s.appChip, s.appChipRed]}>
                        <Text style={[s.appChipText, s.appChipTextRed]}>{app.app_name ?? app.package_name}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <>
                    <Text style={s.sectionHint}>Добавьте приложения, которые всегда заблокированы</Text>
                    <TouchableOpacity
                      style={s.dashedBtn}
                      onPress={() => router.push({ pathname: '/modals/app-rules', params: { childId: selectedChild.id } })}
                      activeOpacity={0.7}
                    >
                      <Text style={s.dashedBtnText}>+ Добавить приложения</Text>
                    </TouchableOpacity>
                  </>
                )}
              </SectionRow>

              <View style={s.gap} />

              {/* c) Блокировать по расписанию */}
              <SectionRow
                emoji="📅" title="Блокировать по расписанию"
                onPress={() => router.push('/(main)/schedule')}
              >
                {activeSchedules.length > 0 ? (
                  activeSchedules.map((sc) => (
                    <View key={sc.id} style={s.schedRow}>
                      <Text style={s.schedIcon}>
                        {sc.type === 'sleep' ? '🌙' : sc.type === 'school' ? '🏫' : '⏰'}
                      </Text>
                      <Text style={s.schedLabel}>{sc.label ?? sc.type}</Text>
                      <Text style={s.schedTime}>{sc.start_time}—{sc.end_time}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={s.sectionHint}>Нет активных расписаний</Text>
                )}
              </SectionRow>

              <View style={s.gap} />

              {/* d) Местоположение */}
              <SectionRow
                emoji="📍" title={t('parent.child.location')}
                onPress={() => router.push('/(main)/map')}
              >
                <View style={s.mapPlaceholder}>
                  <Text style={s.mapIcon}>📍</Text>
                  {gps && <Text style={s.mapCoord}>{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</Text>}
                </View>
              </SectionRow>

              <View style={s.gap} />

              {/* e) Недельный график */}
              <SectionRow emoji="📊" title="Экранное время за неделю"
                onPress={() => router.push('/(main)/history')}
              >
                <View style={s.chart}>
                  {daySums.map(({ date, total }) => {
                    const pct = total > 0 ? Math.max(6, (total / maxMins) * 100) : 3;
                    const isToday = date === days[days.length - 1];
                    return (
                      <View key={date} style={s.barCol}>
                        <Text style={s.barVal}>{total > 0 ? minsToHM(total) : '—'}</Text>
                        <View style={s.barTrack}>
                          <View style={[s.bar, { height: `${pct}%` as any }, isToday ? s.barToday : total > 0 ? s.barFilled : s.barEmpty]} />
                        </View>
                        <Text style={[s.barDay, isToday && s.barDayToday]}>{DAY_LABELS[new Date(date).getDay()]}</Text>
                      </View>
                    );
                  })}
                </View>
              </SectionRow>
            </View>
          </>
        ) : (
          <View style={s.emptyWrap}>
            <Image source={require('../../assets/giraffe_welcome.png')} style={s.emptyImg} resizeMode="contain" />
            <Text style={s.emptyText}>{t('parent.home.noChildrenDesc')}</Text>
            {family && (
              <>
                <Text style={s.emptyHint}>{t('settings.inviteCode')}:</Text>
                <Text style={s.emptyCode}>{family.invite_code}</Text>
              </>
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF1F5' },

  // Header
  header: { backgroundColor: '#1B7A45', paddingTop: 52, paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  headerGradTop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#2DB573', opacity: 0.45 },
  headerInner: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mascot: { width: 56, height: 56, borderRadius: 28 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerName: { fontSize: 22, fontWeight: '800', color: 'white' },
  headerChevron: { fontSize: 22, color: 'rgba(255,255,255,0.6)', fontWeight: '300' },
  statusRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  statusText: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  updatedText: { fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'right', lineHeight: 15 },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  refreshIcon: { fontSize: 18, color: 'white', fontWeight: '700' },

  // Avatar selector
  avatarRow: { gap: 10, paddingTop: 16 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarCircleActive: { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.3)' },
  avatarEmoji: { fontSize: 22 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingBottom: 100 },

  // Main card
  mainCard: { backgroundColor: 'white', borderRadius: 18, marginHorizontal: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  mainCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  mainCardTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  mainCardChevron: { fontSize: 22, color: '#C0C0C0', fontWeight: '300' },
  mainCardDesc: { fontSize: 13, color: '#8E8E93', marginBottom: 12 },
  greenBadge: { backgroundColor: '#2DB573', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  greenBadgeText: { fontSize: 12, fontWeight: '700', color: 'white' },

  // Limited app rows
  limitedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  limitedIcon: { fontSize: 16 },
  limitedName: { fontSize: 14, color: '#3C3C43', flex: 1 },

  // Timer
  timerBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FAF5', borderRadius: 14, padding: 14, marginTop: 12, gap: 10 },
  timerDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2DB573', justifyContent: 'center', alignItems: 'center' },
  timerDotText: { fontSize: 14, color: 'white' },
  timerValue: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  timerEdit: { fontSize: 13, fontWeight: '600', color: '#2DB573' },

  // Schedule note
  schedNote: { fontSize: 12, color: '#8E8E93', marginTop: 10 },

  // Block button
  blockBtn: { marginTop: 14, borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: 'white' },
  blockBtnActive: { borderColor: '#2DB573', backgroundColor: '#F0FAF5' },
  blockBtnText: { fontSize: 15, fontWeight: '700', color: '#3C3C43' },
  blockBtnTextActive: { color: '#2DB573' },

  // Bottom sheet visual
  sheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: 8, paddingHorizontal: 16, paddingBottom: 16 },
  handle: { width: 40, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },

  // Tasks banner
  tasksBanner: { marginBottom: 16 },
  tasksBannerTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  taskRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 12, padding: 12, marginBottom: 6 },
  taskName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 2 },
  taskReward: { fontSize: 12, color: '#2DB573', fontWeight: '700' },
  taskApprove: { backgroundColor: '#2DB573', borderRadius: 10, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  taskApproveText: { color: 'white', fontWeight: '800', fontSize: 16 },

  // Banner
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 16, padding: 14, gap: 12, marginBottom: 8 },
  bannerImg: { width: 56, height: 56, borderRadius: 14 },
  bannerInfo: { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', lineHeight: 19 },
  bannerSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  bannerChevron: { fontSize: 22, color: '#C0C0C0', fontWeight: '300' },

  // Gap
  gap: { height: 8, backgroundColor: '#EEF1F5', marginHorizontal: -16 },

  // Section rows
  section: { paddingVertical: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  sectionBadge: { backgroundColor: '#EEF1F5', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  sectionBadgeText: { fontSize: 12, fontWeight: '600', color: '#6B7B6E' },
  sectionChevron: { fontSize: 22, color: '#C0C0C0', fontWeight: '300' },
  sectionHint: { fontSize: 13, color: '#8E8E93' },

  // App chips
  appChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  appChip: { backgroundColor: '#F0FAF5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  appChipText: { fontSize: 12, fontWeight: '600', color: '#065F46' },
  appChipRed: { backgroundColor: '#FEF2F2' },
  appChipTextRed: { color: '#991B1B' },
  appMore: { fontSize: 12, color: '#8E8E93', alignSelf: 'center' },

  // Dashed button
  dashedBtn: { marginTop: 10, borderWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  dashedBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7B6E' },

  // Schedule rows
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  schedIcon: { fontSize: 16 },
  schedLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  schedTime: { fontSize: 13, color: '#8E8E93' },

  // Map placeholder
  mapPlaceholder: { height: 90, backgroundColor: '#E4F3EA', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  mapIcon: { fontSize: 28 },
  mapCoord: { fontSize: 11, color: '#6B7B6E', marginTop: 4 },

  // Chart
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6, marginTop: 4 },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barVal: { fontSize: 9, color: '#9CA3AF', marginBottom: 4, textAlign: 'center' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 4 },
  barEmpty: { backgroundColor: '#F0F0F0' },
  barFilled: { backgroundColor: '#C8E8D5' },
  barToday: { backgroundColor: '#2DB573' },
  barDay: { fontSize: 11, color: '#6B7B6E', marginTop: 4 },
  barDayToday: { color: '#2DB573', fontWeight: '700' },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyImg: { width: 140, height: 140, marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#6B7B6E', textAlign: 'center', marginBottom: 16 },
  emptyHint: { fontSize: 13, color: '#6B7B6E', marginBottom: 6 },
  emptyCode: { color: '#2DB573', fontSize: 32, fontWeight: '800', letterSpacing: 5 },
});
