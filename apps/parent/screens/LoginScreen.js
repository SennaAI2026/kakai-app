import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'

export default function LoginScreen({ onSwitch }) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Заполни все поля')
      return
    }
    setLoading(true)
    const email = phone.replace(/\D/g, '') + '@kakai.kz'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      Alert.alert('Ошибка', error.message)
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kakai</Text>
      <Text style={styles.subtitle}>Вход для родителя</Text>

      <TextInput
        style={styles.input}
        placeholder="Номер телефона"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Загрузка...' : 'Войти'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitch} style={styles.link}>
        <Text style={styles.linkText}>Нет аккаунта? Зарегистрироваться</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F4FBF7' },
  title: { fontSize: 36, fontWeight: '800', color: '#0FA968', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7B6E', textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#C8E8D5' },
  button: { backgroundColor: '#0FA968', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#0FA968', fontSize: 14 },
})