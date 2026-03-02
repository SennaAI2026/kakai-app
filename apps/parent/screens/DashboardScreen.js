import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '../lib/supabase'
import TasksScreen from './TasksScreen'

export default function DashboardScreen({ family }) {
  const [tab, setTab] = useState('home')

  return (
    <View style={styles.container}>
      {/* КОНТЕНТ */}
      {tab === 'home' && (
        <View style={styles.home}>
          <Text style={styles.title}>Kakai</Text>
          <Text style={styles.familyName}>👨‍👩‍👧 {family.name}</Text>

          <View style={styles.inviteBox}>
            <Text style={styles.inviteLabel}>Инвайт-код для ребёнка</Text>
            <Text style={styles.inviteCode}>{family.invite_code}</Text>
            <Text style={styles.inviteHint}>Дай этот код ребёнку чтобы подключиться</Text>
          </View>

          <TouchableOpacity style={styles.exitBtn} onPress={() => supabase.auth.signOut()}>
            <Text style={styles.exitBtnText}>Выйти</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'tasks' && <TasksScreen family={family} />}

      {/* BOTTOM TAB BAR */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={() => setTab('home')}>
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={[styles.tabLabel, tab === 'home' && styles.tabActive]}>Главная</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setTab('tasks')}>
          <Text style={styles.tabIcon}>📋</Text>
          <Text style={[styles.tabLabel, tab === 'tasks' && styles.tabActive]}>Задания</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FBF7' },
  home: { flex: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: '800', color: '#0FA968', marginBottom: 4 },
  familyName: { fontSize: 18, color: '#0D1B12', fontWeight: '600', marginBottom: 40 },
  inviteBox: { backgroundColor: '#0D1B12', borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 32 },
  inviteLabel: { color: '#8BA897', fontSize: 13, marginBottom: 12 },
  inviteCode: { color: '#0FA968', fontSize: 42, fontWeight: '800', letterSpacing: 6, marginBottom: 12 },
  inviteHint: { color: '#8BA897', fontSize: 13, textAlign: 'center' },
  exitBtn: { backgroundColor: '#FF4D4D', borderRadius: 12, padding: 14, alignItems: 'center' },
  exitBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  tabBar: { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#C8E8D5', paddingBottom: 16, paddingTop: 12 },
  tab: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 12, color: '#6B7B6E', marginTop: 2 },
  tabActive: { color: '#0FA968', fontWeight: '700' },
})