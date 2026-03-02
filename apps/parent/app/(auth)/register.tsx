import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';
import { INVITE_CODE_LENGTH } from '@kakai/shared';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: INVITE_CODE_LENGTH }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

export default function RegisterScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!phone || !password || !familyName) {
      Alert.alert(t('common.error'), t('auth.errors.emailRequired'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('auth.errors.passwordShort'));
      return;
    }
    setLoading(true);

    const email = phone.replace(/\D/g, '') + '@kakai.kz';
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError || !authData.user) {
      Alert.alert(t('common.error'), authError?.message ?? t('auth.errors.unknown'));
      setLoading(false);
      return;
    }

    // Create family
    const inviteCode = generateInviteCode();
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: familyName.trim(), invite_code: inviteCode, owner_id: authData.user.id, status: 'active' })
      .select('id')
      .single();

    if (familyError || !family) {
      Alert.alert(t('common.error'), familyError?.message ?? t('auth.errors.unknown'));
      setLoading(false);
      return;
    }

    // Create parent user record
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      family_id: family.id,
      role: 'parent',
      name: familyName.trim(),
      lang: 'ru',
    });

    if (userError) {
      Alert.alert(t('common.error'), userError.message);
      setLoading(false);
      return;
    }

    router.replace('/(onboarding)/');
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('common.appName')}</Text>
        <Text style={styles.subtitle}>{t('auth.signUp')}</Text>

        <TextInput
          style={styles.input}
          placeholder="7 XXX XXX XX XX"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />
        <TextInput
          style={styles.input}
          placeholder={t('setup.step4.familyNamePlaceholder')}
          value={familyName}
          onChangeText={setFamilyName}
          maxLength={40}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? t('common.loading') : t('auth.signUp')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.linkText}>{t('auth.alreadyHaveAccount')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F4FBF7' },
  title: { fontSize: 36, fontWeight: '800', color: '#0FA968', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7B6E', textAlign: 'center', marginBottom: 40 },
  input: {
    backgroundColor: 'white', borderRadius: 12, padding: 16,
    fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#C8E8D5',
  },
  button: { backgroundColor: '#0FA968', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#0FA968', fontSize: 14 },
});
