import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { Spinner } from '../components/ui';
import { nl } from '../i18n/nl';
import { getPrefs, applyTheme } from '../data/localPrefs';
import { queryClient } from '../lib/queryClient';
import '../services/backgroundSync';
import { setupNotifications } from '../services/notifications';
import { darkColors, useColors } from '../theme';

setupNotifications().catch(() => undefined);

function RootNavigator() {
  const { session, household, loading } = useAuth();

  if (loading) return <Spinner />;

  const signedIn = !!session;
  const hasHousehold = !!household;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasHousehold}>
        <Stack.Screen name="(auth)/household" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasHousehold}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add" options={{ presentation: 'modal', headerShown: true, title: nl.add.title }} />
        <Stack.Screen name="item/[id]" options={{ headerShown: true, title: nl.item.title }} />
        <Stack.Screen name="item/edit/[id]" options={{ headerShown: true, title: nl.edit.title }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const c = useColors();
  const dark = c === darkColors;

  // Apply the per-phone theme choice once the stored prefs are known.
  useEffect(() => {
    getPrefs().then((p) => applyTheme(p.theme)).catch(() => undefined);
  }, []);

  const navTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.primary,
        background: c.background,
        card: c.surface,
        text: c.text,
        border: c.border,
      },
    };
  }, [c, dark]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style="auto" />
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
