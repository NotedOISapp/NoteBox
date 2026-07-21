import { Stack } from 'expo-router';

export default function AppTabs() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="patterns" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="box/[id]" />
      <Stack.Screen name="note/[id]" />
      <Stack.Screen name="note/compose" />
    </Stack>
  );
}
