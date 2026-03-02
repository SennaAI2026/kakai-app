import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native'
import { supabase } from '../lib/supabase'

export default function TasksScreen({ family }) {
  const [tasks, setTasks] = useState([])
  const [children, setChildren] = useState([])
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState('15')
  const [selectedChild, setSelectedChild] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadTasks()
    loadChildren()
  }, [])

  const loadChildren = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('family_id', family.id)
      .eq('role', 'child')
    if (data) {
      setChildren(data)
      if (data.length > 0) setSelectedChild(data[0].id)
    }
  }

  const loadTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*, users(name)')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false })
    if (data) setTasks(data)
  }

  const handleCreate = async () => {
    if (!title) {
      Alert.alert('Введи название задания')
      return
    }
    if (!selectedChild) {
      Alert.alert('Нет детей', 'Сначала ребёнок должен войти через инвайт-код')
      return
    }
    setLoading(true)
    const { error } = await supabase
      .from('tasks')
      .insert({
        family_id: family.id,
        child_id: selectedChild,
        title,
        reward_minutes: parseInt(minutes) || 15,
        status: 'pending'
      })
    if (error) {
      Alert.alert('Ошибка', error.message)
    } else {
      setTitle('')
      setMinutes('15')
      setShowForm(false)
      loadTasks()
    }
    setLoading(false)
  }

  const handleApprove = async (task) => {
    // Одобряем задание и начисляем минуты
    await supabase
      .from('tasks')
      .update({ status: 'approved' })
      .eq('id', task.id)

    // Начисляем минуты ребёнку
    const { data: timeData } = await supabase
      .from('screen_time')
      .select('balance_minutes')
      .eq('child_id', task.child_id)
      .maybeSingle()

    const current = timeData?.balance_minutes || 0
    await supabase
      .from('screen_time')
      .update({ balance_minutes: current + task.reward_minutes })
      .eq('child_id', task.child_id)

    Alert.alert('✅ Одобрено!', `+${task.reward_minutes} минут начислено`)
    loadTasks()
  }

  const handleDelete = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    loadTasks()
  }

  const statusLabel = (status) => {
    if (status === 'pending') return { text: 'Ожидает', color: '#FFD23F' }
    if (status === 'done') return { text: 'Выполнено ✋', color: '#3B82F6' }
    if (status === 'approved') return { text: 'Одобрено ✅', color: '#0FA968' }
    return { text: status, color: '#6B7B6E' }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Задания</Text>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Название задания"
            value={title}
            onChangeText={setTitle}
          />

          {children.length > 0 && (
            <View style={styles.childSelect}>
              <Text style={styles.childLabel}>Для кого:</Text>
              <View style={styles.childBtns}>
                {children.map(child => (
                  <TouchableOpacity
                    key={child.id}
                    style={[styles.childBtn, selectedChild === child.id && styles.childBtnActive]}
                    onPress={() => setSelectedChild(child.id)}
                  >
                    <Text style={[styles.childBtnText, selectedChild === child.id && styles.childBtnTextActive]}>
                      {child.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 12 }]}
              placeholder="Минут награды"
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleCreate} disabled={loading}>
              <Text style={styles.addBtnText}>{loading ? '...' : 'Создать'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm(!showForm)}>
        <Text style={styles.newBtnText}>{showForm ? 'Отмена' : '+ Новое задание'}</Text>
      </TouchableOpacity>

      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const s = statusLabel(item.status)
          return (
            <View style={styles.taskCard}>
              <View style={styles.taskLeft}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskReward}>🕐 {item.reward_minutes} мин • {item.users?.name || 'без ребёнка'}</Text>
              </View>
              <View style={styles.taskRight}>
                <Text style={[styles.taskStatus, { color: s.color }]}>{s.text}</Text>
                {item.status === 'done' && (
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                    <Text style={styles.approveBtnText}>Одобрить</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Text style={styles.deleteBtn}>удалить</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Заданий пока нет. Создай первое!</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F4FBF7', paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '800', color: '#0D1B12', marginBottom: 20 },
  form: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#C8E8D5' },
  input: { backgroundColor: '#F4FBF7', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#C8E8D5' },
  childSelect: { marginBottom: 12 },
  childLabel: { fontSize: 13, color: '#6B7B6E', marginBottom: 8 },
  childBtns: { flexDirection: 'row', gap: 8 },
  childBtn: { borderRadius: 8, padding: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#C8E8D5', backgroundColor: '#F4FBF7' },
  childBtnActive: { backgroundColor: '#0FA968', borderColor: '#0FA968' },
  childBtnText: { fontSize: 14, color: '#6B7B6E' },
  childBtnTextActive: { color: 'white', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  addBtn: { backgroundColor: '#0FA968', borderRadius: 10, padding: 14, paddingHorizontal: 20 },
  addBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  newBtn: { backgroundColor: '#0D1B12', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 24 },
  newBtnText: { color: '#0FA968', fontWeight: '700', fontSize: 15 },
  taskCard: { backgroundColor: 'white', borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#C8E8D5' },
  taskLeft: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#0D1B12', marginBottom: 4 },
  taskReward: { fontSize: 13, color: '#6B7B6E' },
  taskRight: { alignItems: 'flex-end', gap: 6 },
  taskStatus: { fontSize: 13, fontWeight: '600' },
  approveBtn: { backgroundColor: '#0FA968', borderRadius: 8, padding: 6, paddingHorizontal: 12 },
  approveBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  deleteBtn: { fontSize: 12, color: '#FF4D4D' },
  empty: { textAlign: 'center', color: '#6B7B6E', marginTop: 40, fontSize: 15 },
})