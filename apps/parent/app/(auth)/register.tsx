import { useState } from 'react';
import {
  Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';
import { INVITE_CODE_LENGTH } from '@kakai/shared';

function generateInviteCode(): string {
  return Array.from({ length: INVITE_CODE_LENGTH }, () =>
    Math.floor(Math.random() * 10)
  ).join('');
}

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !familyName) {
      Alert.alert(t('common.error'), t('auth.errors.nameRequired'));
      return;
    }
    setLoading(true);

    // 1. Anonymous Auth — no email/password required
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

    if (authError || !authData.user) {
      Alert.alert(t('common.error'), authError?.message ?? t('auth.errors.unknown'));
      setLoading(false);
      return;
    }

    // 2. Create user record (families.parent_id is FK → users.id)
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      role: 'parent',
      name: name.trim(),
      lang: 'ru',
    });

    if (userError) {
      Alert.alert(t('common.error'), userError.message);
      setLoading(false);
      return;
    }

    // 3. Create family with invite code
    const inviteCode = generateInviteCode();

    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: familyName.trim(), invite_code: inviteCode, parent_id: authData.user.id, status: 'active' })
      .select('id')
      .single();

    if (familyError || !family) {
      Alert.alert(t('common.error'), familyError?.message ?? t('auth.errors.unknown'));
      setLoading(false);
      return;
    }

    // 4. Link user to family
    const { error: linkError } = await supabase
      .from('users')
      .update({ family_id: family.id })
      .eq('id', authData.user.id);

    if (linkError) {
      Alert.alert(t('common.error'), linkError.message);
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
          placeholder={t('common.name')}
          value={name}
          onChangeText={setName}
          maxLength={30}
          autoComplete="name"
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
