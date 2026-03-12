import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, Animated, Linking, Alert,
} from 'react-native';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';
import type { User } from '@kakai/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GpsPoint {
  id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  recorded_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATARS = ['🦒', '🐻', '🐼', '🐨'];
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const REFRESH_INTERVAL_MS = 60_000;         // 1 minute

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return 'только что';
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return `${Math.floor(s / 86400)} дн назад`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function groupByDate(points: GpsPoint[]): { label: string; points: GpsPoint[] }[] {
  const map = new Map<string, GpsPoint[]>();
  for (const pt of points) {
    const key = pt.recorded_at.split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(pt);
  }
  return Array.from(map.entries()).map(([key, pts]) => ({
    label: formatDateLabel(key + 'T12:00:00'),
    points: pts,
  }));
}

function isOnline(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < ONLINE_THRESHOLD_MS;
}

// ─── Mock Map ─────────────────────────────────────────────────────────────────

function CityMapMock({ pulse, ring }: { pulse: Animated.Value; ring: Animated.Value }) {
  return (
    <View style={m.root}>
      {/* Background */}
      <View style={m.bg} />

      {/* Streets - horizontal */}
      <View style={[m.street, m.streetH, { top: '30%' }]} />
      <View style={[m.street, m.streetH, { top: '60%' }]} />
      <View style={[m.street, m.streetH, { top: '80%' }]} />

      {/* Streets - vertical */}
      <View style={[m.street, m.streetV, { left: '25%' }]} />
      <View style={[m.street, m.streetV, { left: '55%' }]} />
      <View style={[m.street, m.streetV, { left: '78%' }]} />

      {/* Building blocks */}
      <View style={[m.block, { top: '4%',  left: '2%',  width: '20%', height: '22%' }]} />
      <View style={[m.block, { top: '4%',  left: '28%', width: '24%', height: '22%' }]} />
      <View style={[m.block, { top: '4%',  left: '58%', width: '17%', height: '22%' }]} />
      <View style={[m.block, { top: '4%',  left: '80%', width: '18%', height: '22%' }]} />

      <View style={[m.block, { top: '34%', left: '2%',  width: '20%', height: '22%' }]} />
      <View style={[m.block, { top: '34%', left: '28%', width: '12%', height: '22%' }]} />
      <View style={[m.block, { top: '34%', left: '44%', width: '8%',  height: '22%' }]} />
      <View style={[m.block, { top: '34%', left: '58%', width: '17%', height: '10%' }]} />
      <View style={[m.block, { top: '47%', left: '58%', width: '17%', height: '8%'  }]} />
      <View style={[m.block, { top: '34%', left: '80%', width: '18%', height: '22%' }]} />

      <View style={[m.block, { top: '64%', left: '2%',  width: '20%', height: '13%' }]} />
      <View style={[m.block, { top: '64%', left: '28%', width: '24%', height: '13%' }]} />
      <View style={[m.block, { top: '64%', left: '58%', width: '37%', height: '13%' }]} />

      {/* Park (green circle) */}
      <View style={m.park} />

      {/* Accuracy ring (animated) */}
      <Animated.View style={[m.accuracyRing, { opacity: ring, transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] }) }] }]} />

      {/* Pin (pulsing) */}
      <Animated.View style={[m.pin, { transform: [{ scale: pulse }] }]}>
        <View style={m.pinShadow} />
        <View style={m.pinDot} />
      </Animated.View>

      {/* Compass */}
      <View style={m.compass}>
        <Text style={m.compassText}>N</Text>
      </View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const [children, setChildren]           = useState<User[]>([]);
  const [selectedChild, setSelectedChild] = useState<User | null>(null);
  const [points, setPoints]               = useState<GpsPoint[]>([]);
  const [refreshing, setRefreshing]       = useState(false);
  const [tick, setTick]                   = useState(0); // forces "ago" re-render

  const pulse = useRef(new Animated.Value(1)).current;
  const ring  = useRef(new Animated.Value(1)).current;

  // ─── Animations ──────────────────────────────────────────────────────────

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 0, duration: 1400, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1, duration: 0,    useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ─── "X ago" ticker ──────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadPoints = useCallback(async (childId: string) => {
    const { data } = await supabase
      .from('gps_locations')
      .select('id, lat, lng, accuracy, recorded_at')
      .eq('child_id', childId)
      .order('recorded_at', { ascending: false })
      .limit(30);

    setPoints((data as GpsPoint[]) ?? []);
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
      await loadPoints(child.id);
    }
  }, [loadPoints]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: новые точки GPS
  useEffect(() => {
    if (!selectedChild) return;
    const channel = supabase
      .channel(`gps-${selectedChild.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gps_locations', filter: `child_id=eq.${selectedChild.id}` },
        (payload) => {
          const pt = payload.new as GpsPoint;
          setPoints((prev) => [pt, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChild]);

  // Автообновление каждую минуту
  useEffect(() => {
    if (!selectedChild) return;
    const id = setInterval(() => loadPoints(selectedChild.id), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [selectedChild, loadPoints]);

  async function selectChild(child: User) {
    setSelectedChild(child);
    setPoints([]);
    await loadPoints(child.id);
  }

  async function onRefresh() {
    setRefreshing(true);
    if (selectedChild) await loadPoints(selectedChild.id);
    else await loadData();
    setRefreshing(false);
  }

  // ─── Open in maps ─────────────────────────────────────────────────────────

  function openInMaps(lat: number, lng: number) {
    Alert.alert('Открыть в картах', '', [
      {
        text: 'Google Maps',
        onPress: () => Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
          .catch(() => Alert.alert(t('common.error'), 'Не удалось открыть карту')),
      },
      {
        text: 'Яндекс Карты',
        onPress: () => Linking.openURL(`https://maps.yandex.ru/?pt=${lng},${lat}&z=16`)
          .catch(() => Alert.alert(t('common.error'), 'Не удалось открыть карту')),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  // ─── Derived data ─────────────────────────────────────────────────────────

  const latest   = points[0] ?? null;
  const online   = latest ? isOnline(latest.recorded_at) : false;
  const avatar   = AVATARS[selectedChild?.avatar_index ?? 0];
  const grouped  = groupByDate(points);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>🗺️ Местоположение</Text>
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
          latest ? (
            <>
              {/* Status bar */}
              <View style={[s.statusBar, online ? s.statusOnline : s.statusOffline]}>
                <View style={[s.statusDot, { backgroundColor: online ? '#0FA968' : '#9CA3AF' }]} />
                <Text style={[s.statusText, { color: online ? '#065F46' : '#6B7B6E' }]}>
                  {online ? 'В сети' : 'Нет связи'} · {formatAgo(latest.recorded_at)}
                </Text>
                <TouchableOpacity
                  onPress={() => loadPoints(selectedChild.id)}
                  style={s.refreshBtn}
                  activeOpacity={0.7}
                >
                  <Text style={s.refreshBtnText}>↻</Text>
                </TouchableOpacity>
              </View>

              {/* Map card */}
              <View style={s.mapCard}>
                <CityMapMock pulse={pulse} ring={ring} />

                {/* Coords overlay */}
                <View style={s.coordsOverlay}>
                  <Text style={s.coordsText}>
                    {latest.lat.toFixed(5)},  {latest.lng.toFixed(5)}
                  </Text>
                </View>
              </View>

              {/* Info row */}
              <View style={s.infoRow}>
                <View style={s.infoCard}>
                  <Text style={s.infoEmoji}>{avatar}</Text>
                  <View style={s.infoText}>
                    <Text style={s.infoName}>{selectedChild.name}</Text>
                    <Text style={s.infoSub}>{formatAgo(latest.recorded_at)}</Text>
                  </View>
                </View>

                {latest.accuracy != null && (
                  <View style={s.infoCard}>
                    <Text style={s.infoEmoji}>🎯</Text>
                    <View style={s.infoText}>
                      <Text style={s.infoName}>±{Math.round(latest.accuracy)} м</Text>
                      <Text style={s.infoSub}>точность</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={s.mapsBtn}
                  onPress={() => openInMaps(latest.lat, latest.lng)}
                  activeOpacity={0.8}
                >
                  <Text style={s.mapsBtnEmoji}>🗺️</Text>
                  <Text style={s.mapsBtnText}>Открыть{'\n'}в картах</Text>
                </TouchableOpacity>
              </View>

              {/* History timeline */}
              {grouped.length > 0 && (
                <View style={s.timelineCard}>
                  <Text style={s.timelineTitle}>История маршрута</Text>

                  {grouped.map(({ label, points: pts }) => (
                    <View key={label}>
                      {/* Day label */}
                      <View style={s.dayRow}>
                        <View style={s.dayLine} />
                        <Text style={s.dayLabel}>{label}</Text>
                        <View style={s.dayLine} />
                      </View>

                      {/* Points */}
                      {pts.map((pt, i) => {
                        const isFirst = i === 0 && label === grouped[0].label;
                        return (
                          <TouchableOpacity
                            key={pt.id}
                            style={s.ptRow}
                            onPress={() => openInMaps(pt.lat, pt.lng)}
                            activeOpacity={0.7}
                          >
                            {/* Timeline line + dot */}
                            <View style={s.ptLineWrap}>
                              {i > 0 && <View style={s.ptLineTop} />}
                              <View style={[s.ptDot, isFirst && s.ptDotActive]}>
                                {isFirst && <View style={s.ptDotInner} />}
                              </View>
                              {i < pts.length - 1 && <View style={s.ptLineBottom} />}
                            </View>

                            <View style={s.ptContent}>
                              <View style={s.ptMain}>
                                <Text style={s.ptCoords} numberOfLines={1}>
                                  {pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}
                                </Text>
                                <Text style={s.ptTime}>{formatTime(pt.recorded_at)}</Text>
                              </View>
                              {pt.accuracy != null && (
                                <Text style={s.ptAccuracy}>±{Math.round(pt.accuracy)} м</Text>
                              )}
                            </View>

                            <Text style={s.ptChevron}>›</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={s.emptyCard}>
              <Text style={s.emptyEmoji}>📡</Text>
              <Text style={s.emptyTitle}>Нет данных о местоположении</Text>
              <Text style={s.emptyDesc}>
                Убедитесь, что приложение Kakai Бала запущено на телефоне {selectedChild.name} и выданы разрешения на геолокацию
              </Text>
              <View style={s.emptyChecklist}>
                {[
                  'Приложение Kakai Бала установлено',
                  'Разрешение на геолокацию — «Всегда»',
                  'Телефон подключён к интернету',
                ].map((item) => (
                  <View key={item} style={s.emptyCheckRow}>
                    <Text style={s.emptyCheckIcon}>○</Text>
                    <Text style={s.emptyCheckText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyEmoji}>🦒</Text>
            <Text style={s.emptyTitle}>{t('parent.home.noChildrenDesc')}</Text>
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

  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#0D1B12' },

  // Child selector
  childRow: { paddingHorizontal: 24, gap: 8, paddingBottom: 16 },
  childTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'white', borderWidth: 1, borderColor: '#C8E8D5',
  },
  childTabActive: { backgroundColor: '#0FA968', borderColor: '#0FA968' },
  childTabText: { fontSize: 14, fontWeight: '600', color: '#0D1B12' },
  childTabTextActive: { color: 'white' },

  // Status bar
  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 24, marginBottom: 12,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    gap: 8,
  },
  statusOnline:  { backgroundColor: '#D1FAE5' },
  statusOffline: { backgroundColor: '#F3F4F6' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 13, fontWeight: '600' },
  refreshBtn: { padding: 4 },
  refreshBtnText: { fontSize: 18, color: '#0FA968', fontWeight: '700' },

  // Map card
  mapCard: {
    marginHorizontal: 24, marginBottom: 12,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: '#C8E8D5',
  },
  coordsOverlay: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: '#0D1B12CC', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  coordsText: { color: '#0FA968', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },

  // Info row
  infoRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 24, marginBottom: 16,
  },
  infoCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'white', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#C8E8D5',
  },
  infoEmoji: { fontSize: 22 },
  infoText: { flex: 1 },
  infoName: { fontSize: 13, fontWeight: '700', color: '#0D1B12' },
  infoSub: { fontSize: 11, color: '#6B7B6E', marginTop: 1 },
  mapsBtn: {
    backgroundColor: '#0FA968', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  mapsBtnEmoji: { fontSize: 18, marginBottom: 2 },
  mapsBtnText: { color: 'white', fontWeight: '700', fontSize: 11, textAlign: 'center', lineHeight: 14 },

  // Timeline
  timelineCard: {
    backgroundColor: 'white', borderRadius: 16,
    marginHorizontal: 24, marginBottom: 16,
    padding: 20, borderWidth: 1, borderColor: '#C8E8D5',
  },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: '#0D1B12', marginBottom: 16 },

  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
  dayLine: { flex: 1, height: 1, backgroundColor: '#F0F0F0' },
  dayLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },

  ptRow: {
    flexDirection: 'row', alignItems: 'stretch',
    marginBottom: 2, minHeight: 48,
  },
  ptLineWrap: { width: 24, alignItems: 'center' },
  ptLineTop: { flex: 1, width: 2, backgroundColor: '#E5E7EB', marginBottom: 2 },
  ptLineBottom: { flex: 1, width: 2, backgroundColor: '#E5E7EB', marginTop: 2 },
  ptDot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: '#C8E8D5',
    backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  ptDotActive: { borderColor: '#0FA968', backgroundColor: '#E6F9F0' },
  ptDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0FA968' },
  ptContent: { flex: 1, paddingLeft: 12, paddingVertical: 8, justifyContent: 'center' },
  ptMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ptCoords: { flex: 1, fontSize: 13, fontWeight: '500', color: '#0D1B12', marginRight: 8 },
  ptTime: { fontSize: 12, fontWeight: '600', color: '#6B7B6E', flexShrink: 0 },
  ptAccuracy: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  ptChevron: { fontSize: 20, color: '#D1D5DB', alignSelf: 'center', paddingLeft: 4 },

  // Empty
  emptyCard: {
    backgroundColor: 'white', borderRadius: 20,
    marginHorizontal: 24, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: '#C8E8D5',
  },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#0D1B12', textAlign: 'center', marginBottom: 10 },
  emptyDesc: { fontSize: 14, color: '#6B7B6E', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyChecklist: { alignSelf: 'stretch', gap: 10 },
  emptyCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyCheckIcon: { fontSize: 14, color: '#9CA3AF', width: 16 },
  emptyCheckText: { fontSize: 13, color: '#6B7B6E', flex: 1 },
});

// ─── Mock Map Styles ──────────────────────────────────────────────────────────

const m = StyleSheet.create({
  root: {
    height: 220, backgroundColor: '#E8F5EE',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative', overflow: 'hidden',
  },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#EDF7F2' },

  // Roads
  street: { position: 'absolute', backgroundColor: '#FFFFFF' },
  streetH: { left: 0, right: 0, height: 10 },
  streetV: { top: 0, bottom: 0, width: 10 },

  // Building blocks
  block: { position: 'absolute', backgroundColor: '#C8DDD4', borderRadius: 3 },

  // Park
  park: {
    position: 'absolute',
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#86EFAC',
    left: '54%', top: '34%',
  },

  // Accuracy ring (animated)
  accuracyRing: {
    position: 'absolute',
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 1.5, borderColor: '#0FA96840',
    backgroundColor: '#0FA96815',
  },

  // Pin
  pin: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  pinShadow: {
    position: 'absolute',
    width: 24, height: 8, borderRadius: 12,
    backgroundColor: '#00000020', top: 18,
  },
  pinDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#0FA968',
    borderWidth: 3, borderColor: 'white',
    shadowColor: '#0FA968', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
    elevation: 6,
  },

  // Compass
  compass: {
    position: 'absolute', top: 10, right: 12,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#0D1B12CC',
    justifyContent: 'center', alignItems: 'center',
  },
  compassText: { color: '#0FA968', fontSize: 10, fontWeight: '800' },
});
