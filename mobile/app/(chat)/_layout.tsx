import { Stack } from 'expo-router';
import { demoUser } from '../../src/demo';
import { useSession } from '../../src/session';
import { colors } from '../../src/theme';
import { WorkspaceProvider } from '../../src/workspace';

export const unstable_settings = { initialRouteName: 'inbox' };

export default function ChatLayout() {
  const { demo, session } = useSession();
  const user = demo ? demoUser : session?.user;
  if (!user) return null;

  return (
    <WorkspaceProvider key={demo ? 'demo' : user._id} user={user} demo={demo} token={session?.token}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
    </WorkspaceProvider>
  );
}
