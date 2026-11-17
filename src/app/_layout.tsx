import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { Spinner } from '../components/ui';
import { nl } from '../i18n/nl';
import { queryClient } from '../lib/queryClient';
import '../services/backgroundSync';
import { setupNotifications } from '../services/notifications';

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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
