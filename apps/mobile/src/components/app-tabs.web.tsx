import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

const hiddenRoute = { href: null, headerShown: false } as const;

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#9D5D67',
        tabBarInactiveTintColor: '#6F6763',
        tabBarLabelStyle: { fontFamily: 'Outfit-Medium', fontSize: 12 },
        tabBarStyle: {
          minHeight: 72,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: '#FBF8F5',
          borderTopColor: 'rgba(157, 93, 103, 0.18)',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Categories',
          tabBarAccessibilityLabel: 'Categories',
          tabBarIcon: ({ color }) => (
            <SymbolView name={'square.grid.2x2' as any} size={24} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="note/compose"
        options={{
          title: 'Add Note',
          tabBarAccessibilityLabel: 'Add Note',
          tabBarIcon: ({ color }) => (
            <SymbolView name={'plus.circle.fill' as any} size={32} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <SymbolView name={'person.crop.circle' as any} size={25} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen name="patterns" options={hiddenRoute} />
      <Tabs.Screen name="settings" options={hiddenRoute} />
      <Tabs.Screen name="box/[id]" options={hiddenRoute} />
      <Tabs.Screen name="note/[id]" options={hiddenRoute} />
      <Tabs.Screen name="age-gate" options={hiddenRoute} />
      <Tabs.Screen name="onboarding" options={hiddenRoute} />
    </Tabs>
  );
}
