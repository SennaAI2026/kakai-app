import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import RegisterScreen from './screens/RegisterScreen'
import LoginScreen from './screens/LoginScreen'
import CreateFamilyScreen from './screens/CreateFamilyScreen'
import DashboardScreen from './screens/DashboardScreen'
import { View, Text, StyleSheet } from 'react-native'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [family, setFamily] = useState(null)
  const [isLogin, setIsLogin] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadFamily(session.user.id)
      setLoading(false)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadFamily(session.user.id)
      else setFamily(null)
    })
  }, [])

  const loadFamily = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('family_id, families(*)')
      .eq('id', userId)
      .maybeSingle()

    if (data?.families) setFamily(data.families)
  }

  if (loading) {
    return <View style={styles.center}><Text>Загрузка...</Text></View>
  }

  if (!session) {
    return isLogin
      ? <LoginScreen onSwitch={() => setIsLogin(false)} />
      : <RegisterScreen onSuccess={() => setIsLogin(true)} onSwitch={() => setIsLogin(true)} />
  }

  if (!family) {
    return <CreateFamilyScreen onSuccess={(f) => setFamily(f)} />
  }

  return <DashboardScreen family={family} />
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4FBF7' },
})