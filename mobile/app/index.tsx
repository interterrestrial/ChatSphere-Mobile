import { useState } from 'react';
import { Redirect } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { accounts, apiUrl, errorMessage, googleClientId } from '../src/api';
import { Avatar, Brand, Button, Field, Loading, Notice, Screen } from '../src/components/ui';
import { demoEnabled, hasUsername, useSession } from '../src/session';
import { colors, type } from '../src/theme';

function Preview() {
  return (
    <View style={styles.preview}>
      <View style={styles.person}>
        <Avatar name="Maya Chen" id="maya" compact />
        <Text style={type.name}>Maya Chen</Text>
      </View>
      <View style={styles.received}><Text style={type.body}>Could you check the final layout before 4?</Text></View>
      <View style={styles.sent}><Text style={[type.body, styles.onPrimary]}>I’ll take a look this afternoon.</Text></View>
    </View>
  );
}

export default function Index() {
  const { ready, session, demo, saveSession, openDemo } = useSession();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<'password' | 'google'>();
  const [error, setError] = useState('');

  if (!ready) return <Screen><Loading label="Opening ChatSphere…" /></Screen>;
  if (demo || hasUsername(session)) return <Redirect href="/inbox" />;
  if (session) return <Redirect href="/choose-username" />;

  async function submit() {
    if (pending) return;
    const login = identifier.trim();
    if (!login || !password || (register && (!name.trim() || password.length < 8))) {
      setError(register ? 'Enter a name, email, and a password with at least 8 characters.' : 'Enter your email or username and password.');
      return;
    }
    setPending('password');
    setError('');
    try {
      const next = register ? await accounts.register(name.trim(), login, password) : await accounts.login(login, password);
      await saveSession(next);
    } catch (failure) {
      setError(errorMessage(failure, 'Could not continue. Check your connection and try again.'));
    } finally {
      setPending(undefined);
    }
  }

  async function signInWithGoogle() {
    if (pending) return;
    setPending('google');
    setError('');
    try {
      const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({ webClientId: googleClientId, scopes: ['profile', 'email'] });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (isSuccessResponse(result)) {
        if (!result.data.idToken) throw new Error('Google did not return an ID token.');
        await saveSession(await accounts.google(result.data.idToken));
      }
    } catch (failure) {
      setError(errorMessage(failure, 'Google sign-in could not finish. Try again or use email.'));
    } finally {
      setPending(undefined);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <Brand />
            <View style={styles.intro}>
              <Text accessibilityRole="header" style={type.headline}>
                {apiUrl ? (register ? 'Create an account' : 'Sign in') : demoEnabled ? 'Pick up the conversation' : 'ChatSphere is unavailable'}
              </Text>
              <Text style={type.supporting}>
                {apiUrl ? 'Continue to your ChatSphere inbox.' : demoEnabled
                  ? 'Explore the inbox, send a sample message, or try a suggested reply.'
                  : 'This build is missing its server configuration.'}
              </Text>
            </View>
            {apiUrl ? (
              <View style={styles.form}>
                {register && <Field label="Full name" autoComplete="name" value={name} onChangeText={setName} maxLength={80} editable={!pending} />}
                <Field label={register ? 'Email address' : 'Email or username'} value={identifier} onChangeText={setIdentifier}
                  autoComplete={register ? 'email' : 'username'} keyboardType={register ? 'email-address' : 'default'}
                  autoCapitalize="none" autoCorrect={false} editable={!pending} />
                <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry
                  autoComplete={register ? 'new-password' : 'current-password'} editable={!pending}
                  hint={register ? 'Use at least 8 characters' : undefined} onSubmitEditing={() => void submit()} />
                {!!error && <Notice error>{error}</Notice>}
                <Button label={register ? 'Create account' : 'Sign in'} icon="arrow-forward" onPress={() => void submit()}
                  busy={pending === 'password'} disabled={pending === 'google'} />
                {!!googleClientId && <Button label="Continue with Google" variant="outlined" onPress={() => void signInWithGoogle()}
                  busy={pending === 'google'} disabled={pending === 'password'} />}
                <Button label={register ? 'Back to sign in' : 'Create an account'} variant="text" disabled={!!pending} onPress={() => {
                  setRegister(!register);
                  setPassword('');
                  setError('');
                }} />
              </View>
            ) : demoEnabled && <Preview />}
            {demoEnabled && <Button label="Open sample inbox" icon="chat-bubble-outline"
              variant={apiUrl ? 'outlined' : 'filled'} disabled={!!pending} onPress={openDemo} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  content: { gap: 24, width: '100%', maxWidth: 448, alignSelf: 'center' },
  intro: { gap: 8 },
  form: { gap: 12 },
  preview: { gap: 12, padding: 16, backgroundColor: colors.preview, borderWidth: 1, borderColor: colors.rule, borderRadius: 16 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  received: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surface, maxWidth: '90%' },
  sent: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.primary, maxWidth: '90%' },
  onPrimary: { color: colors.surface },
});
