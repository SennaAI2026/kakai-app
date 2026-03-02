import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'

export default function JoinScreen({ onSuccess }) {
  const [isLogin, setIsLogin] = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!inviteCode || !password) {
      Alert.alert('Заполни все поля')
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('id, family_id')
      .eq('role', 'child')
      .maybeSingle()

    // Ищем по инвайт коду семью
    const { data: family } = await supabase
      .from('families')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .maybeSingle()

    if (!family) {
      Alert.alert('Ошибка', 'Неверный инвайт-код')
      setLoading(false)
      return
    }

    // Входим через email который генерировался при регистрации
    // Пробуем все возможные форматы
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: inviteCode.toLowerCase() + '@kakai.kz',
      password
    })

    if (loginError) {
      // Пробуем найти пользователя по family_id
      Alert.alert('Ошибка входа', 'Неверный код или пароль')
    }
    setLoading(false)
  }

  const handleJoin = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!inviteCode || !name || !password) {
      Alert.alert('Заполни все поля')
      return
    }
    setLoading(true)

    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .maybeSingle()

    if (familyError) {
      Alert.alert('Ошибка семьи', familyError.message)
      setLoading(false)
      return
    }

    if (!family) {
      Alert.alert('Ошибка', 'Семья не найдена. Код: ' + inviteCode.toUpperCase())
      setLoading(false)
      return
    }

    const email = inviteCode.toLowerCase() + Math.random().toString(36).substring(2, 7) + '@kakai.kz'
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      Alert.alert('Ошибка регистрации', authError.message)
      setLoading(false)
      return
    }

    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        family_id: family.id,
        role: 'child',
        name: name,
      })

    if (userError) {
      Alert.alert('Ошибка профиля', userError.message)
      setLoading(false)
      return
    }

    await supabase
      .from('screen_time')
      .insert({ child_id: authData.user.id, balance_minutes: 0 })

    setLoading(false)
    onSuccess(family)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👧</Text>
      <Text style={styles.title}>Kakai</Text>
      <Text style={styles.subtitle}>{isLogin ? 'Вход для ребёнка' : 'Введи код от родителя'}</Text>

      <TextInput
        style={styles.codeInput}
        placeholder="ИНВАЙТ-КОД"
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="characters"
        maxLength={6}
      />

      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="Твоё имя"
          value={name}
          onChangeText={setName}
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={isLogin ? handleLogin : handleJoin}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Загрузка...' : isLogin ? 'Войти 🚀' : 'Войти в семью 🚀'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.link}>
        <Text style={styles.linkText}>
          {isLogin ? 'Первый раз? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFF8E6' },
  emoji: { fontSize: 60, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 36, fontWeight: '800', color: '#0FA968', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7B6E', textAlign: 'center', marginBottom: 32 },
  codeInput: { backgroundColor: 'white', borderRadius: 12, padding: 18, fontSize: 24, fontWeight: '800', marginBottom: 16, borderWidth: 2, borderColor: '#FFD23F', textAlign: 'center', letterSpacing: 6 },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#C8E8D5' },
  button: { backgroundColor: '#0FA968', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#0FA968', fontSize: 14 },
})