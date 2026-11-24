import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, hasUsername, useSession } from '../src/session';
import { colors } from '../src/theme';

function Navigation() {
  const { ready, session, demo } = useSession();
  const needsUsername = ready && !!session && !hasUsername(session) && !demo;
  const hasWorkspace = ready && (demo || hasUsername(session));

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={needsUsername}>
        <Stack.Screen name="choose-username" />
      </Stack.Protected>
      <Stack.Protected guard={hasWorkspace}>
        <Stack.Screen name="(chat)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function Layout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Navigation />
    </SessionProvider>
  );
}
