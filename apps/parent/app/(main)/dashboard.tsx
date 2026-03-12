import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ScrollView, RefreshControl, Alert, Switch,
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
const ADD_OPTIONS = [15, 30, 60];
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ч назад`;
  return `${Math.floor(hrs / 24)}д назад`;
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) { return <View style={[s.card, style]}>{children}</View>; }
function SectionTitle({ emoji, text }: { emoji: string; text: string }) { return <Text style={s.sectionTitle}>{emoji} {text}</Text>; }

export default function DashboardScreen() {
  const router = useRouter();
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [children, setChildren] = useState<User[]>([]);
  const [selectedChild, setSelectedChild] = useState<User | null>(null);
  const [screenTime, setScreenTime] = useState<ScreenTimeRow | null>(null);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [allowedApps, setAllowedApps] = useState<AppRuleRow[]>([]);
  const [blockedApps, setBlockedApps] = useState<AppRuleRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [gps, setGps] = useState<GpsRow | null>(null);
  const [weekLogs, setWeekLogs] = useState<LogRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

    const rules = (rulesData as AppRuleRow[]) ?? [];
    setAllowedApps(rules.filter((r) => r.category === 'always'));
    setBlockedApps(rules.filter((r) => r.category === 'blocked'));

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
      const first = kids[0];
      setSelectedChild((prev) => prev ?? first);
      await loadChildData(first.id, userData.family_id);
    }
  }, [loadChildData]);

  useEffect(() => {
    loadData();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return;
      const reload = () => {
        if (!selectedChild) return;
        supabase.from('users').select('family_id').eq('id', authUser.id).maybeSingle()
          .then(({ data }) => { if (data?.family_id && selectedChild) loadChildData(selectedChild.id, data.family_id); });
      };
      channel = supabase
        .channel('parent-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, reload)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'screen_time' }, reload)
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
    setAllowedApps([]);
    setBlockedApps([]);
    setSchedules([]);
    setGps(null);
    setWeekLogs([]);
    if (family) await loadChildData(child.id, family.id);
  }

  async function toggleBlock(value: boolean) {
    if (!screenTime) return;
    const { error } = await supabase
      .from('screen_time').update({ is_blocked: value }).eq('id', screenTime.id);
    if (error) Alert.alert(t('common.error'), error.message);
    else setScreenTime({ ...screenTime, is_blocked: value });
  }

  async function addTime(minutes: number) {
    if (!screenTime) return;
    const newBalance = (screenTime.balance_minutes ?? 0) + minutes;
    const { error } = await supabase
      .from('screen_time').update({ balance_minutes: newBalance }).eq('id', screenTime.id);
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
  const avatarEmoji = AVATARS[selectedChild?.avatar_index ?? 0] ?? '🦒';
  const isBlocked = screenTime?.is_blocked ?? false;

  // Weekly chart data
  const days = getLast7Days();
  const daySums = days.map((date) => ({
    date,
    total: weekLogs.filter((l) => l.date === date).reduce((sum, l) => sum + l.minutes, 0),
  }));
  const maxMins = Math.max(...daySums.map((d) => d.total), 60);

  const activeSchedules = schedules.filter((sc) => sc.is_active);

  return (
    <View style={s.container}>
      {/* Green header — simulated gradient */}
      <View style={s.headerBg}>
        <View style={s.headerOverlay} />
        <View style={s.headerContent}>
          <View>
            <Text style={s.appTitle}>Kakai</Text>
            {family && <Text style={s.familyName}>{family.name}</Text>}
          </View>
          {(screenTime?.streak_days ?? 0) > 0 && (
            <View style={s.streakBadge}>
              <Text style={s.streakText}>🔥 {screenTime!.streak_days} {t('common.days')}</Text>
            </View>
          )}
        </View>

        {/* Child selector pills */}
        {children.length > 1 && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
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
      </View>

      {/* Body — bottom-sheet style */}
      <ScrollView
        style={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0FA968" />}
        contentContainerStyle={s.bodyContent}
      >
        {selectedChild ? (
          <>
            {/* ① Лимит на развлечения */}
            <Card style={s.limitCard}>
              <View style={s.limitTop}>
                <View style={s.limitChildInfo}>
                  <Text style={s.limitAvatar}>{avatarEmoji}</Text>
                  <View>
                    <Text style={s.limitChildName}>{selectedChild.name}</Text>
                    {selectedChild.age ? <Text style={s.limitChildAge}>{selectedChild.age} лет</Text> : null}
                  </View>
                </View>
                <View style={s.blockToggle}>
                  <Text style={s.blockIcon}>{isBlocked ? '🔒' : '🔓'}</Text>
                  <Switch
                    value={isBlocked}
                    onValueChange={toggleBlock}
                    trackColor={{ false: '#D1D5DB', true: '#EF4444' }}
                    thumbColor="white"
                  />
                </View>
              </View>

              {isBlocked ? (
                <View style={s.blockedBanner}>
                  <Text style={s.blockedTitle}>{t('child.home.blocked')}</Text>
                  <Text style={s.blockedDesc}>Телефон заблокирован</Text>
                </View>
              ) : (
                <>
                  <Text style={s.remainingLabel}>{t('child.home.screenTimeLeft')}</Text>
                  <Text style={s.remainingValue}>{minsToHM(remaining)}</Text>

                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${usedPct * 100}%` as any }]} />
                  </View>
                  <Text style={s.progressSub}>
                    {used}{t('common.minutes')} / {limit}{t('common.minutes')}
                  </Text>

                  {/* Add time buttons */}
                  <View style={s.addRow}>
                    {ADD_OPTIONS.map((m) => (
                      <TouchableOpacity key={m} style={s.addBtn} onPress={() => addTime(m)} activeOpacity={0.8}>
                        <Text style={s.addBtnText}>+{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </Card>

            {/* ② Feedback banner — pending tasks */}
            {pendingTasks.length > 0 && (
              <>
                <SectionTitle emoji="⏳" text={`Ждут проверки (${pendingTasks.length})`} />
                {pendingTasks.map((task) => (
                  <Card key={task.id} style={s.taskCard}>
                    <View style={s.taskInfo}>
                      <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
                      <Text style={s.taskReward}>+{task.reward_minutes} {t('common.minutes')}</Text>
                    </View>
                    <TouchableOpacity style={s.approveBtn} onPress={() => approveTask(task.id)} activeOpacity={0.8}>
                      <Text style={s.approveBtnText}>✓</Text>
                    </TouchableOpacity>
                  </Card>
                ))}
              </>
            )}

            {/* ③ Доступны всегда */}
            <SectionTitle emoji="✅" text="Доступны всегда" />
            <Card>
              {allowedApps.length > 0 ? (
                <View style={s.appsWrap}>
                  {allowedApps.slice(0, 6).map((app) => (
                    <View key={app.id} style={s.appChip}>
                      <Text style={s.appChipText}>{app.app_name ?? app.package_name}</Text>
                    </View>
                  ))}
                  {allowedApps.length > 6 && (
                    <Text style={s.appsMore}>+{allowedApps.length - 6}</Text>
                  )}
                </View>
              ) : (
                <Text style={s.emptyHint}>Нет разрешённых приложений</Text>
              )}
              <TouchableOpacity
                style={s.manageBtn}
                onPress={() => router.push({ pathname: '/modals/app-rules', params: { childId: selectedChild.id } })}
                activeOpacity={0.8}
              >
                <Text style={s.manageBtnText}>Управлять →</Text>
              </TouchableOpacity>
            </Card>

            {/* ④ Всегда заблокированы */}
            <SectionTitle emoji="🚫" text="Всегда заблокированы" />
            <Card>
              {blockedApps.length > 0 ? (
                <View style={s.appsWrap}>
                  {blockedApps.slice(0, 6).map((app) => (
                    <View key={app.id} style={[s.appChip, s.appChipBlocked]}>
                      <Text style={[s.appChipText, s.appChipTextBlocked]}>{app.app_name ?? app.package_name}</Text>
                    </View>
                  ))}
                  {blockedApps.length > 6 && (
                    <Text style={s.appsMore}>+{blockedApps.length - 6}</Text>
                  )}
                </View>
              ) : (
                <Text style={s.emptyHint}>Нет заблокированных приложений</Text>
              )}
              <TouchableOpacity
                style={s.manageBtn}
                onPress={() => router.push({ pathname: '/modals/app-rules', params: { childId: selectedChild.id } })}
                activeOpacity={0.8}
              >
                <Text style={s.manageBtnText}>Управлять →</Text>
              </TouchableOpacity>
            </Card>

            {/* ⑤ Блокировать по расписанию */}
            <SectionTitle emoji="📅" text="Расписание блокировки" />
            <Card>
              {activeSchedules.length > 0 ? (
                activeSchedules.map((sc) => (
                  <View key={sc.id} style={s.schedRow}>
                    <Text style={s.schedIcon}>
                      {sc.type === 'sleep' ? '🌙' : sc.type === 'school' ? '🏫' : '⏰'}
                    </Text>
                    <View style={s.schedInfo}>
                      <Text style={s.schedLabel}>{sc.label ?? sc.type}</Text>
                      <Text style={s.schedTime}>{sc.start_time} – {sc.end_time}</Text>
                    </View>
                    <View style={s.schedBadge}>
                      <Text style={s.schedBadgeText}>Активно</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={s.emptyHint}>Нет активных расписаний</Text>
              )}
              <TouchableOpacity
                style={s.manageBtn}
                onPress={() => router.push('/(main)/schedule')}
                activeOpacity={0.8}
              >
                <Text style={s.manageBtnText}>Управлять →</Text>
              </TouchableOpacity>
            </Card>

            {/* ⑥ Местоположение ребёнка */}
            <SectionTitle emoji="📍" text={t('parent.child.location')} />
            <Card>
              {gps ? (
                <View style={s.gpsContent}>
                  <Text style={s.gpsCoord}>
                    {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                  </Text>
                  <Text style={s.gpsTime}>{timeAgo(gps.created_at)}</Text>
                  {gps.accuracy && <Text style={s.gpsAccuracy}>±{Math.round(gps.accuracy)}м</Text>}
                </View>
              ) : (
                <Text style={s.emptyHint}>{t('parent.child.locationUnknown')}</Text>
              )}
              <TouchableOpacity
                style={s.manageBtn}
                onPress={() => router.push('/(main)/map')}
                activeOpacity={0.8}
              >
                <Text style={s.manageBtnText}>На карте →</Text>
              </TouchableOpacity>
            </Card>

            {/* ⑦ Недельный график */}
            <SectionTitle emoji="📊" text="Экранное время за неделю" />
            <Card>
              <View style={s.chart}>
                {daySums.map(({ date, total }) => {
                  const pct = total > 0 ? Math.max(6, (total / maxMins) * 100) : 3;
                  const isToday = date === days[days.length - 1];
                  return (
                    <View key={date} style={s.barCol}>
                      <Text style={s.barVal}>{total > 0 ? minsToHM(total) : '—'}</Text>
                      <View style={s.barTrack}>
                        <View
                          style={[
                            s.bar,
                            { height: `${pct}%` as any },
                            isToday ? s.barToday : total > 0 ? s.barFilled : s.barEmpty,
                          ]}
                        />
                      </View>
                      <Text style={[s.barDay, isToday && s.barDayToday]}>
                        {DAY_LABELS[new Date(date).getDay()]}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <TouchableOpacity
                style={s.manageBtn}
                onPress={() => router.push('/(main)/history')}
                activeOpacity={0.8}
              >
                <Text style={s.manageBtnText}>Подробнее →</Text>
              </TouchableOpacity>
            </Card>
          </>
        ) : (
          /* No children connected */
          <View style={s.emptyWrap}>
            <Image source={require('../../assets/giraffe_welcome.png')} style={s.emptyImg} resizeMode="contain" />
            <Text style={s.emptyText}>{t('parent.home.noChildrenDesc')}</Text>
            {family && (
              <>
                <Text style={s.emptyHintCode}>{t('settings.inviteCode')}:</Text>
                <Text style={s.inviteCode}>{family.invite_code}</Text>
              </>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF1F5' },
  headerBg: { backgroundColor: '#1B7A45', paddingTop: 56, paddingBottom: 20 },
  headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#2DB573', opacity: 0.45 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 24, marginBottom: 12 },
  appTitle: { fontSize: 28, fontWeight: '800', color: 'white' },
  familyName: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  streakBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  streakText: { fontSize: 13, fontWeight: '700', color: 'white' },
  childRow: { paddingHorizontal: 24, gap: 8, paddingBottom: 4 },
  childTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  childTabActive: { backgroundColor: 'white' },
  childTabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  childTabTextActive: { color: '#1B7A45' },
  body: { flex: 1, backgroundColor: '#EEF1F5', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -12 },
  bodyContent: { paddingTop: 20, paddingBottom: 100 },
  card: { backgroundColor: 'white', borderRadius: 16, marginHorizontal: 20, marginBottom: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginHorizontal: 20, marginBottom: 8, marginTop: 4 },
  limitCard: { borderColor: '#C8E8D5', borderWidth: 1.5 },
  limitTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  limitChildInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  limitAvatar: { fontSize: 36 },
  limitChildName: { fontSize: 17, fontWeight: '800', color: '#0D1B12' },
  limitChildAge: { fontSize: 12, color: '#6B7B6E', marginTop: 1 },
  blockToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockIcon: { fontSize: 18 },
  blockedBanner: { alignItems: 'center', paddingVertical: 16 },
  blockedTitle: { fontSize: 18, fontWeight: '800', color: '#EF4444', marginBottom: 4 },
  blockedDesc: { fontSize: 13, color: '#6B7280' },
  remainingLabel: { fontSize: 12, color: '#6B7B6E', textAlign: 'center', marginBottom: 4 },
  remainingValue: { fontSize: 42, fontWeight: '900', color: '#0FA968', textAlign: 'center', marginBottom: 12, letterSpacing: -1 },
  progressTrack: { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', backgroundColor: '#0FA968', borderRadius: 3 },
  progressSub: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 14 },
  addRow: { flexDirection: 'row', gap: 10 },
  addBtn: { flex: 1, backgroundColor: '#E6F9F0', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#0FA968' },
  addBtnText: { fontSize: 15, fontWeight: '800', color: '#0FA968' },
  taskCard: { flexDirection: 'row', alignItems: 'center' },
  taskInfo: { flex: 1, marginRight: 12 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: '#0D1B12', marginBottom: 2 },
  taskReward: { fontSize: 13, color: '#0FA968', fontWeight: '700' },
  approveBtn: { backgroundColor: '#0FA968', borderRadius: 10, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  approveBtnText: { color: 'white', fontWeight: '800', fontSize: 18 },
  appsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  appChip: { backgroundColor: '#E6F9F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  appChipText: { fontSize: 12, fontWeight: '600', color: '#065F46' },
  appChipBlocked: { backgroundColor: '#FEF2F2' },
  appChipTextBlocked: { color: '#991B1B' },
  appsMore: { fontSize: 12, color: '#6B7280', alignSelf: 'center' },
  manageBtn: { borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 4, paddingTop: 12, alignItems: 'flex-end' },
  manageBtnText: { fontSize: 13, fontWeight: '700', color: '#0FA968' },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  schedIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  schedInfo: { flex: 1 },
  schedLabel: { fontSize: 14, fontWeight: '600', color: '#0D1B12' },
  schedTime: { fontSize: 12, color: '#6B7B6E' },
  schedBadge: { backgroundColor: '#E6F9F0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  schedBadgeText: { fontSize: 11, fontWeight: '600', color: '#059669' },
  gpsContent: { marginBottom: 4 },
  gpsCoord: { fontSize: 15, fontWeight: '700', color: '#0D1B12', marginBottom: 2 },
  gpsTime: { fontSize: 12, color: '#6B7B6E' },
  gpsAccuracy: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6, marginBottom: 8 },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barVal: { fontSize: 9, color: '#9CA3AF', marginBottom: 4, textAlign: 'center' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 4 },
  barEmpty: { backgroundColor: '#F0F0F0' },
  barFilled: { backgroundColor: '#C8E8D5' },
  barToday: { backgroundColor: '#0FA968' },
  barDay: { fontSize: 11, color: '#6B7B6E', marginTop: 4 },
  barDayToday: { color: '#0FA968', fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyImg: { width: 140, height: 140, marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#6B7B6E', textAlign: 'center', marginBottom: 16 },
  emptyHint: { fontSize: 13, color: '#9CA3AF', marginBottom: 8 },
  emptyHintCode: { fontSize: 13, color: '#6B7B6E', marginBottom: 6 },
  inviteCode: { color: '#0FA968', fontSize: 32, fontWeight: '800', letterSpacing: 5 },
});
