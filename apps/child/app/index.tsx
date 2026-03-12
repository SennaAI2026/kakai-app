import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@kakai/api';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function bootstrap() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/(auth)/join');
        return;
      }

      const { data: user } = await supabase
        .from('users')
        .select('name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!user?.name) {
        router.replace('/(setup)/');
      } else {
        router.replace('/(main)/home');
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E6' },
});
