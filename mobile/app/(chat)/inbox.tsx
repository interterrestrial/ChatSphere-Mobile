import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Brand, Button, IconButton, Loading, Notice, Screen, SearchField } from '../../src/components/ui';
import { conversationPerson, conversationTitle } from '../../src/contracts';
import { useSession } from '../../src/session';
import { colors, type } from '../../src/theme';
import { useWorkspace } from '../../src/workspace';

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const calendar = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' :
    date.toDateString() === new Date().toDateString() ? clock.format(date) : calendar.format(date);
}

export default function Inbox() {
  const { user, demo, conversations, inboxStatus, reconnecting, reloadInbox } = useWorkspace();
  const { signOut, exitDemo } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const search = query.trim().toLowerCase().replace(/^@/, '');
  const shown = conversations.filter((conversation) => {
    const person = conversationPerson(conversation, user._id);
    return `${conversationTitle(conversation, user._id)} ${person?.username ?? ''}`.toLowerCase().includes(search);
  });

  function leave() {
    if (demo) {
      exitDemo();
      return;
    }
    setSigningOut(true);
    setError('');
    void signOut().catch(() => setError('Could not sign out. Try again.')).finally(() => setSigningOut(false));
  }

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.brandBar}>
          <View style={styles.brand}><Brand /></View>
          {demo && <Text style={type.meta}>Sample inbox</Text>}
          <IconButton icon="exit-to-app" label={demo ? 'Exit demo' : 'Sign out'} onPress={leave} disabled={signingOut} />
        </View>
        <View style={styles.header}>
          <View style={styles.title}>
            <Text style={type.headline} accessibilityRole="header">Inbox</Text>
            <IconButton icon="add" label="New conversation" filled onPress={() => router.push('/new-conversation')} />
          </View>
          <SearchField accessibilityLabel="Search conversations" placeholder="Search conversations" value={query} onChangeText={setQuery} />
          {reconnecting && <Notice>Reconnecting…</Notice>}
          {!!error && <Notice error>{error}</Notice>}
          {inboxStatus === 'error' && conversations.length > 0 && (
            <View style={styles.status}>
              <Notice error>Could not refresh the inbox.</Notice>
              <Button label="Retry" variant="text" onPress={() => void reloadInbox()} />
            </View>
          )}
        </View>
        <FlatList
          contentContainerStyle={[styles.list, !shown.length && styles.emptyList]}
          data={shown}
          keyExtractor={({ _id }) => _id}
          refreshing={inboxStatus === 'loading' && conversations.length > 0}
          onRefresh={() => void reloadInbox()}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            inboxStatus === 'loading' && !conversations.length ? <Loading label="Loading conversations…" /> : (
              <View style={styles.empty}>
                <Notice error={inboxStatus === 'error'}>
                  {inboxStatus === 'error' ? 'Could not load conversations.' :
                    search ? 'No conversations match that search.' : 'Your conversations will appear here.'}
                </Notice>
                {inboxStatus === 'error' && <Button label="Try again" variant="outlined" onPress={() => void reloadInbox()} />}
              </View>
            )
          }
          renderItem={({ item }) => {
            const person = conversationPerson(item, user._id);
            const title = conversationTitle(item, user._id);
            const latest = item.lastMessage;
            const preview = latest ? `${latest.senderId === user._id ? 'You: ' : ''}${latest.content}` : 'No messages yet';
            return (
              <Pressable accessibilityRole="button" style={styles.row}
                accessibilityLabel={`${title}, ${preview}${item.unreadMessageId ? ', unread messages' : ''}`}
                android_ripple={{ color: colors.primarySoft }}
                onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: item._id } })}>
                <Avatar name={title} id={person?._id} />
                <View style={styles.rowText}>
                  <View style={styles.rowTitle}>
                    <Text style={[type.name, styles.name]} numberOfLines={1}>{title}</Text>
                    {latest && <Text style={type.meta}>{formatDate(latest.createdAt)}</Text>}
                  </View>
                  <Text style={type.supporting} numberOfLines={1}>
                    {preview}
                  </Text>
                </View>
                {item.unreadMessageId && <View style={styles.unreadDot} />}
              </Pressable>
            );
          }}
        />
        <View style={styles.account}>
          <Avatar name={user.name} id={user._id} compact />
          <View style={styles.rowText}>
            <Text style={type.name} numberOfLines={1}>{user.name}</Text>
            {user.username && <Text style={type.meta} numberOfLines={1}>@{user.username}</Text>}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 680 },
  brandBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { flex: 1, minWidth: 0 },
  header: { paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  title: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  list: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
  emptyList: { flexGrow: 1 },
  empty: { alignItems: 'center', gap: 8, padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72, gap: 12, padding: 12, borderRadius: 12, overflow: 'hidden' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  name: { flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 20, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.rule },
});
