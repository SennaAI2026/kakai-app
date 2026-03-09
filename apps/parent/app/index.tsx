import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@kakai/api';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function bootstrap() {
      // 1. Check onboarding
      const onboardingDone = await AsyncStorage.getItem('onboarding_complete');
      if (onboardingDone !== 'true') {
        router.replace('/(onboarding)');
        return;
      }

      // 2. Check auth session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/(auth)/register');
        return;
      }

      // 3. Check family
      const { data: user } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!user?.family_id) {
        router.replace('/(auth)/register');
      } else {
        router.replace('/(main)/dashboard');
      }
    }

    bootstrap();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0FA968" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4FBF7' },
});
