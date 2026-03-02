import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native'
import { supabase } from '../lib/supabase'

export default function ChildDashboard({ user }) {
  const [tasks, setTasks] = useState([])
  const [balance, setBalance] = useState(0)
  const [childName, setChildName] = useState('')

  useEffect(() => {
    loadData()

    // Realtime — обновляем когда родитель одобряет задание
    const sub = supabase
      .channel('tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadData)
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [])

  const loadData = async () => {
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()
    if (userData) setChildName(userData.name)

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('child_id', user.id)
      .order('created_at', { ascending: false })
    if (tasksData) setTasks(tasksData)

    const { data: timeData } = await supabase
      .from('screen_time')
      .select('balance_minutes')
      .eq('child_id', user.id)
      .maybeSingle()
    if (timeData) setBalance(timeData.balance_minutes)
  }

  const handleDone = async (taskId) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', taskId)
    if (error) {
      Alert.alert('Ошибка', error.message)
    } else {
      Alert.alert('Отлично! 🎉', 'Родитель проверит и начислит время')
      loadData()
    }
  }

  const statusLabel = (status) => {
    if (status === 'pending') return { text: 'Выполнить', color: '#0FA968', canDo: true }
    if (status === 'done') return { text: 'Ждём проверки ⏳', color: '#FFD23F', canDo: false }
    if (status === 'approved') return { text: 'Одобрено ✅', color: '#0FA968', canDo: false }
    return { text: status, color: '#6B7B6E', canDo: false }
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Привет, {childName || 'друг'}! 👋</Text>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Моё время</Text>
          <Text style={styles.balanceVal}>{balance} мин</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Мои задания</Text>

      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const s = statusLabel(item.status)
          return (
            <View style={styles.taskCard}>
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskReward}>🕐 +{item.reward_minutes} мин</Text>
              </View>
              {s.canDo ? (
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => handleDone(item.id)}
                >
                  <Text style={styles.doneBtnText}>Выполнил!</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.statusText, { color: s.color }]}>{s.text}</Text>
              )}
            </View>
          )
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Заданий пока нет 🎮{'\n'}Скоро родитель добавит!</Text>
        }
      />

      <TouchableOpacity style={styles.exitBtn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.exitBtnText}>Выйти</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E6', padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  greeting: { fontSize: 20, fontWeight: '800', color: '#0D1B12' },
  balanceBox: { backgroundColor: '#0D1B12', borderRadius: 14, padding: 14, alignItems: 'center' },
  balanceLabel: { color: '#8BA897', fontSize: 11, marginBottom: 2 },
  balanceVal: { color: '#0FA968', fontSize: 20, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0D1B12', marginBottom: 16 },
  taskCard: { backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#FFD23F' },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#0D1B12', marginBottom: 4 },
  taskReward: { fontSize: 13, color: '#6B7B6E' },
  doneBtn: { backgroundColor: '#0FA968', borderRadius: 10, padding: 10, paddingHorizontal: 16 },
  doneBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  statusText: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#6B7B6E', marginTop: 60, fontSize: 16, lineHeight: 28 },
  exitBtn: { marginTop: 20, padding: 14, alignItems: 'center' },
  exitBtnText: { color: '#FF4D4D', fontSize: 14, fontWeight: '600' },
})