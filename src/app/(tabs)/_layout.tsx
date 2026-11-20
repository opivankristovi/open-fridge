import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import { useRealtimeItems } from '../../data/useRealtimeItems';
import { nl } from '../../i18n/nl';
import { registerBackgroundSync } from '../../services/backgroundSync';
import {
  setCurrentHousehold,
  useNotificationTapRouting,
  useResyncOnActive,
} from '../../services/notifications';
import { colors } from '../../theme';

export default function TabsLayout() {
  const { household } = useAuth();
  const hid = household?.id ?? null;
  // Keep the tab bar above Android's on-screen navigation buttons (edge-to-edge).
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setCurrentHousehold(hid);
    if (hid) void registerBackgroundSync();
  }, [hid]);
  useRealtimeItems(hid);
  useResyncOnActive(hid);
  useNotificationTapRouting();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { height: 58 + insets.bottom, paddingBottom: 6 + insets.bottom, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: nl.tabs.fridge,
          tabBarIcon: ({ color, size }) => <Ionicons name="snow-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: nl.tabs.history,
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: nl.tabs.settings,
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
