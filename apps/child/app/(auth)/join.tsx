import { useState } from 'react';
import {
  Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';

export default function JoinScreen() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    const code = inviteCode.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert(t('common.error'), t('auth.inviteCodeInvalid'));
      return;
    }
    setLoading(true);

    // 1. Validate invite code
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id, name')
      .eq('invite_code', code)
      .maybeSingle();

    if (familyError || !family) {
      Alert.alert(t('common.error'), t('auth.inviteCodeInvalid'));
      setLoading(false);
      return;
    }

    // 2. Anonymous Auth — no email/password
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

    if (authError || !authData.user) {
      Alert.alert(t('common.error'), authError?.message ?? t('auth.errors.unknown'));
      setLoading(false);
      return;
    }

    // 3. Create child user record linked to family
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      family_id: family.id,
      role: 'child',
      name: '',
      lang: 'ru',
    });

    if (userError) {
      Alert.alert(t('common.error'), userError.message);
      setLoading(false);
      return;
    }

    // 4. Initialize screen_time for child
    await supabase.from('screen_time').insert({
      child_id: authData.user.id,
      balance_minutes: 0,
    });

    router.replace('/(setup)/');
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.emoji}>👧</Text>
      <Text style={styles.title}>{t('common.appName')}</Text>
      <Text style={styles.subtitle}>{t('auth.inviteCode')}</Text>
      <Text style={styles.hint}>{t('auth.inviteCodeHint')}</Text>

      <TextInput
        style={styles.codeInput}
        placeholder={t('auth.inviteCodePlaceholder')}
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="characters"
        maxLength={6}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleJoin}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>
          {loading ? t('common.loading') : t('auth.joinFamily')}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFF8E6' },
  emoji: { fontSize: 64, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 36, fontWeight: '800', color: '#0FA968', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7B6E', textAlign: 'center', marginBottom: 8 },
  hint: { fontSize: 13, color: '#9BA8A0', textAlign: 'center', marginBottom: 32 },
  codeInput: {
    backgroundColor: 'white', borderRadius: 12, padding: 18,
    fontSize: 24, fontWeight: '800', marginBottom: 16,
    borderWidth: 2, borderColor: '#FFD23F', textAlign: 'center', letterSpacing: 6,
  },
  button: { backgroundColor: '#0FA968', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
