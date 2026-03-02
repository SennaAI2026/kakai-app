import { useState, useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { supabase } from './lib/supabase'
import JoinScreen from './screens/JoinScreen'
import ChildDashboard from './screens/ChildDashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Загрузка...</Text>
      </View>
    )
  }

  if (!session) {
    return <JoinScreen onSuccess={() => {}} />
  }

  return <ChildDashboard user={session.user} />
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E6' },
})