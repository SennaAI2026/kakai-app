import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Share, Alert, Switch,
} from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';
import { t, setLocale } from '@kakai/i18n';
import type { User } from '@kakai/shared';

type Lang = 'ru' | 'kz' | 'en';

interface FamilyRow {
  id: string;
  name: string;
  invite_code: string;
}

interface SubRow {
  plan: string;
  expires_at: string | null;
  auto_renew: boolean;
}

const AVATARS = ['🦒', '🐻', '🐼', '🐨'];

function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLabel}>{text}</Text>;
}

function SettingsRow({
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
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !right}
    >
      <Text style={s.rowEmoji}>{emoji}</Text>
      <Text style={[s.rowLabel, danger && s.rowLabelDanger]}>{label}</Text>
      <View style={s.rowRight}>
        {right ?? (
          <>
            {value ? <Text style={s.rowValue}>{value}</Text> : null}
            {onPress && <Text style={s.rowChevron}>›</Text>}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [lang, setLang] = useState<Lang>('ru');

  const loadData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (userData) {
      setUser(userData as User);
      setLang((userData.lang as Lang) ?? 'ru');
    }

    if (!userData?.family_id) return;

    const [{ data: familyData }, { data: subData }] = await Promise.all([
      supabase
        .from('families')
        .select('id, name, invite_code')
        .eq('id', userData.family_id)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('plan, expires_at, auto_renew')
        .eq('family_id', userData.family_id)
        .maybeSingle(),
    ]);

    if (familyData) setFamily(familyData as FamilyRow);
    if (subData) setSub(subData as SubRow);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleLangToggle(value: Lang) {
    setLang(value);
    setLocale(value);
    if (user) {
      await supabase.from('users').update({ lang: value }).eq('id', user.id);
    }
  }

  async function shareInviteCode() {
    if (!family) return;
    await Share.share({
      message: `Код приглашения Kakai: ${family.invite_code}\nСкачай приложение Kakai — Бала и введи этот код.`,
      title: 'Код приглашения Kakai',
    });
  }

  function handleSignOut() {
    Alert.alert(
      t('settings.signOut'),
      'Вы уверены что хотите выйти?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.signOut'), style: 'destructive', onPress: () => supabase.auth.signOut() },
      ]
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteAccountConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            // Phase 2: call Edge Function to delete account
            await supabase.auth.signOut();
          },
        },
      ]
    );
  }

  function handleSupport() {
    Alert.alert('Поддержка', 'support@kakai.kz', [{ text: 'OK' }]);
  }

  function handleAbout() {
    const version = Constants.expoConfig?.version ?? '2.0.0';
    Alert.alert(
      'Kakai — Ата-ана',
      `${t('settings.version', { version })}\n\nKakai.kz — родительский контроль для Казахстана`,
      [{ text: 'OK' }]
    );
  }

  function subStatusText(): string {
    if (!sub) return 'Free';
    if (sub.expires_at) {
      const expiry = new Date(sub.expires_at);
      const isActive = expiry > new Date();
      if (isActive) {
        const date = expiry.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
        return t('settings.subscriptionActive', { date });
      }
    }
    if (sub.plan === 'free') return 'Free';
    return sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1);
  }

  const avatarEmoji = AVATARS[user?.avatar_index ?? 0];
  const isPremium = sub ? sub.plan !== 'free' && (!sub.expires_at || new Date(sub.expires_at) > new Date()) : false;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('settings.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.profileAvatar}>
            <Text style={s.profileAvatarEmoji}>{avatarEmoji}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user?.name ?? '—'}</Text>
            <Text style={s.profileFamily}>{family?.name ?? ''}</Text>
          </View>
          {isPremium && (
            <View style={s.premiumBadge}>
              <Text style={s.premiumBadgeText}>⭐ Premium</Text>
            </View>
          )}
        </View>

        {/* Family section */}
        <SectionLabel text={t('settings.family')} />
        <View style={s.card}>
          <SettingsRow
            emoji="👨‍👩‍👧"
            label={t('settings.familyName')}
            value={family?.name}
          />
          <View style={s.divider} />
          <SettingsRow
            emoji="🔑"
            label={t('settings.inviteCode')}
            onPress={shareInviteCode}
            right={
              <View style={s.codeRight}>
                <Text style={s.codeText}>{family?.invite_code ?? '——'}</Text>
                <TouchableOpacity style={s.shareBtn} onPress={shareInviteCode} activeOpacity={0.8}>
                  <Text style={s.shareBtnText}>Поделиться</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>

        {/* App settings section */}
        <SectionLabel text="Приложение" />
        <View style={s.card}>
          <SettingsRow
            emoji="🌐"
            label={t('settings.language')}
            right={
              <View style={s.langRow}>
                <TouchableOpacity
                  style={[s.langBtn, lang === 'ru' && s.langBtnActive]}
                  onPress={() => handleLangToggle('ru')}
                  activeOpacity={0.8}
                >
                  <Text style={[s.langBtnText, lang === 'ru' && s.langBtnTextActive]}>
                    {t('settings.ru')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.langBtn, lang === 'kz' && s.langBtnActive]}
                  onPress={() => handleLangToggle('kz')}
                  activeOpacity={0.8}
                >
                  <Text style={[s.langBtnText, lang === 'kz' && s.langBtnTextActive]}>
                    {t('settings.kz')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.langBtn, lang === 'en' && s.langBtnActive]}
                  onPress={() => handleLangToggle('en')}
                  activeOpacity={0.8}
                >
                  <Text style={[s.langBtnText, lang === 'en' && s.langBtnTextActive]}>
                    EN
                  </Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>

        {/* Subscription section */}
        <SectionLabel text={t('settings.subscription')} />
        <View style={s.card}>
          <SettingsRow
            emoji={isPremium ? '⭐' : '🔓'}
            label={isPremium ? 'Premium' : 'Free'}
            value={subStatusText()}
          />
          {!isPremium && (
            <>
              <View style={s.divider} />
              <SettingsRow
                emoji="🚀"
                label="Перейти на Premium"
                onPress={() => router.push('/(onboarding)/paywall')}
              />
            </>
          )}
          {isPremium && (
            <>
              <View style={s.divider} />
              <SettingsRow
                emoji="⚙️"
                label={t('settings.manage')}
                onPress={() => Alert.alert('Управление подпиской', 'Phase 2 — App Store / Google Play')}
              />
            </>
          )}
        </View>

        {/* Support section */}
        <SectionLabel text={t('settings.support')} />
        <View style={s.card}>
          <SettingsRow
            emoji="💬"
            label={t('settings.support')}
            onPress={handleSupport}
          />
          <View style={s.divider} />
          <SettingsRow
            emoji="ℹ️"
            label={t('settings.about')}
            onPress={handleAbout}
          />
        </View>

        {/* Danger zone */}
        <View style={s.dangerCard}>
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
            <Text style={s.signOutText}>🚪 {t('settings.signOut')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
          <Text style={s.deleteBtnText}>{t('settings.deleteAccount')}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FBF7' },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#0D1B12' },

  // Profile
  profileCard: {
    backgroundColor: 'white', borderRadius: 20,
    marginHorizontal: 24, marginBottom: 24,
    padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: '#C8E8D5',
  },
  profileAvatar: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: '#E6F9F0',
    justifyContent: 'center', alignItems: 'center',
  },
  profileAvatarEmoji: { fontSize: 32 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '800', color: '#0D1B12', marginBottom: 2 },
  profileFamily: { fontSize: 13, color: '#6B7B6E' },
  premiumBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  premiumBadgeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },

  // Sections
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#6B7B6E',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginHorizontal: 24, marginBottom: 8, marginTop: 4,
  },
  card: {
    backgroundColor: 'white', borderRadius: 16,
    marginHorizontal: 24, marginBottom: 20,
    borderWidth: 1, borderColor: '#C8E8D5', overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginLeft: 52 },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    minHeight: 52,
  },
  rowEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: 15, color: '#0D1B12', fontWeight: '500' },
  rowLabelDanger: { color: '#EF4444' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, color: '#6B7B6E', maxWidth: 160 },
  rowChevron: { fontSize: 20, color: '#C8E8D5', fontWeight: '300' },

  // Invite code
  codeRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeText: { fontSize: 16, fontWeight: '800', color: '#0FA968', letterSpacing: 2 },
  shareBtn: {
    backgroundColor: '#E6F9F0', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  shareBtnText: { fontSize: 12, color: '#065F46', fontWeight: '700' },

  // Language
  langRow: { flexDirection: 'row', gap: 6 },
  langBtn: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#F4FBF7', borderWidth: 1, borderColor: '#C8E8D5',
  },
  langBtnActive: { backgroundColor: '#0FA968', borderColor: '#0FA968' },
  langBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7B6E' },
  langBtnTextActive: { color: 'white' },

  // Danger
  dangerCard: { marginHorizontal: 24, marginBottom: 12 },
  signOutBtn: {
    backgroundColor: '#FEF2F2', borderRadius: 16,
    padding: 18, alignItems: 'center',
    borderWidth: 1, borderColor: '#FED7D7',
  },
  signOutText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
  deleteBtn: { alignItems: 'center', paddingVertical: 8 },
  deleteBtnText: { fontSize: 13, color: '#9CA3AF' },
});
