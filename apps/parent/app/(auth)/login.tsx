import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.errors.emailRequired'));
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      Alert.alert(t('common.error'), t('auth.errors.invalidCredentials'));
    } else {
      router.replace('/(main)/dashboard');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>{t('common.appName')}</Text>
      <Text style={styles.subtitle}>{t('auth.signIn')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.passwordPlaceholder')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>
          {loading ? t('common.loading') : t('auth.signIn')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.link}
        onPress={() => router.push('/(auth)/register')}
      >
        <Text style={styles.linkText}>{t('auth.noAccount')}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F4FBF7' },
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
