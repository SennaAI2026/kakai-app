import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';

export default function SetupLayout() {
  return (
    <View style={s.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="usage-stats" />
        <Stack.Screen name="accessibility" />
        <Stack.Screen name="overlay" />
        <Stack.Screen name="device-admin" />
        <Stack.Screen name="battery" />
        <Stack.Screen name="gps" />
        <Stack.Screen name="pin" />
        <Stack.Screen name="schedule" />
        <Stack.Screen name="test-block" options={{ animation: 'fade' }} />
      </Stack>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E6' },
});
