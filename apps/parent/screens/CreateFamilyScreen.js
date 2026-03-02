import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { supabase } from '../lib/supabase'

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function CreateFamilyScreen({ onSuccess }) {
  const [familyName, setFamilyName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!familyName) {
      Alert.alert('Введи название семьи')
      return
    }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const inviteCode = generateInviteCode()

    // Создаём семью
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: familyName, invite_code: inviteCode })
      .select()
      .single()

    if (familyError) {
      Alert.alert('Ошибка', familyError.message)
      setLoading(false)
      return
    }

    // Создаём профиль родителя
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        family_id: family.id,
        role: 'parent',
        name: familyName + ' (родитель)',
        phone: user.email.replace('@kakai.kz', '')
      })

    if (userError) {
      Alert.alert('Ошибка', userError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess(family)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Создай семью</Text>
      <Text style={styles.subtitle}>Придумай название — например "Семья Ивановых"</Text>

      <TextInput
        style={styles.input}
        placeholder="Название семьи"
        value={familyName}
        onChangeText={setFamilyName}
      />

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Создаём...' : 'Создать семью'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F4FBF7' },
  title: { fontSize: 28, fontWeight: '800', color: '#0D1B12', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7B6E', textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#C8E8D5' },
  button: { backgroundColor: '#0FA968', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
})