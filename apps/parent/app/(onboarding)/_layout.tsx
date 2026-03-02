import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';

export default function OnboardingLayout() {
  return (
    <View style={s.container}>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FBF7' },
});
