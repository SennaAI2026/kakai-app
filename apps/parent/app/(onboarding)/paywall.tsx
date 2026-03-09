import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Plan = 'yearly' | 'monthly';

const FEATURES = [
  { emoji: '⏱', text: 'Контроль экранного времени с лимитами по приложениям' },
  { emoji: '📅', text: 'Расписание блокировок — ночной режим и школьные часы' },
  { emoji: '📍', text: 'GPS-местоположение ребёнка в реальном времени' },
  { emoji: '✅', text: 'Система заданий: ребёнок зарабатывает экранное время' },
  { emoji: '📊', text: 'Подробная статистика и история использования' },
];

const PLANS: Record<Plan, { label: string; price: string; billed: string; perMonth?: string }> = {
  yearly: {
    label: 'Годовой',
    price: '59 880 ₸',
    billed: '4 990 ₸ в месяц',
    perMonth: 'Экономия 40% vs ежемесячно',
  },
  monthly: {
    label: 'Ежемесячный',
    price: '8 490 ₸',
    billed: '8 490 ₸ каждый месяц',
  },
};

export default function PaywallScreen() {
  const router = useRouter();
  const [plan, setPlan]     = useState<Plan>('yearly');
  const [loading, setLoading] = useState(false);

  async function completeOnboarding() {
    await AsyncStorage.setItem('onboarding_complete', 'true');
  }

  function handleSubscribe() {
    if (loading) return;
    setLoading(true);
    // Phase 2: integrate RevenueCat / Google Play / App Store
    setTimeout(async () => {
      await completeOnboarding();
      setLoading(false);
      router.replace('/(auth)/register');
    }, 600);
  }

  function handleFree() {
    completeOnboarding().then(() => {
      router.replace('/(auth)/register');
    });
  }

  function handleRestore() {
    Alert.alert('Восстановление покупки', 'Phase 2 — App Store / Google Play');
  }

  const selected = PLANS[plan];

  return (
    <ScrollView
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* Trial badge */}
      <View style={s.trialBadge}>
        <Text style={s.trialBadgeText}>🎁 7 дней бесплатно</Text>
      </View>

      <Text style={s.title}>Полный контроль{'\n'}за телефоном ребёнка</Text>
      <Text style={s.subtitle}>Попробуйте все функции бесплатно. Отмените в любой момент.</Text>

      {/* Feature list */}
      <View style={s.features}>
        {FEATURES.map(({ emoji, text }) => (
          <View key={text} style={s.featureRow}>
            <View style={s.featureIconWrap}>
              <Text style={s.featureEmoji}>{emoji}</Text>
            </View>
            <Text style={s.featureText}>{text}</Text>
          </View>
        ))}
      </View>

      {/* Plan cards */}
      <View style={s.plans}>
        {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(([key, data]) => (
          <TouchableOpacity
            key={key}
            style={[s.planCard, plan === key && s.planCardSelected]}
            onPress={() => setPlan(key)}
            activeOpacity={0.85}
          >
            {/* Popular badge */}
            {key === 'yearly' && (
              <View style={s.popularBadge}>
                <Text style={s.popularBadgeText}>Популярный</Text>
              </View>
            )}

            <View style={s.planHeader}>
              <View style={s.planInfo}>
                <Text style={[s.planLabel, plan === key && s.planLabelSelected]}>{data.label}</Text>
                {data.perMonth && (
                  <Text style={s.planSave}>{data.perMonth}</Text>
                )}
              </View>
              <View style={[s.radio, plan === key && s.radioSelected]}>
                {plan === key && <View style={s.radioDot} />}
              </View>
            </View>

            <Text style={[s.planPrice, plan === key && s.planPriceSelected]}>{data.price}</Text>
            <Text style={s.planBilled}>{data.billed}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Guarantee */}
      <View style={s.guarantee}>
        <Text style={s.guaranteeText}>🛡️ 7 дней пробного периода · Без списаний сразу · Отмена в 1 клик</Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[s.cta, loading && s.ctaDisabled]}
        onPress={handleSubscribe}
        activeOpacity={0.88}
        disabled={loading}
      >
        <Text style={s.ctaTitle}>{loading ? 'Подождите...' : 'Начать бесплатно →'}</Text>
        <Text style={s.ctaSub}>Затем {selected.billed}</Text>
      </TouchableOpacity>

      {/* Free option */}
      <TouchableOpacity style={s.freeBtn} onPress={handleFree} activeOpacity={0.7}>
        <Text style={s.freeBtnText}>Продолжить без подписки</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} activeOpacity={0.7}>
        <Text style={s.restoreBtnText}>Восстановить покупку</Text>
      </TouchableOpacity>

      {/* Legal */}
      <Text style={s.legal}>
        Подписка оформляется через App Store / Google Play. Автоматически продлевается если не отменена за 24 часа до конца периода.
      </Text>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60, backgroundColor: '#F4FBF7' },

  trialBadge: {
    alignSelf: 'center', backgroundColor: '#FEF3C7',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
    marginBottom: 18, borderWidth: 1, borderColor: '#FDE68A',
  },
  trialBadgeText: { fontSize: 13, fontWeight: '700', color: '#92400E' },

  title: {
    fontSize: 26, fontWeight: '900', color: '#0D1B12',
    textAlign: 'center', lineHeight: 34, marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, color: '#6B7B6E',
    textAlign: 'center', lineHeight: 20, marginBottom: 28,
  },

  // Features
  features: { gap: 12, marginBottom: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#E6F9F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  featureEmoji: { fontSize: 18 },
  featureText: { flex: 1, fontSize: 14, color: '#0D1B12', fontWeight: '500', lineHeight: 20 },

  // Plans
  plans: { gap: 12, marginBottom: 20 },
  planCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 18,
    borderWidth: 2, borderColor: '#E5E7EB', position: 'relative', overflow: 'hidden',
  },
  planCardSelected: { borderColor: '#0FA968', backgroundColor: '#F0FDF4' },
  popularBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#0FA968',
    paddingHorizontal: 12, paddingVertical: 5,
    borderBottomLeftRadius: 10,
  },
  popularBadgeText: { fontSize: 11, fontWeight: '800', color: 'white' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  planInfo: { flex: 1 },
  planLabel: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 2 },
  planLabelSelected: { color: '#065F46' },
  planSave: { fontSize: 11, color: '#0FA968', fontWeight: '600' },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2, flexShrink: 0,
  },
  radioSelected: { borderColor: '#0FA968' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0FA968' },
  planPrice: { fontSize: 24, fontWeight: '900', color: '#374151', marginBottom: 2 },
  planPriceSelected: { color: '#0D1B12' },
  planBilled: { fontSize: 13, color: '#6B7B6E' },

  // Guarantee
  guarantee: {
    backgroundColor: '#E6F9F0', borderRadius: 14,
    padding: 14, marginBottom: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  guaranteeText: { fontSize: 13, color: '#065F46', fontWeight: '600', textAlign: 'center', lineHeight: 18 },

  // CTA
  cta: {
    backgroundColor: '#0FA968', borderRadius: 18,
    padding: 20, alignItems: 'center', marginBottom: 16,
    shadowColor: '#0FA968', shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaTitle: { color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  ctaSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

  // Secondary actions
  freeBtn: { alignItems: 'center', paddingVertical: 14 },
  freeBtnText: { fontSize: 14, color: '#6B7B6E', fontWeight: '600' },
  restoreBtn: { alignItems: 'center', paddingVertical: 8 },
  restoreBtnText: { fontSize: 13, color: '#9CA3AF' },

  legal: {
    fontSize: 11, color: '#9CA3AF', textAlign: 'center',
    lineHeight: 16, marginTop: 12, paddingHorizontal: 8,
  },
});
