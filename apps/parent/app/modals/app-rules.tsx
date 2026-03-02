import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, RefreshControl, Alert, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@kakai/api';

type AppCategory = 'limited' | 'always' | 'blocked';

interface AppRule {
  id?: string;
  package_name: string;
  app_name: string;
  category: AppCategory;
  family_id: string;
}

interface UsageApp {
  package_name: string;
  app_name: string;
  minutes: number;
}

const CATEGORY_CONFIG: Record<AppCategory, { label: string; emoji: string; color: string; bg: string }> = {
  limited:  { label: 'Контроль',        emoji: '⏱',  color: '#92400E', bg: '#FEF3C7' },
  always:   { label: 'Без ограничений', emoji: '✅', color: '#065F46', bg: '#ECFDF5' },
  blocked:  { label: 'Заблокировано',   emoji: '🚫', color: '#991B1B', bg: '#FEE2E2' },
};

const TABS: AppCategory[] = ['limited', 'always', 'blocked'];

export default function AppRulesScreen() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [rules, setRules] = useState<AppRule[]>([]);
  const [usageApps, setUsageApps] = useState<UsageApp[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [familyId, setFamilyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData?.family_id) return;
    setFamilyId(userData.family_id);

    const [{ data: rulesData }, { data: usageData }] = await Promise.all([
      supabase
        .from('app_rules')
        .select('id, package_name, app_name, category, family_id')
        .eq('family_id', userData.family_id),
      supabase
        .from('usage_logs')
        .select('package_name, app_name, minutes')
        .eq('child_id', childId ?? '')
        .order('minutes', { ascending: false })
        .limit(100),
    ]);

    if (rulesData) setRules(rulesData as AppRule[]);
    if (usageData) setUsageApps(usageData as UsageApp[]);
  }, [childId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function setAppCategory(packageName: string, appName: string, category: AppCategory) {
    if (!familyId) return;

    const existing = rules.find((r) => r.package_name === packageName);

    if (existing?.id) {
      const { error } = await supabase
        .from('app_rules')
        .update({ category })
        .eq('id', existing.id);
      if (error) { Alert.alert('Ошибка', error.message); return; }
      setRules((prev) =>
        prev.map((r) => r.id === existing.id ? { ...r, category } : r)
      );
    } else {
      const { data, error } = await supabase
        .from('app_rules')
        .insert({ package_name: packageName, app_name: appName, category, family_id: familyId })
        .select()
        .single();
      if (error) { Alert.alert('Ошибка', error.message); return; }
      if (data) setRules((prev) => [...prev, data as AppRule]);
    }
  }

  // Merge usage apps with existing rules
  const allApps = usageApps.map((app) => {
    const rule = rules.find((r) => r.package_name === app.package_name);
    return {
      package_name: app.package_name,
      app_name: app.app_name || app.package_name.split('.').pop() || app.package_name,
      minutes: app.minutes,
      category: (rule?.category ?? 'limited') as AppCategory,
    };
  });

  // Also include rules that have no usage data
  rules.forEach((rule) => {
    if (!allApps.find((a) => a.package_name === rule.package_name)) {
      allApps.push({
        package_name: rule.package_name,
        app_name: rule.app_name,
        minutes: 0,
        category: rule.category,
      });
    }
  });

  const filtered = search.trim()
    ? allApps.filter((a) =>
        a.app_name.toLowerCase().includes(search.toLowerCase()) ||
        a.package_name.toLowerCase().includes(search.toLowerCase())
      )
    : allApps;

  const grouped = {
    limited: filtered.filter((a) => a.category === 'limited'),
    always:  filtered.filter((a) => a.category === 'always'),
    blocked: filtered.filter((a) => a.category === 'blocked'),
  };

  function minsText(mins: number) {
    if (mins < 60) return `${mins} мин`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backBtn}>← Назад</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Приложения</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="Поиск приложений..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={TABS}
        keyExtractor={(tab) => tab}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0FA968" />
        }
        showsVerticalScrollIndicator={false}
        renderItem={({ item: tab }) => {
          const cfg = CATEGORY_CONFIG[tab];
          const apps = grouped[tab];

          return (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionEmoji}>{cfg.emoji}</Text>
                <Text style={s.sectionTitle}>{cfg.label}</Text>
                <View style={[s.countBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.countText, { color: cfg.color }]}>{apps.length}</Text>
                </View>
              </View>

              {apps.length === 0 ? (
                <Text style={s.emptyText}>Нет приложений</Text>
              ) : (
                apps.map((app) => (
                  <View key={app.package_name} style={s.appCard}>
                    <View style={s.appInfo}>
                      <Text style={s.appName} numberOfLines={1}>{app.app_name}</Text>
                      <Text style={s.appPackage} numberOfLines={1}>{app.package_name}</Text>
                      {app.minutes > 0 && (
                        <Text style={s.appUsage}>{minsText(app.minutes)} сегодня</Text>
                      )}
                    </View>
                    <View style={s.categoryBtns}>
                      {TABS.filter((t) => t !== tab).map((targetCat) => {
                        const tcfg = CATEGORY_CONFIG[targetCat];
                        return (
                          <TouchableOpacity
                            key={targetCat}
                            style={[s.catBtn, { backgroundColor: tcfg.bg }]}
                            onPress={() => setAppCategory(app.package_name, app.app_name, targetCat)}
                            activeOpacity={0.7}
                          >
                            <Text style={[s.catBtnText, { color: tcfg.color }]}>{tcfg.emoji}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        }}
        contentContainerStyle={s.listContent}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FBF7' },
  listContent: { paddingBottom: 32 },

  header: {
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { fontSize: 15, color: '#0FA968', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0D1B12' },

  searchWrap: { paddingHorizontal: 20, paddingVertical: 12 },
  searchInput: {
    backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: '#0D1B12', borderWidth: 1, borderColor: '#E5E7EB',
  },

  section: { marginTop: 8, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12,
  },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0D1B12', flex: 1 },
  countBadge: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, minWidth: 28, alignItems: 'center',
  },
  countText: { fontSize: 13, fontWeight: '800' },

  emptyText: { fontSize: 13, color: '#9CA3AF', paddingVertical: 8, paddingLeft: 4 },

  appCard: {
    backgroundColor: 'white', borderRadius: 14, padding: 14,
    marginBottom: 8, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  appInfo: { flex: 1, marginRight: 12 },
  appName: { fontSize: 15, fontWeight: '700', color: '#0D1B12', marginBottom: 2 },
  appPackage: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
  appUsage: { fontSize: 12, color: '#0FA968', fontWeight: '600' },

  categoryBtns: { flexDirection: 'row', gap: 6 },
  catBtn: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  catBtnText: { fontSize: 16 },
});
