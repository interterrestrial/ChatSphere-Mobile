import { useState } from 'react';
import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { accounts, ApiError, errorMessage } from '../src/api';
import { Brand, Button, Field, Notice, Screen } from '../src/components/ui';
import { hasUsername, useSession } from '../src/session';
import { type } from '../src/theme';

export default function ChooseUsername() {
  const { session, saveSession, signOut, expireToken } = useSession();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (!session) return <Redirect href="/" />;
  if (hasUsername(session)) return <Redirect href="/inbox" />;
  const token = session.token;

  async function submit() {
    if (pending) return;
    const clean = username.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
      setError('Use 3 to 20 letters, numbers, or underscores.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const { user } = await accounts.chooseUsername(clean, token);
      await saveSession({ user, token });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) expireToken(token);
      setError(errorMessage(failure, 'Could not save your username. Try again.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <Brand />
          <View style={styles.intro}>
            <Text style={type.headline} accessibilityRole="header">Choose a username</Text>
            <Text style={type.supporting}>People can use it to find you and start a conversation.</Text>
          </View>
          <Field label="Username" hint="3 to 20 letters, numbers, or underscores" value={username}
            onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username"
            maxLength={20} onSubmitEditing={() => void submit()} editable={!pending} />
          {!!error && <Notice error>{error}</Notice>}
          <Button label="Go to inbox" icon="arrow-forward" onPress={() => void submit()} busy={pending} />
          <Button label="Back to sign in" variant="text" disabled={pending} onPress={() => {
            void signOut().catch(() => setError('Could not sign out. Try again.'));
          }} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 448, alignSelf: 'center', gap: 16 },
  intro: { gap: 8, marginVertical: 8 },
});
