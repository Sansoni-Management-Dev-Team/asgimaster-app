import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/lib/providers';
import { theme } from '@/theme';
import { SessionRouteBoundary } from '@/features/session/session-provider';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack
        screenLayout={({ children, route }) => (
          <SessionRouteBoundary routeName={route.name}>{children}</SessionRouteBoundary>
        )}
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: theme.colors.backgroundEnd },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Invitation — Master App' }} />
        <Stack.Screen name="auth-callback" options={{ title: 'Member access — Master App' }} />
        <Stack.Screen name="sign-in" options={{ title: 'Sign in — Master App' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Your onboarding — Master App' }} />
        <Stack.Screen name="home" options={{ title: 'Today — Master App' }} />
        <Stack.Screen
          name="offboarding"
          options={{ title: 'Your membership options — Master App' }}
        />
      </Stack>
      <StatusBar style="light" />
    </AppProviders>
  );
}
